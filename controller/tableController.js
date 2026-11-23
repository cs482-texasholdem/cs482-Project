// ============================================================================
// File Name: tableController.js
// Purpose: Express controller endpoints for table actions using safe 
//          player lookups, muck preferences, returning showdown data, and chat.
// ============================================================================

const ActiveTable = require("../model/activeTable");
const Deck = require("../util/pokerLogic");
const TableManager = require("../model/tableManager");
const tableManager = new TableManager();
const UserDao = require("../model/UserDao");

const DEFAULT_CHAT_MESSAGES = [
    { sender: "Dealer", text: "Welcome to the table!", timestamp: Date.now() }
];

function ensureTableChat(table) {
    if (table && !Array.isArray(table.chatMessages)) {
        table.chatMessages = DEFAULT_CHAT_MESSAGES.map(m => ({ ...m }));
    }
    return table ? table.chatMessages : [];
}

// Default main table
const mainTable = new ActiveTable("main", "general");
ensureTableChat(mainTable);
tableManager.addTable(mainTable.tableId, mainTable);

// Hardcoded ranked presets
const rankedPresets = [
    {
        id: "ranked-beginner",
        name: "Beginner Lounge",
        skill: "beginner",
        smallBlind: 1,
        bigBlind: 2,
        buyIn: 100
    },
    {
        id: "ranked-intermediate",
        name: "Intermediate Lounge",
        skill: "intermediate",
        smallBlind: 25,
        bigBlind: 50,
        buyIn: 2500
    },
    {
        id: "ranked-advanced",
        name: "Advanced Lounge",
        skill: "advanced",
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 500
    }
];

// Register the three preset ranked tables
for (const preset of rankedPresets) {
    const table = new ActiveTable(
        preset.id,
        preset.skill,
        30,
        "ranked",
        9,
        preset.smallBlind,
        preset.bigBlind
    );

    table.tableName = preset.name;
    table.buyIn = preset.buyIn;
    ensureTableChat(table);

    tableManager.addTable(table.tableId, table);
}

// Retrieve table based on ID
function getRequestedTable(req) {
    const tableId = req.params?.tableId ||
                    req.body?.tableId ||
                    req.query?.tableId ||
                    "main";

    return tableManager.getTable(tableId);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to broadcast table updates to all connected clients
function broadcastTableUpdate(req, tableId) {
    const io = req.app.get('io');

    if (io) {
        io.emit('TABLE_UPDATED', { tableId });
    }
}

// Send showdown results to the correct table
function broadcastShowdown(req, table, winnerData) {
    const io = req.app.get("io");

    if (io) {
        io.to(`table_${table.tableId}`)
            .emit("SHOWDOWN_REVEAL", winnerData);
    }
}

// ============================================================================
// GET TABLE STATUS
// ============================================================================

function getTableStatus(req, res) {
    // Call helper function to retrieve table ID
    const table = getRequestedTable(req);

    // No table
    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const chatMessages = ensureTableChat(table);
    table.checkTimeout();

    const playerId = req.query.playerId;
    const inTable = playerId ? table.hasPlayer(playerId) : false;
    const isPlayer = playerId ? table.players.includes(playerId) : false;
    const isSpectator = playerId ? table.spectators.includes(playerId) : false;

    let playerChips = 1000;
    let playerBet = 0;
    let playerHand = [];
    let playerHasActed = false;

    if (playerId) {
        const p = table.playerManager.getPlayer(playerId);
        if (p) {
            playerChips = p.chips;
            playerBet = p.currentBet;
            playerHasActed = p.hasActed;
        }
    }

    // Retrieve the requesting player's cards
    if (playerId && isPlayer && table.gameInProgress) {
        let hand = table.dealHandToPlayer(playerId);
        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    const currentTurnPlayer = (table.gameInProgress && table.players.length > 0) ? table.players[table.currentTurnIndex] : null;
    const dealerPlayerId = (table.gameInProgress && table.players.length > 0) ? table.players[table.dealerIndex] : null;
    const isCurrentTurn = playerId === currentTurnPlayer;
    const buttonsBlocked = !isPlayer || isSpectator || !table.gameInProgress || !isCurrentTurn || playerHasActed;

    // Calculate raise limits for the current player
    const minRaise = table.currentHighestBet === 0
        ? table.bigBlind
        : table.currentHighestBet + table.bigBlind;

    const maxRaise = playerBet + playerChips;
    const canRaise = !buttonsBlocked && maxRaise >= minRaise;

    // Determine which betting actions are available
    let canCheck = false;
    let canCall = false;

    if (isCurrentTurn && !buttonsBlocked) {
        const currentPlayer = table.playerManager.getPlayer(playerId);
        if (currentPlayer) {
            canCheck = (currentPlayer.currentBet === table.currentHighestBet);
            const callAmountNeeded = table.currentHighestBet - currentPlayer.currentBet;
            canCall = (callAmountNeeded > 0 && currentPlayer.chips >= callAmountNeeded);
            if (callAmountNeeded > 0 && currentPlayer.chips > 0) {
                canCall = true;
            }
        }
    }

    const elapsed = table.turnStartTime ? Math.floor((Date.now() - table.turnStartTime) / 1000) : 0;
    const turnTimeRemaining = Math.max(0, 30 - elapsed);

    // Format player information
    const allPlayersData = table.players.map(id => {
        const p = table.playerManager.getPlayer(id);
        const isDealer = id === dealerPlayerId;
        return {
            id,
            avatar: p?.avatar || "default",
            chips: p ? p.chips : 1000,
            status: p && p.folded ? "Folded" : (p && p.chips === 0 ? "All-In" : (p && p.hasActed ? "Acted" : "Active")),
            isCurrent: id === playerId,
            isDealer
        };
    });

    const spectatorsData = table.spectators;

    return res.status(200).json({
        // Table configuration
        tableId: table.tableId,
        tableName: table.tableName || "Main Table",
        gameMode: table.gameMode,
        skillLevel: table.skillLevel,
        maxPlayers: table.maxPlayers,
        buyIn: table.buyIn,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        visibility: table.visibility,

        // Players and spectators
        playerCount: table.getPlayerCount(),
        spectatorCount: table.getSpectatorCount(),
        players: allPlayersData,
        spectators: spectatorsData,

        inTable,
        isPlayer,
        isSpectator,

        // Game information
        gameStarted: table.gameStarted,
        gameInProgress: table.gameInProgress,
        pot: table.pot,

        // Player info
        playerChips,
        playerBet,
        playerHasActed,
        playerHand,

        // Turn information
        currentTurnPlayer,
        isCurrentTurn,
        buttonsBlocked,
        canCheck,
        canCall,
        canRaise,
        minRaise,
        maxRaise,
        turnTimeRemaining,
        currentHighestBet: table.currentHighestBet,

        // Community cards & chat history
        communityCards: table.displayCards(),
        chatMessages
    });
}

// ============================================================================
// CREATE CUSTOM TABLE
// ============================================================================

function createTable(req, res) {
    const { tableName, maxPlayers, buyIn, smallBlind, bigBlind, visibility } = req.body;

    // Validate required table settings
    if (!tableName || !maxPlayers || !buyIn || !smallBlind || !bigBlind) {
        return res.status(400).json({
            error: "Missing required table settings."
        });
    }

    // Validate table name
    if (typeof tableName !== "string" || !tableName.trim()) {
        return res.status(400).json({
            error: "Invalid table name."
        });
    }

    // Convert numerical settings
    const playerLimit = Number(maxPlayers);
    const buyInAmount = Number(buyIn);
    const smallBlindAmount = Number(smallBlind);
    const bigBlindAmount = Number(bigBlind);

    // Validate numerical settings
    if (
        !Number.isInteger(playerLimit) ||
        playerLimit < 2 ||
        playerLimit > 9 ||
        !Number.isFinite(buyInAmount) ||
        !Number.isFinite(smallBlindAmount) ||
        !Number.isFinite(bigBlindAmount) ||
        buyInAmount <= 0 ||
        smallBlindAmount <= 0 ||
        bigBlindAmount <= smallBlindAmount ||
        buyInAmount < bigBlindAmount
    ) {
        return res.status(400).json({
            error: "Invalid table settings."
        });
    }

    // Validate visibility
    if (!["public", "private"].includes(visibility)) {
        return res.status(400).json({
            error: "Invalid table visibility."
        });
    }

    // Create custom table through TableManager
    const table = tableManager.createTable("general", 30, "custom", playerLimit, smallBlind, bigBlind);

    // Assign custom table settings
    table.tableName = tableName.trim();
    table.buyIn = buyInAmount;
    table.visibility = visibility;
    ensureTableChat(table);

    // Notify connected clients
    broadcastTableUpdate(req, table.tableId);

    return res.status(201).json({
        message: "Table created successfully.",
        tableId: table.tableId,
        tableName: table.tableName,
        gameMode: table.gameMode,
        maxPlayers: table.maxPlayers
    });
}

// ============================================================================
// TABLE LOGIC & CHAT
// ============================================================================

function postChatMessage(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const sender =
        (req.session && req.session.user && req.session.user.username) ||
        (typeof req.body?.playerId === "string" && req.body.playerId.trim());
    const rawMessage = req.body?.message;

    if (!sender) {
        return res.status(401).json({ error: "Player ID is required to chat." });
    }

    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
        return res.status(400).json({ error: "Message cannot be empty." });
    }

    const text = rawMessage.trim().slice(0, 200);
    const chatMessages = ensureTableChat(table);

    const chatEntry = {
        sender,
        text,
        timestamp: Date.now()
    };

    chatMessages.push(chatEntry);

    if (chatMessages.length > 50) {
        chatMessages.shift();
    }

    const io = req.app.get("io");
    if (io) {
        io.emit("table-chat", {
            tableId: table.tableId,
            sender,
            message: text
        });
    }

    return res.status(200).json({
        success: true,
        chatMessages
    });
}

// ============================================================================
// RANKED MATCHMAKING
// ============================================================================

async function joinRankedTable(req, res) {
    const { playerId, skillLevel } = req.body || {};

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({
            error: "Player ID is required."
        });
    }

    if (!["beginner", "intermediate", "advanced"].includes(skillLevel)) {
        return res.status(400).json({
            error: "Invalid ranked skill level."
        });
    }

    const id = playerId.trim();

    // Check if the player is already assigned to a ranked table
    const existingTable = tableManager.getAllTables().find(table =>
        table.gameMode === "ranked" &&
        table.hasPlayer(id)
    );

    if (existingTable) {
        return res.status(200).json({
            message: "Already assigned to a ranked table.",
            tableId: existingTable.tableId,
            isPlayer: existingTable.players.includes(id),
            playerCount: existingTable.getPlayerCount()
        });
    }

    // Retrieve the player's saved chips and avatar
    let startingChips = 1000;
    let playerAvatar = "default";

    if (!id.startsWith("Guest_")) {
        try {
            const dbUser = await UserDao.findOne({
                $or: [{ username: id }, { email: id }]
            });

            if (dbUser) {
                if (typeof dbUser.points === "number") {
                    startingChips = Math.max(0, Math.floor(dbUser.points));
                }

                playerAvatar = dbUser.avatar || "default";
            }
        } catch (err) {
            console.error("Failed to load ranked player:", err);
        }
    }

    // Find an available waiting table or create a new one
    const table = tableManager.getOrCreateRankedTable(skillLevel);

    // Never place a ranked player into an ongoing game
    if (table.isFull() || table.gameInProgress) {
        return res.status(409).json({
            error: "Ranked table is no longer available."
        });
    }

    // Assign the player to the selected ranked table
    if (!table.addPlayer(id, startingChips)) {
        return res.status(409).json({
            error: "Could not join ranked table."
        });
    }

    const player = table.playerManager.getPlayer(id);

    if (player) {
        player.avatar = playerAvatar;
    }

    ensureTableChat(table);
    broadcastTableUpdate(req, table.tableId);

    return res.status(200).json({
        message: "Successfully joined ranked table.",
        tableId: table.tableId,
        tableName: table.tableName,
        skillLevel: table.skillLevel,
        gameMode: table.gameMode,
        isPlayer: true,
        playerCount: table.getPlayerCount(),
        maxPlayers: table.maxPlayers
    });
}

//custom tables
async function joinTable(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    const id = playerId.trim();

    // Only custom tables can be joined directly.
    // Ranked tables must use automatic matchmaking.
    if (table.gameMode !== "custom") {
        return res.status(403).json({
            error: "Ranked tables use automatic matchmaking."
        });
    }

    // Prevent joining a full custom table.
    if (table.isFull()) {
        return res.status(409).json({
            error: "This custom table is full."
        });
    }

    if (table.hasPlayer(id)) {
        return res.status(200).json({
            message: "Player is already at the table.",
            isPlayer: table.players.includes(id)
        });
    }
    
// Default values for guest players
let startingChips = 1000;
let playerAvatar = "default";

// Load registered user's saved points and avatar
if (!id.startsWith("Guest_")) {
    try {
        const dbUser = await UserDao.findOne({
            $or: [{ username: id }, { email: id }]
        });

        if (dbUser) {
            if (typeof dbUser.points === "number") {
                startingChips = Math.max(
                    0,
                    Math.floor(dbUser.points)
                );
            }

            playerAvatar = dbUser.avatar || "default";
        }

    } catch (err) {
        console.error("Failed to fetch user profile on table join:", err);
    }
}

// Add player to table
if (!table.addPlayer(id, startingChips)) {
    return res.status(409).json({
        error: "Could not add player to table."
    });
}

// Attach avatar to the player's in-memory object
const player = table.playerManager.getPlayer(id);

if (player) {
    player.avatar = playerAvatar;
}


    const isPlayer = table.players.includes(id);

    broadcastTableUpdate(req, table.tableId); // Notify all clients of the table update

    return res.status(200).json({
        message: isPlayer ? "Successfully joined the table as a player." : "Game in progress. Added to spectator queue.",
        tableId: table.tableId,
        isPlayer,
        playerCount: table.getPlayerCount()
    });
}

function leaveTable(req, res) {
    // Retrieve requested table
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    const trimmedId = playerId.trim();

    // Capture the guest's current table chips into the session before removing them from the table
    if (trimmedId.startsWith("Guest_") && req.session) {
        const departingPlayer = table.playerManager.getPlayer(trimmedId);
        if (departingPlayer && typeof departingPlayer.chips === "number") {
            req.session.pendingGuestPoints = Math.max(0, Math.floor(departingPlayer.chips));
        }
    }

    // Remove the player if they are seated/queued (do not fail if they already left)
    table.removePlayer(trimmedId);

    broadcastTableUpdate(req, table.tableId); // Notify all clients of the table update

    return res.status(200).json({
        message: "Successfully left the table.",
        playerCount: table.getPlayerCount()
    });
}

function startGame(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const result = table.startGame();

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    broadcastTableUpdate(req, table.tableId); // Notify all clients of the table update

    const playerId = req.body.playerId || req.query.playerId || table.players[0];
    const playerHand = table.dealHandToPlayer(playerId);
    const currentTurnPlayer = table.players[table.currentTurnIndex];
    const elapsed = table.turnStartTime ? Math.floor((Date.now() - table.turnStartTime) / 1000) : 0;
    const turnTimeRemaining = Math.max(0, 30 - elapsed);

    return res.status(200).json({
        message: "Game started successfully.",
        communityCards: table.displayCards(),
        playerHand: playerHand ? playerHand.map(card => Deck.cardToText(card)) : [],
        currentTurnPlayer,
        turnTimeRemaining
    });
}

function playerAction(req, res) {
    const { playerId, action, amount, muckPreference } = req.body;
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    if (!playerId || !action) {
        return res.status(400).json({ error: "Player ID and action are required." });
    }

    // Retrieve player from the requested table
    const p = table.playerManager.getPlayer(playerId);

    if (p && typeof muckPreference === 'boolean') {
        p.muckPreference = muckPreference;
    }

    const result = table.recordAction(playerId, action, Number(amount) || 0);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const winnerData = result.winnerData;

    if (winnerData && winnerData.winners) {
        broadcastShowdown(req, table, winnerData); // Notify all clients of the table update
        table.resetToLobby();
    }

    broadcastTableUpdate(req, table.tableId);

    return res.status(200).json({
        message: `Action ${action} recorded successfully.`,
        chips: p ? p.chips : 0,
        currentBet: p ? p.currentBet : 0,
        pot: table.pot,
        winnerData,
        communityCards: table.displayCards()
    });
}

function nextRound(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const result = table.nextRound();
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }

    const playerId = req.query?.playerId;
    let playerHand = [];

    if (playerId && table.players.includes(playerId)) {
        const hand = table.dealHandToPlayer(playerId);

        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    const winnerData = result.winnerData;
    if (winnerData && winnerData.winners) {
        broadcastShowdown(req, table, winnerData);
        table.resetToLobby();
    }

    broadcastTableUpdate(req, table.tableId); // Notify all clients of the table update

    return res.status(200).json({
        message: "Advanced to the next round.",
        communityCards: result.communityCards,
        winnerData: winnerData,
        pot: result.pot,
        playerHand
    });
}

function finishGame(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    const result = table.finishGame();

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    if (result.winnerData) {
        broadcastShowdown(req, table, result.winnerData);
    }

    broadcastTableUpdate(req, table.tableId);

    return res.status(200).json({
        message: "Game finished successfully.",
        winnerData: result.winnerData
    });
}

function updateMuckPreference(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    const { playerId, muckPreference } = req.body;

    if (typeof playerId !== "string" ||
        typeof muckPreference !== "boolean") {
        return res.status(400).json({
            error: "Invalid muck preference."
        });
    }

    const player = table.playerManager.getPlayer(playerId);

    if (!player || !table.players.includes(playerId)) {
        return res.status(404).json({
            error: "Player not found at table."
        });
    }

    player.muckPreference = muckPreference;

    return res.status(200).json({
        success: true,
        muckPreference: player.muckPreference
    });
}


module.exports = {
    createTable,
    joinRankedTable,
    joinTable,
    leaveTable,
    startGame,
    finishGame,
    playerAction,
    nextRound,
    getTableStatus,
    postChatMessage,
    updateMuckPreference,
    tableManager,
    mainTable
};
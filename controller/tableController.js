// ============================================================================
// File Name: tableController.js
// Purpose: Express controller endpoints for table actions using safe 
//          player lookups, muck preferences, and returning showdown data.
// ============================================================================

const ActiveTable = require("../model/activeTable");
const Deck = require("../util/pokerLogic");
const TableManager = require("../model/tableManager");
const tableManager = new TableManager();

//defualt main table
const mainTable = new ActiveTable("main", "general");
tableManager.addTable(mainTable.tableId, mainTable);

//hardcode in rank
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


//helper function to broadcast table updates to all connected clients
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
    //call helper function to retrieved table ID
    const table = getRequestedTable(req); 

    //no table
    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

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

        //players and spectators
        playerCount: table.getPlayerCount(),
        spectatorCount: table.getSpectatorCount(),
        players: allPlayersData,
        spectators: spectatorsData,

        inTable,
        isPlayer,
        isSpectator,

        //game information
        gameStarted: table.gameStarted,
        gameInProgress: table.gameInProgress,
        pot: table.pot,

        //player info
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
        turnTimeRemaining,
        currentHighestBet: table.currentHighestBet,
        
        //community cards
        communityCards: table.displayCards()
        
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
// TABLE LOGIC
// ============================================================================


function joinTable(req, res) {
    const table = getRequestedTable(req);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    const id = playerId.trim();

    if (table.hasPlayer(id)) {
        return res.status(200).json({
            message: "Player is already at the table.",
            isPlayer: table.players.includes(id)
        });
    }

    if (!table.addPlayer(id)) {
        return res.status(409).json({ error: "Could not add player to table." });
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

    if (!table.removePlayer(playerId.trim())) {
        return res.status(404).json({ error: "Player is not in this table." });
    }

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

module.exports = { createTable, joinTable, leaveTable, startGame, finishGame, playerAction, nextRound, getTableStatus, tableManager, mainTable };
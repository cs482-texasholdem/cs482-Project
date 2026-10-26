const ActiveTable = require("../model/activeTable");
const Deck = require("../util/pokerLogic");

const mainTable = new ActiveTable("main", "general");

function getTableStatus(req, res) {
    mainTable.checkTimeout(); // Check if current player's turn has timed out

    const playerId = req.query.playerId;
    const inTable = playerId ? mainTable.hasPlayer(playerId) : false;
    const isPlayer = playerId ? mainTable.players.includes(playerId) : false;
    const isSpectator = playerId ? mainTable.spectators.includes(playerId) : false;
    
    let playerChips = 1000;
    let playerBet = 0;
    let playerHand = [];
    let playerHasActed = false;

    if (playerId && mainTable.playerObjects.has(playerId)) {
        const p = mainTable.playerObjects.get(playerId);
        playerChips = p.chips;
        playerBet = p.currentBet;
        playerHasActed = p.hasActed;
    }

    if (playerId && isPlayer && mainTable.gameInProgress) {
        let hand = mainTable.dealHandToPlayer(playerId);
        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    const currentTurnPlayer = (mainTable.gameInProgress && mainTable.players.length > 0) ? mainTable.players[mainTable.currentTurnIndex] : null;
    const dealerPlayerId = (mainTable.gameInProgress && mainTable.players.length > 0) ? mainTable.players[mainTable.dealerIndex] : null;
    const isCurrentTurn = playerId === currentTurnPlayer;
    const buttonsBlocked = !isPlayer || isSpectator || !mainTable.gameInProgress || !isCurrentTurn || playerHasActed;

    const elapsed = mainTable.turnStartTime ? Math.floor((Date.now() - mainTable.turnStartTime) / 1000) : 0;
    const turnTimeRemaining = Math.max(0, 30 - elapsed);

    const allPlayersData = mainTable.players.map(id => {
        const p = mainTable.playerObjects.get(id);
        const isDealer = id === dealerPlayerId;
        return {
            id,
            chips: p ? p.chips : 1000,
            status: p && p.folded ? "Folded" : (p && p.hasActed ? "Acted" : "Active"),
            isCurrent: id === playerId,
            isDealer
        };
    });

    const spectatorsData = mainTable.spectators;

    return res.status(200).json({
        tableId: mainTable.tableId,
        skillLevel: mainTable.skillLevel,
        playerCount: mainTable.getPlayerCount(),
        spectatorCount: mainTable.getSpectatorCount(),
        maxPlayers: mainTable.maxPlayers,
        players: allPlayersData,
        spectators: spectatorsData,
        inTable,
        isPlayer,
        isSpectator,
        gameStarted: mainTable.gameStarted,
        gameInProgress: mainTable.gameInProgress,
        pot: mainTable.pot,
        playerChips,
        playerBet,
        playerHasActed,
        currentTurnPlayer,
        isCurrentTurn,
        buttonsBlocked,
        turnTimeRemaining,
        currentHighestBet: mainTable.currentHighestBet,
        communityCards: mainTable.displayCards(),
        playerHand
    });
}

function joinTable(req, res) {
    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    const id = playerId.trim();

    if (mainTable.hasPlayer(id)) {
        return res.status(200).json({
            message: "Player is already at the table.",
            isPlayer: mainTable.players.includes(id)
        });
    }

    if (!mainTable.addPlayer(id)) {
        return res.status(409).json({ error: "Could not add player to table." });
    }

    const isPlayer = mainTable.players.includes(id);

    return res.status(200).json({
        message: isPlayer ? "Successfully joined the table as a player." : "Game in progress. Added to spectator queue.",
        isPlayer,
        playerCount: mainTable.getPlayerCount()
    });
}

function leaveTable(req, res) {
    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    if (!mainTable.removePlayer(playerId.trim())) {
        return res.status(404).json({ error: "Player is not in this table." });
    }

    return res.status(200).json({
        message: "Successfully left the table.",
        playerCount: mainTable.getPlayerCount()
    });
}

<<<<<<< HEAD
/**
 * Handles folding logic
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function foldPlayer(req, res) {
    const { tableId } = req.params;
    const { playerId } = req.body;

    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    if (!table.foldPlayer(playerId)) {
        return res.status(400).json({
            error: "Player is not seated or has already folded."
        });
    }

    return res.status(200).json({
        message: `${playerId} folded.`,
        playerId
    });
}

/**
 * Handles check logic
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function checkPlayer(req, res) {
    const { tableId } = req.params;
    const { playerId } = req.body;

    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    if (!table.check(playerId)) {
        const playerBet = table.playerBets.get(playerId) ?? 0;
        const amountOwed = table.currentBet - playerBet;

        let message;

        if (!table.hasPlayer(playerId)) {
            message = "You are not seated at this table.";
        } else if (table.foldedPlayers.has(playerId)) {
            message = "You have folded and cannot act until the next hand.";
        } else if (table.checkPlayers.has(playerId)) {
            message = "You already checked this betting round.";
        } else if (amountOwed > 0) {
            message = `You owe ${amountOwed} chips. Call to match the bet, raise, or fold.`;
        } else {
            message = "Cannot check with the current bet.";
        }

        return res.status(400).json({
            error: message
        });
    }

    return res.status(200).json({
        message: `${playerId} checked.`,
        playerId
    });
}

/**
 * Handles call logic
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function callPlayer(req, res) {
    const { tableId } = req.params;
    const { playerId } = req.body;

    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    if (!table.call(playerId)) {
        return res.status(400).json({
            error: "Cannot call: player is missing, folded, has no chips, or owes nothing."
        });
    }

    return res.status(200).json({
        message: `${playerId} called.`,
        players: table.players.map(id => ({
            id,
            chips: table.playerChips.get(id),
            bet: table.playerBets.get(id) ?? 0
        })),
        pot: table.pot,
        currentBet: table.currentBet
    });
}

/**
 * Handles call logic
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function raisePlayer(req, res) {
    const { tableId } = req.params;
    const { playerId, raiseTo } = req.body;
    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    if (!table.raise(playerId, raiseTo)) {
        return res.status(400).json({
            error: "Cannot raise. Check the amount, available chips, and player status."
        });
    }

    return res.status(200).json({
        message: `${playerId} raised to ${raiseTo} chips.`,
        players: table.players.map(id => ({
            id,
            chips: table.playerChips.get(id),
            bet: table.playerBets.get(id) ?? 0
        })),
        pot: table.pot,
        currentBet: table.currentBet
    });
}

/**
 * Temporarily test function in the table
 */
function dealTestHand(req, res) {
    const { tableId } = req.params;
    const table = tables.get(tableId);

    if (!table) {
    return res.status(404).json({
        error: "Table not found."
    });
    }

        // Temporary demo setup: populate the selected table if it is empty.
    if (table.getPlayerCount() === 0) {
        const demoPlayers = [
            "Blossom",
            "Bubbles",
            "Buttercup",
            "Professor Utonium",
            "Mojo Jojo",
            "You"
        ];

        demoPlayers.forEach(playerId => {
            table.addPlayer(playerId, 1000);
        });
    }
    
    table.foldedPlayers.clear(); //resets folded players

    if (!table.rotateDealer()) {
        return res.status(400).json({
            error: "Must have at least 2 players in order to start"
        });
    }

    table.assignBlinds();
    table.postBlinds();

    const deck = new Deck();
    const totalPlayers = table.players.length;
    

    const playerHands = table.players.map((player, index) =>
        deck.hand(index, totalPlayers)
    );

    const communityCards = deck.commonCards(totalPlayers);

    return res.status(200).json({
        players: table.players.map(playerId => ({
            id: playerId,
            chips: table.playerChips.get(playerId),
            bet: table.playerBets.get(playerId) ?? 0
        })),
        pot: table.pot,
        dealerIndex: table.dealerIndex,
        smallBlindIndex: table.smallBlindIndex,
        bigBlindIndex: table.bigBlindIndex,
        currentBet: table.currentBet,
        playerHands: playerHands.map(hand =>
            hand.map(card => Deck.cardToText(card))
        ),
        communityCards: communityCards.map(card =>
            Deck.cardToText(card)
        )
    });
}


/**
 * Gets the current turn information for a table.
 */
function getTableState(req, res) {
    const { tableId } = req.params;
    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    // Fold the current player if their timer has expired.
    table.checkTurnTimeout();

    return res.status(200).json({
        tableId: table.tableId,
        players: table.players,
        currentPlayerIndex: table.currentPlayerIndex,
        currentPlayer:
            table.currentPlayerIndex === null
                ? null
                : table.players[table.currentPlayerIndex],
        timeLimit: table.timeLimit,
        timeRemaining: table.getTimeRemaining(),
        turnEndsAt: table.turnEndsAt,
        foldedPlayers: [...table.foldedPlayers],
    });
}


function startDemoHand(req, res) {
    const { tableId } = req.params;
    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({ error: "Table not found." });
    }

    const demoPlayers = ["Blossom", "Bubbles", "Buttercup", "Professor Utonium", "Mojo Jojo", "You"];

    // Reset the table for the demo.
    table.players = [];
    //table.foldedPlayers = [];
    table.foldedPlayers.clear();
    table.currentPlayerIndex = null;
    table.turnEndsAt = null;

    for (const playerId of demoPlayers) {
        table.addPlayer(playerId);
    }

    table.rotateDealer();
    table.assignBlinds();
    table.startTurn(0);

    return res.status(200).json({
        message: "Demo hand started.",
        players: table.players,
        dealerIndex: table.dealerIndex,
        smallBlindIndex: table.smallBlindIndex,
        bigBlindIndex: table.bigBlindIndex,
        currentPlayer: table.players[table.currentPlayerIndex],
        timeLimit: table.timeLimit,
        timeRemaining: table.getTimeRemaining()
    });
}



module.exports = { joinTable, leaveTable, dealTestHand, getTableState, startDemoHand, foldPlayer, checkPlayer, callPlayer, raisePlayer };
=======
function startGame(req, res) {
    const result = mainTable.startGame();
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const playerId = req.body.playerId || req.query.playerId || mainTable.players[0];
    const playerHand = mainTable.dealHandToPlayer(playerId);
    const currentTurnPlayer = mainTable.players[mainTable.currentTurnIndex];
    const elapsed = mainTable.turnStartTime ? Math.floor((Date.now() - mainTable.turnStartTime) / 1000) : 0;
    const turnTimeRemaining = Math.max(0, 30 - elapsed);

    return res.status(200).json({
        message: "Game started successfully.",
        communityCards: mainTable.displayCards(),
        playerHand: playerHand ? playerHand.map(card => Deck.cardToText(card)) : [],
        currentTurnPlayer,
        turnTimeRemaining
    });
}

function playerAction(req, res) {
    const { playerId, action, amount } = req.body;
    if (!playerId || !action) {
        return res.status(400).json({ error: "Player ID and action are required." });
    }

    const result = mainTable.recordAction(playerId, action, Number(amount) || 0);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const p = mainTable.playerObjects.get(playerId);
    const winnerData = result.winnerData;
    if (winnerData && winnerData.winners) {
        mainTable.resetToLobby();
    }

    return res.status(200).json({
        message: `Action ${action} recorded successfully.`,
        chips: p.chips,
        currentBet: p.currentBet,
        pot: mainTable.pot,
        winnerData,
        communityCards: mainTable.displayCards()
    });
}

function nextRound(req, res) {
    const result = mainTable.nextRound();
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }

    const playerId = req.query.playerId;
    let playerHand = [];
    if (playerId && mainTable.players.includes(playerId)) {
        let hand = mainTable.dealHandToPlayer(playerId);
        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    const winnerData = result.winnerData;
    if (winnerData && winnerData.winners) {
        mainTable.resetToLobby();
    }

    return res.status(200).json({
        message: "Advanced to the next round.",
        communityCards: result.communityCards,
        winnerData: winnerData,
        pot: result.pot,
        playerHand
    });
}

module.exports = { joinTable, leaveTable, startGame, playerAction, nextRound, getTableStatus };
>>>>>>> next_round_testing

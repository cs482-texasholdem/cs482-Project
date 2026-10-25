/**
 * Table Controller
 * Handles API requests for joining and leaving poker tables.
 * @module tableController
 */

const ActiveTable = require("../model/activeTable");
const Deck = require("../util/pokerLogic");

// Stores active tables in memory.
const tables = new Map([
    ["table1", new ActiveTable("table1", "beginner")],
    ["table2", new ActiveTable("table2", "intermediate")],
    ["table3", new ActiveTable("table3", "advanced")]
]);

/**
 * Handles a request to join a poker table.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function joinTable(req, res) {
    const { tableId } = req.params;
    const playerId = req.body.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({
            error: "Player ID is required."
        });
    }

    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    const id = playerId.trim();

    if (table.hasPlayer(id)) {
        return res.status(409).json({
            error: "Player has already joined this table."
        });
    }

    if (!table.addPlayer(id)) {
        return res.status(409).json({
            error: "Table is full."
        });
    }

    return res.status(200).json({
        message: "Successfully joined the table.",
        tableId: table.tableId,
        skillLevel: table.skillLevel,
        playerCount: table.getPlayerCount(),
        maxPlayers: table.maxPlayers
    });
}

/**
 * Handles a request to leave a poker table.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Object} HTTP response containing the result of the request.
 */
function leaveTable(req, res) {
    const { tableId } = req.params;
    const playerId = req.body.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({
            error: "Player ID is required."
        });
    }

    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    if (!table.removePlayer(playerId.trim())) {
        return res.status(404).json({
            error: "Player is not in this table."
        });
    }

    return res.status(200).json({
        message: "Successfully left the table.",
        tableId: table.tableId,
        playerCount: table.getPlayerCount(),
        maxPlayers: table.maxPlayers
    });
}

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

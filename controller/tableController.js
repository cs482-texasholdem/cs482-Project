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
 * Temporarily tests dealing cards and converting them to readable names.
 */
function dealTestHand(req, res) {
    const workingTable = tables.get("table1");
    const totalPlayers = 2;

    const playerHand = workingTable.deck.hand(0, totalPlayers);

    return res.status(200).json({
        playerHand: playerHand.map(card => Deck.cardToText(card)),
        communityCards: workingTable.displayCards()
    });
}

function nextRound(req, res) {
    const workingTable = tables.get("table1");
    workingTable.nextRound();
    return res.status(200).json({
        message: "Advanced to the next round.",
        communityCards: workingTable.displayCards()
    });
}

module.exports = { joinTable, leaveTable, dealTestHand, nextRound };

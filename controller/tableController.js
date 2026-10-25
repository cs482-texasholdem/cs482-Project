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

    // Temporary demo players and starting chips.
    if (!table.hasPlayer("demo1")) {
        table.addPlayer("demo1", 1250);
    } 

    if (!table.hasPlayer("demo2")) {
        table.addPlayer("demo2", 980);
    }

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
            chips: table.playerChips.get(playerId)
        })),
        pot: table.pot,
        dealerIndex: table.dealerIndex,
        smallBlindIndex: table.smallBlindIndex,
        bigBlindIndex: table.bigBlindIndex,
        playerHands: playerHands.map(hand =>
            hand.map(card => Deck.cardToText(card))
        ),
        communityCards: communityCards.map(card =>
            Deck.cardToText(card)
        )
    });
}

module.exports = { joinTable, leaveTable, dealTestHand };

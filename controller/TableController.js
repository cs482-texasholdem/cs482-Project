const ActiveTable = require("../model/ActiveTable");

// Temporary tables stored in memory.
const tables = new Map();

tables.set("table1", new ActiveTable("table1", "beginner"));
tables.set("table2", new ActiveTable("table2", "intermediate"));
tables.set("table3", new ActiveTable("table3", "advanced"));

function joinTable(req, res) {
    const tableId = req.params.tableId;
    const playerId = req.body.playerId;

    // Check whether a player ID was provided.
    if (!playerId) {
        return res.status(400).json({
            error: "Player ID is required."
        });
    }

    // Find the requested table.
    const table = tables.get(tableId);

    if (!table) {
        return res.status(404).json({
            error: "Table not found."
        });
    }

    // Try to add the player.
    const joined = table.addPlayer(playerId);

    if (!joined) {
        if (table.players.includes(playerId)) {
            return res.status(409).json({
                error: "Player has already joined this table."
            });
        }

        return res.status(409).json({
            error: "Table is full."
        });
    }

    return res.status(200).json({
        message: "Successfully joined the table.",
        tableId: table.tableId,
        skillLevel: table.skillLevel,
        playerCount: table.players.length,
        maxPlayers: table.maxPlayers
    });
}

module.exports = { joinTable };

/**
 * ============================================================================
 * File Name: GameDao.js
 * Purpose: Data Access Object (DAO) layer for persistent game history tracking.
 *          Stores only non-derivable game metadata, initial player seating, 
 *          shuffle seed, and chronological action logs to allow full reconstruction.
 * ============================================================================
 */

const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    tableId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    initialPlayers: [{ type: String, required: true }],
    shuffleSeed: { type: String, required: true },
    actions: [
        {
            playerId: { type: String, required: true },
            action: { type: String, required: true },
            amount: { type: Number, default: 0 },
            round: { type: String, required: true } // e.g., "Pre-Flop", "Flop", "Turn", "River"
        }
    ],
    potFinal: { type: Number, required: true },
    winners: [{ type: String }]
});

const gameModel = mongoose.model('game', gameSchema);

/**
 * Creates and saves a new game history record.
 * @param {Object} gameData Object containing game tracking details.
 * @returns {Promise<Object>} The saved game document.
 */
exports.create = async function(gameData) {
    const game = new gameModel(gameData);
    await game.save();
    return game;
};

/**
 * Retrieves a specific game record by ID.
 * @param {string} id Unique MongoDB game ID.
 * @returns {Promise<Object|null>} The matching game document or null.
 */
exports.read = async function(id) {
    return await gameModel.findById(id);
};

/**
 * Retrieves all stored game history records.
 * @returns {Promise<Array>} Array of game documents.
 */
exports.readAll = async function() {
    return await gameModel.find();
};

/**
 * Finds all game records involving a specific player.
 * @param {string} playerId The player identifier.
 * @returns {Promise<Array>} Array of matching game documents.
 */
exports.findByPlayer = async function(playerId) {
    return await gameModel.find({ initialPlayers: playerId });
};
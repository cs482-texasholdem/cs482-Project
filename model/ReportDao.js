/**
 * ============================================================================
 * File Name: ReportDao.js
 * Author: Bonita Rodrigues
 * Purpose: Data Access Object (DAO) layer for managing player infraction reports. 
 *          Defines the Mongoose schema and database interaction methods (creation, 
 *          sorted retrieval, and status updates) connecting MongoDB Atlas to the 
 *          application controllers.
 * ============================================================================
 */

const mongoose = require('mongoose');

// ============================================================================
// 1. Mongoose Schema & Model Definition
// ============================================================================

/**
 * Mongoose Schema definition for player infraction reports.
 * Tracks the reporter, the offending player, reason, additional details, 
 * resolution status, and creation timestamps.
 */
const reportSchema = new mongoose.Schema({
    reporterUsername: { type: String, required: true },
    reportedUsername: { type: String, required: true },
    reason: { type: String, required: true },
    details: { type: String, maxlength: 2000 },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

// ============================================================================
// 2. DAO Database Operations
// ============================================================================

/**
 * Creates and saves a new report document to the database.
 * 
 * @param {Object} reportData Object containing report details (reporter, reported, reason, etc.)
 * @returns {Promise<Object>} The newly saved report document including its generated ID
 */
exports.create = async function(reportData) {
    let report = new Report(reportData);
    return await report.save();
};

/**
 * Retrieves all report records from the database.
 * Results are sorted so that unresolved reports (resolved: false / 0) appear first, 
 * followed by resolved reports, ordered by creation date descending (newest first).
 * 
 * @returns {Promise<Array>} Array of sorted report documents
 */
exports.readAll = async function() {
    // resolved: 1 sorts false (0) before true (1), keeping unresolved reports at the top
    return await Report.find({}).sort({ resolved: 1, createdAt: -1 });
};

/**
 * Finds a specific report document by its unique MongoDB ID and updates it with new data.
 * 
 * @param {string} id The unique MongoDB report ID
 * @param {Object} updateData Object containing fields to update (e.g., { resolved: true })
 * @returns {Promise<Object|null>} The updated report document or null if not found
 */
exports.findByIdAndUpdate = async function(id, updateData) {
    return await Report.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
};
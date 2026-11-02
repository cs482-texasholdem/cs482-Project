/**
 * ============================================================================
 * File Name: ReportController.js
 * Author: Bonita Rodrigues
 * Purpose: Backend controller for player reporting and administrative content 
 *          moderation in the Texas Hold'em web application. Handles submitting 
 *          player infraction reports, fetching report lists, marking reports 
 *          as resolved, and issuing administrative warnings with notifications.
 * ============================================================================
 */

const reportDao = require('../model/ReportDao');
const userDao = require('../model/UserDao');

/**
 * Submits a new player report from the client dashboard.
 * Validates session user, verifies target user existence, and persists report.
 * 
 * @param {Object} req Request object containing session and report body (reportedUsername, reason, details)
 * @param {Object} res Response object
 */
exports.submitReport = async function(req, res) {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ error: "Unauthorized. Please log in." });
        }

        const reporterUsername = typeof sessionUser === 'object' ? sessionUser.username : sessionUser;
        const { reportedUsername, reason, details } = req.body;

        if (!reportedUsername || !reason) {
            return res.status(400).json({ error: "Offending username and reason are required." });
        }

        const targetUser = await userDao.findOne({ 
            $or: [{ username: reportedUsername }, { email: reportedUsername }] 
        });

        if (!targetUser) {
            return res.status(404).json({ error: "The specified player does not exist." });
        }

        const resolvedTarget = targetUser.username || targetUser.email.split('@')[0];

        const reportData = {
            reporterUsername,
            reportedUsername: resolvedTarget,
            reason,
            details: details || "",
            resolved: false,
            createdAt: new Date()
        };

        await reportDao.create(reportData);
        res.status(201).json({ success: true, message: "Report successfully submitted." });
    } catch (error) {
        console.error("Error submitting report:", error);
        res.status(500).json({ error: "Server error while filing report." });
    }
};

/**
 * Retrieves all player reports from the database for the admin dashboard.
 * Reports are sorted by status (unresolved first) and date.
 * 
 * @param {Object} req Request object
 * @param {Object} res Response object returning an array of report documents
 */
exports.getAllReports = async function(req, res) {
    try {
        const reports = await reportDao.readAll();
        res.status(200).json(reports);
    } catch (error) {
        console.error("Error retrieving reports:", error);
        res.status(500).json({ error: "Server error while fetching reports." });
    }
};

/**
 * Marks a specific report as resolved by its ID.
 * 
 * @param {Object} req Request object containing report ID in URL parameters
 * @param {Object} res Response object
 */
exports.resolveReport = async function(req, res) {
    try {
        const reportId = req.params.id;
        await reportDao.findByIdAndUpdate(reportId, { resolved: true });
        res.status(200).json({ success: true, message: "Report marked as resolved." });
    } catch (error) {
        console.error("Error resolving report:", error);
        res.status(500).json({ error: "Server error while resolving report." });
    }
};

/**
 * Issues an administrative warning to a target player, increments their warning count, 
 * pushes an official notification message into their inbox, and marks the associated report as resolved.
 * 
 * @param {Object} req Request object containing reportId, target username, and custom warningMessage
 * @param {Object} res Response object
 */
exports.warnUser = async function(req, res) {
    try {
        const { reportId, username, warningMessage } = req.body;

        const targetUser = await userDao.findOne({ 
            $or: [{ username: username }, { email: username }] 
        });

        if (!targetUser) {
            return res.status(404).json({ error: "User not found." });
        }

        // Safely initialize and increment warnings counter
        targetUser.warnings = (typeof targetUser.warnings === 'number') ? targetUser.warnings + 1 : 1;

        // Ensure messages array exists for legacy user documents
        if (!Array.isArray(targetUser.messages)) {
            targetUser.messages = [];
        }

        // Push warning message if provided, or construct default message
        const msgText = warningMessage && warningMessage.trim() !== "" 
            ? warningMessage.trim() 
            : `Official Warning #${targetUser.warnings}: You have received a warning from an administrator due to player infraction reports.`;

        targetUser.messages.push({
            sender: 'System Administrator',
            text: msgText,
            date: new Date()
        });

        // Ensure Mongoose flags newly initialized fields on legacy documents as modified
        targetUser.markModified('warnings');
        targetUser.markModified('messages');

        await targetUser.save();

        // Mark report resolved if linked to a specific report ID
        if (reportId) {
            await reportDao.findByIdAndUpdate(reportId, { resolved: true });
        }

        res.status(200).json({ 
            success: true, 
            message: `Warning issued successfully. User now has ${targetUser.warnings} warning(s).`,
            warnings: targetUser.warnings 
        });
    } catch (error) {
        console.error("Error warning user:", error);
        res.status(500).json({ error: "Server error while issuing warning." });
    }
};
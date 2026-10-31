const reportDao = require('../model/ReportDao');
const userDao = require('../model/UserDao');

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

exports.getAllReports = async function(req, res) {
    try {
        const reports = await reportDao.readAll();
        res.status(200).json(reports);
    } catch (error) {
        console.error("Error retrieving reports:", error);
        res.status(500).json({ error: "Server error while fetching reports." });
    }
};

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

exports.warnUser = async function(req, res) {
    try {
        const { reportId, username, warningMessage } = req.body;

        const targetUser = await userDao.findOne({ 
            $or: [{ username: username }, { email: username }] 
        });

        if (!targetUser) {
            return res.status(404).json({ error: "User not found." });
        }

        targetUser.warnings = (targetUser.warnings || 0) + 1;

        // Push warning message if provided, or default message
        const msgText = warningMessage && warningMessage.trim() !== "" 
            ? warningMessage 
            : `You have received an official warning (#${targetUser.warnings}) from an administrator.`;

        targetUser.messages.push({
            sender: 'System Administrator',
            text: msgText,
            date: new Date()
        });

        await targetUser.save();

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
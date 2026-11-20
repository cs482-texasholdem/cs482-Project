/**
 * ============================================================================
 * File Name: AchievementController.js
 * Purpose: Express controller for retrieving evaluated player achievements and
 *          earned badges from server-side game history and user records.
 * ============================================================================
 */

const { evaluatePlayerAchievements } = require("../util/achievementEvaluator");

function resolvePlayerId(req) {
    if (req.params?.playerId && String(req.params.playerId).trim()) {
        return String(req.params.playerId).trim();
    }
    if (req.query?.playerId && String(req.query.playerId).trim()) {
        return String(req.query.playerId).trim();
    }
    const sessionUser = req.session?.user;
    if (sessionUser) {
        if (typeof sessionUser === "object") {
            return String(
                sessionUser.username ||
                (sessionUser.email ? sessionUser.email.split("@")[0] : "") ||
                sessionUser.email ||
                ""
            ).trim();
        }
        return String(sessionUser).trim();
    }
    return "";
}

exports.getAchievements = async function(req, res) {
    try {
        const playerId = resolvePlayerId(req);
        if (!playerId) {
            return res.status(400).json({ error: "Player ID is required." });
        }

        const summary = await evaluatePlayerAchievements(playerId);
        return res.status(200).json(summary);
    } catch (error) {
        console.error("Error evaluating achievements:", error);
        return res.status(500).json({ error: "Failed to evaluate achievements." });
    }
};
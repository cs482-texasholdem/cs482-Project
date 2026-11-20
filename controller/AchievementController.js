/**
 * ============================================================================
 * File Name: AchievementController.js
 * Purpose: Express controller for retrieving evaluated player achievements and
 *          earned badges from server-side game history and user records.
 * ============================================================================
 */

const { evaluatePlayerAchievements } = require("../util/achievementEvaluator");

function resolvePlayerId(req) {
    if (req.params?.playerId && req.params.playerId.trim()) {
        return req.params.playerId.trim();
    }
    if (req.query?.playerId && req.query.playerId.trim()) {
        return req.query.playerId.trim();
    }
    const sessionUser = req.session?.user;
    if (sessionUser) {
        return typeof sessionUser === "object"
            ? (sessionUser.username || sessionUser.email || "")
            : String(sessionUser);
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
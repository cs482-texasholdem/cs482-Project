/**
 * ============================================================================
 * File Name: reactionHandler.js
 * Purpose: Validates the emoji, checks socket room membership, and prevents spamming.
 * ============================================================================
 */

const ALLOWED_EMOJIS = new Set([
    "😂",
    "😡",
    "😎",
    "😭",
    "👏",
    "😮"
]);

const REACTION_COOLDOWN = 3000;

function registerReactionHandler(io, socket, tableManager) {
    let lastReactionTime = -Infinity;

    socket.on("SEND_REACTION", (data) => {

        // Validate incoming data
        if (!data || typeof data !== "object") return;

        const { tableId, playerId, emoji } = data;

        if (typeof tableId !== "string") return;
        if (typeof playerId !== "string") return;
        if (!ALLOWED_EMOJIS.has(emoji)) return;

        // Retrieve the requested table
        const table = tableManager.getTable(tableId);

        if (!table) return;

        // Verify that the player is seated at the table
        if (!table.players.includes(playerId)) return;

        // Verify registered user identity
        const sessionUser = socket.request.session?.user;

        const username = typeof sessionUser === "object"
            ? sessionUser?.username
            : sessionUser;

        if (username) {
            if (username !== playerId) return;
        } else {
            // Allow guest players
            if (!playerId.startsWith("Guest_")) return;
        }

        // Verify socket room membership
        const room = `table_${tableId}`;

        if (!socket.rooms.has(room)) return;

        // Prevent reaction spam
        const now = Date.now();

        if (now - lastReactionTime < REACTION_COOLDOWN) {
            return;
        }

        lastReactionTime = now;

        // Broadcast reaction to everyone at this table
        io.to(room).emit("PLAYER_REACTION", {
            tableId,
            playerId,
            emoji
        });
    });
}

module.exports = registerReactionHandler;
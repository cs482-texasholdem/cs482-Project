/**
 * ============================================================================
 * File Name: PresenceManager.js
 * Purpose: tracks which registered users are connected to the website, regardless of whether they're playing poker.
 * ============================================================================
 */


const onlineUsers = new Map();

function addUser(username, socketId) {
    if (!onlineUsers.has(username)) {
        onlineUsers.set(username, new Set());
    }

    const connections = onlineUsers.get(username);
    const wasOffline = connections.size === 0;

    connections.add(socketId);
    return wasOffline;
}

function removeUser(username, socketId) {
    const connections = onlineUsers.get(username);

    if (!connections) return false;

    connections.delete(socketId);

    if (connections.size === 0) {
        onlineUsers.delete(username);
        return true;
    }

    return false;
}

function isOnline(username) {
    return onlineUsers.has(username);
}

module.exports = {
    addUser,
    removeUser,
    isOnline
};

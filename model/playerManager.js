/**
 * ============================================================================
 * File Name: playerManager.js
 * Purpose: Manages player seating, queue distribution, spectators, and 
 *          deferred removals with defensive safe accessors.
 * ============================================================================
 */

class Player {
    constructor(id, chips = 1000) {
        this.id = id;
        this.chips = chips;
        this.folded = false;
        this.currentBet = 0;
        this.hasActed = false;
    }
}

class PlayerManager {
    constructor(maxPlayers = 10) {
        this.maxPlayers = maxPlayers;
        this.queue = [];
        this.players = [];
        this.spectators = [];
        this.playerObjects = new Map();
        this.pendingRemovals = new Set();
        this.consecutiveTimeouts = new Map();
    }

    isFull() {
        return this.queue.length >= this.maxPlayers;
    }

    hasPlayer(playerId) {
        if (!playerId || typeof playerId !== "string") return false;
        return this.playerObjects.has(playerId.trim()) || this.queue.includes(playerId.trim());
    }

    /**
     * Safely retrieves a Player instance by ID.
     * @param {string} playerId The player ID to look up.
     * @returns {Player|null} The player instance or null if not found.
     */
    getPlayer(playerId) {
        if (!playerId || typeof playerId !== "string") return null;
        return this.playerObjects.get(playerId.trim()) || null;
    }

    getPlayerCount() {
        return this.players.length;
    }

    getSpectatorCount() {
        return this.spectators.length;
    }

    addPlayer(playerId) {
        if (typeof playerId !== "string" || !playerId.trim()) {
            return false;
        }

        const trimmedId = playerId.trim();
        if (this.hasPlayer(trimmedId)) {
            return false;
        }

        const player = new Player(trimmedId);
        this.playerObjects.set(trimmedId, player);
        this.queue.push(trimmedId);
        this.updateQueueDistribution(false);
        return true;
    }

    updateQueueDistribution(gameInProgress) {
        if (!gameInProgress) {
            this.players = this.queue.slice(0, this.maxPlayers);
            this.spectators = this.queue.slice(this.maxPlayers);
        } else {
            const activeSet = new Set(this.players);
            this.spectators = this.queue.filter(id => !activeSet.has(id));
        }
    }

    removePlayer(playerId, gameInProgress) {
        if (!playerId || typeof playerId !== "string") return false;
        const trimmedId = playerId.trim();

        if (!this.playerObjects.has(trimmedId) && !this.queue.includes(trimmedId)) {
            return false;
        }

        const player = this.getPlayer(trimmedId);
        if (player) {
            player.folded = true;
        }

        if (gameInProgress) {
            this.pendingRemovals.add(trimmedId);
            return true;
        }

        this.executeRemoval(trimmedId, gameInProgress);
        return true;
    }

    executeRemoval(playerId, gameInProgress) {
        this.playerObjects.delete(playerId);
        this.consecutiveTimeouts.delete(playerId);
        
        const index = this.queue.indexOf(playerId);
        if (index !== -1) this.queue.splice(index, 1);
        
        const pIndex = this.players.indexOf(playerId);
        if (pIndex !== -1) this.players.splice(pIndex, 1);
        
        const sIndex = this.spectators.indexOf(playerId);
        if (sIndex !== -1) this.spectators.splice(sIndex, 1);

        this.updateQueueDistribution(gameInProgress);
    }

    processPendingRemovals(gameInProgress) {
        for (const id of this.pendingRemovals) {
            this.executeRemoval(id, gameInProgress);
        }
        this.pendingRemovals.clear();
    }
}

PlayerManager.Player = Player;
module.exports = PlayerManager;
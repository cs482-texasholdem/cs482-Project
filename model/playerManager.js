/**
 * Represents an individual Player at the table.
 */
class Player {
    /**
     * Creates a player instance.
     * @param {string} id Unique identifier for the player.
     * @param {number} [chips=1000] Initial chip count.
     */
    constructor(id, chips = 1000) {
        this.id = id;
        this.chips = chips;
        this.folded = false;
        this.currentBet = 0;
        this.hasActed = false;
    }
}

/**
 * Manages player seating, queue distribution, spectators, and deferred removals.
 */
class PlayerManager {
    /**
     * Initializes the player manager.
     * @param {number} [maxPlayers=10] Maximum active players allowed at the table.
     */
    constructor(maxPlayers = 10) {
        this.maxPlayers = maxPlayers;
        this.queue = [];
        this.players = [];
        this.spectators = [];
        this.playerObjects = new Map();
        this.pendingRemovals = new Set();
        this.consecutiveTimeouts = new Map();
    }

    /**
     * Checks if the active player queue has reached capacity.
     * @returns {boolean} True if full, false otherwise.
     */
    isFull() {
        return this.queue.length >= this.maxPlayers;
    }

    /**
     * Determines whether a player exists in the table or queue.
     * @param {string} playerId The player ID to check.
     * @returns {boolean} True if present.
     */
    hasPlayer(playerId) {
        return this.playerObjects.has(playerId) || this.queue.includes(playerId);
    }

    /**
     * Gets the count of active players.
     * @returns {number} Active player count.
     */
    getPlayerCount() {
        return this.players.length;
    }

    /**
     * Gets the count of spectators.
     * @returns {number} Spectator count.
     */
    getSpectatorCount() {
        return this.spectators.length;
    }

    /**
     * Adds a player to the table queue.
     * @param {string} playerId The player ID to add.
     * @returns {boolean} True if successfully added.
     */
    addPlayer(playerId) {
        if (typeof playerId !== "string" || !playerId.trim()) {
            return false;
        }

        playerId = playerId.trim();

        if (this.hasPlayer(playerId)) {
            return false;
        }

        const player = new Player(playerId);
        this.playerObjects.set(playerId, player);
        this.queue.push(playerId);
        this.updateQueueDistribution(false);
        return true;
    }

    /**
     * Updates queue distribution between active players and spectators.
     * @param {boolean} gameInProgress Indicator of whether a game is currently running.
     */
    updateQueueDistribution(gameInProgress) {
        if (!gameInProgress) {
            this.players = this.queue.slice(0, this.maxPlayers);
            this.spectators = this.queue.slice(this.maxPlayers);
        } else {
            const activeSet = new Set(this.players);
            this.spectators = this.queue.filter(id => !activeSet.has(id));
        }
    }

    /**
     * Handles immediate or deferred player removal, ensuring the player folds if a game is in progress.
     * @param {string} playerId The player ID to remove.
     * @param {boolean} gameInProgress Indicator of whether a game is currently running.
     * @returns {boolean} True if removal was registered or executed.
     */
    removePlayer(playerId, gameInProgress) {
        if (!this.playerObjects.has(playerId) && !this.queue.includes(playerId)) {
            return false;
        }

        // Always fold the player immediately before removal / deferral
        const player = this.playerObjects.get(playerId);
        if (player) {
            player.folded = true;
        }

        if (gameInProgress) {
            this.pendingRemovals.add(playerId);
            return true;
        }

        this.executeRemoval(playerId, gameInProgress);
        return true;
    }

    /**
     * Executes the physical removal of a player and cleans up references.
     * @param {string} playerId The player ID to purge.
     * @param {boolean} gameInProgress Indicator of whether a game is currently running.
     */
    executeRemoval(playerId, gameInProgress) {
        this.playerObjects.delete(playerId);
        this.consecutiveTimeouts.delete(playerId);
        
        const index = this.queue.indexOf(playerId);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
        
        const pIndex = this.players.indexOf(playerId);
        if (pIndex !== -1) {
            this.players.splice(pIndex, 1);
        }
        
        const sIndex = this.spectators.indexOf(playerId);
        if (sIndex !== -1) {
            this.spectators.splice(sIndex, 1);
        }

        this.updateQueueDistribution(gameInProgress);
    }

    /**
     * Processes any pending removals accumulated during active gameplay.
     * @param {boolean} gameInProgress Indicator of whether a game is currently running.
     */
    processPendingRemovals(gameInProgress) {
        for (const id of this.pendingRemovals) {
            this.executeRemoval(id, gameInProgress);
        }
        this.pendingRemovals.clear();
    }
}

PlayerManager.Player = Player;
module.exports = PlayerManager;
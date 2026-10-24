/**
 * Represents a poker table and manages its players and settings.
 */
class ActiveTable {
    /**
     * Creates a new poker table.
     * @param {string} tableId - Unique identifier for the table.
     * @param {string} skillLevel - Difficulty level of the table.
     * @param {number} [timeLimit=30] - Time limit for each player's turn in seconds.
     */
    constructor(tableId, skillLevel, timeLimit = 30) {
        if (typeof tableId !== "string" || !tableId.trim()) {
            throw new Error("Table ID is required.");
        }

        if (!Number.isInteger(timeLimit) || timeLimit <= 0) {
            throw new Error("Time limit must be a positive integer.");
        }

        this.tableId = tableId;
        this.skillLevel = skillLevel;
        this.timeLimit = timeLimit;
        this.maxPlayers = 10;
        this.players = [];
        this.dealerIndex = null;
        this.smallBlindIndex = null;
        this.bigBlindIndex = null;

    }

    /**
     * Checks whether the table has reached its player limit.
     * @returns {boolean} True if the table is full; otherwise, false.
     */
    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    /**
     * Checks whether a player is already at the table.
     * @param {string} playerId - ID of the player to check.
     * @returns {boolean} True if the player is at the table; otherwise, false.
     */
    hasPlayer(playerId) {
        return this.players.includes(playerId);
    }

    /**
     * Gets the current number of players at the table.
     * @returns {number} The number of players.
     */
    getPlayerCount() {
        return this.players.length;
    }

    /**
     * Adds a player if they are not already present and the table is not full.
     * @param {string} playerId - ID of the player to add.
     * @returns {boolean} True if the player was added; otherwise, false.
     */
    addPlayer(playerId) {
        if (typeof playerId !== "string" || !playerId.trim()) {
            return false;
        }

        playerId = playerId.trim();

        if (this.hasPlayer(playerId) || this.isFull()) {
            return false;
        }

        this.players.push(playerId);
        return true;
    }

    /**
     * Removes a player from the table.
     * @param {string} playerId - ID of the player to remove.
     * @returns {boolean} True if the player was removed; otherwise, false.
     */
    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);

        if (index === -1) {
            return false;
        }

        this.players.splice(index, 1);
        return true;
    }

    assignBlinds() {
        if (this.players.length < 2 || this.dealerIndex === null) {
            return false;
        }
        if (this.players.length === 2) { //special case )(with two players, the dealer is also the small blind)
             this.smallBlindIndex = this.dealerIndex;
        } 
        else { // With three or more players, use the player after the dealer.
            this.smallBlindIndex = (this.dealerIndex + 1) % this.players.length;
        }

        this.bigBlindIndex = (this.smallBlindIndex + 1) % this.players.length;
        
        return true;
     }


    /**
     * Rotates dealer chip around the table 
     * @returns {boolean} True if the player was removed; otherwise, false.
     */
    rotateDealer() {
        // A hand needs at least two players 
        if (this.players.length < 2) {
            return false;
        }

        if (this.dealerIndex === null) { // First hand: randomly choose the dealer.
            this.dealerIndex = Math.floor(Math.random() * this.players.length);
        } 

        else { // Next hand: move forward, wrapping to index 0.
            this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        }

        return true;
    }
}

module.exports = ActiveTable;

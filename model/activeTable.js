const Deck = require("../util/pokerLogic");

/**
 * Represents a poker table and manages its players and settings.
 */
class ActiveTable {
    /**
     * Creates a new poker table.
     * 
     * @param {string} tableId Unique identifier for the table.
     * @param {string} skillLevel Difficulty level of the table.
     * @param {number} [timeLimit=30] Time limit for each player's turn in seconds.
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
        //this.gameInProgress = false; //TODO: Players can only join or leave when the game is not in progress
        this.displayedCards = [];
        this.deck = new Deck();
        this.roundPlayerCount = null;
        this.playerHands = new Map(); // Stores player hands keyed by playerId
    }

    /**
     * Checks whether the table has reached its player limit.
     * 
     * @returns {boolean} True if the table is full; otherwise, false.
     */
    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    /**
     * Checks whether a player is already at the table.
     * 
     * @param {string} playerId ID of the player to check.
     * @returns {boolean} True if the player is at the table; otherwise, false.
     */
    hasPlayer(playerId) {
        return this.players.includes(playerId);
    }

    /**
     * Gets the current number of players at the table.
     * 
     * @returns {number} The number of players.
     */
    getPlayerCount() {
        return this.players.length;
    }

    /**
     * Adds a player if they are not already present and the table is not full.
     * 
     * @param {string} playerId ID of the player to add.
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
     * 
     * @param {string} playerId ID of the player to remove.
     * @returns {boolean} True if the player was removed; otherwise, false.
     */
    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);

        if (index === -1) {
            return false;
        }

        this.players.splice(index, 1);
        this.playerHands.delete(playerId); // Clean up hand if player leaves
        return true;
    }

    /**
     * Deals hole cards to a specific player using pokerLogic's hand method.
     * 
     * @param {string} playerId ID of the player to deal cards to.
     * @returns {Array|boolean} An array of card numbers, or false if invalid/not at table.
     */
    dealHandToPlayer(playerId) {
        if (typeof playerId !== "string" || !this.hasPlayer(playerId)) {
            return false;
        }

        const playerIndex = this.players.indexOf(playerId);
        const totalPlayers = this.players.length;

        // Use the existing deck.hand(index, totalPlayers) method from pokerLogic
        const hand = this.deck.hand(playerIndex, totalPlayers);
        this.playerHands.set(playerId, hand);
        return hand;
    }

    nextRound() {
        if (this.roundPlayerCount === null) {
            this.roundPlayerCount = this.players.length;
        }

        if (this.displayedCards.length === 0) {
            this.displayedCards = this.deck.showFlop(this.roundPlayerCount);
        } else if (this.displayedCards.length === 3) {
            this.displayedCards.push(this.deck.showTurn(this.roundPlayerCount));
        } else if (this.displayedCards.length === 4) {
            this.displayedCards.push(this.deck.showRiver(this.roundPlayerCount));
        } else if (this.displayedCards.length === 5) {
            // Add winner logic
            // Cooldown
            this.newGame();
        }

        return this.displayedCards;
    }

    displayCards() {
        const placeholder = "🂠";
        return Array.from({ length: 5 }, (_, index) => {
            const card = this.displayedCards[index];
            if (card === undefined) {
                return placeholder;
            }
            if (!Number.isInteger(card) || card < 1 || card > 52) {
                throw new Error("Displayed cards must be valid card numbers.");
            }
            return Deck.cardToText(card);
        });
    }

    newGame() {
        this.deck.shuffleCards();
        this.displayedCards = [];
        this.roundPlayerCount = null;
        this.playerHands.clear();
    }
}

module.exports = ActiveTable;
const Deck = require("../util/pokerLogic");

/**
 * Represents a poker table and manages its players and settings.
 */
class ActiveTable {
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
        this.displayedCards = [];
        this.deck = new Deck();
        this.roundPlayerCount = null;
        this.playerHands = new Map();
    }

    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    hasPlayer(playerId) {
        return this.players.includes(playerId);
    }

    getPlayerCount() {
        return this.players.length;
    }

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

    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);

        if (index === -1) {
            return false;
        }

        this.players.splice(index, 1);
        this.playerHands.delete(playerId);
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
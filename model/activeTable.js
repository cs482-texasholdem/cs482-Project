const Deck = require("../util/pokerLogic");
const PlayerManager = require("./playerManager");

/**
 * Represents a single global poker table, delegating player management to PlayerManager.
 */
class ActiveTable {
    /**
     * Initializes the active poker table.
     * @param {string} [tableId="main"] Unique identifier for the table.
     * @param {string} [skillLevel="general"] Skill tier of the table.
     * @param {number} [timeLimit=30] Turn time limit in seconds.
     */
    constructor(tableId = "main", skillLevel = "general", timeLimit = 30) {
        this.tableId = tableId;
        this.skillLevel = skillLevel;
        this.timeLimit = timeLimit;
        this.playerManager = new PlayerManager(10);
        this.displayedCards = [];
        this.deck = new Deck();
        this.roundPlayerCount = null; 
        this.playerHands = new Map();
        this.gameOver = false;
        this.gameStarted = false;
        this.gameInProgress = false; 
        this.pot = 0;
        this.currentHighestBet = 0; 
        this.currentTurnIndex = 0;
        this.dealerIndex = 0;
        this.aggressorIndex = 0;
        this.gameCount = 0;
        this.turnStartTime = null;
    }

    /** @returns {boolean} */
    isFull() { return this.playerManager.isFull(); }

    /** 
     * @param {string} playerId 
     * @returns {boolean} 
     */
    hasPlayer(playerId) { return this.playerManager.hasPlayer(playerId); }

    /** @returns {number} */
    getPlayerCount() { return this.playerManager.getPlayerCount(); }

    /** @returns {number} */
    getSpectatorCount() { return this.playerManager.getSpectatorCount(); }

    /** 
     * @param {string} playerId 
     * @returns {boolean} 
     */
    addPlayer(playerId) { 
        const added = this.playerManager.addPlayer(playerId);
        this.playerManager.updateQueueDistribution(this.gameInProgress);
        return added;
    }

    /** 
     * @param {string} playerId 
     * @returns {boolean} 
     */
    removePlayer(playerId) {
        const pIndex = this.playerManager.players.indexOf(playerId);
        const isCurrentTurnPlayer = (this.gameInProgress && pIndex !== -1 && this.currentTurnIndex === pIndex);

        if (this.gameInProgress) {
            const res = this.playerManager.removePlayer(playerId, this.gameInProgress);
            const p = this.playerManager.playerObjects.get(playerId);
            if (p && this.players.indexOf(playerId) === this.aggressorIndex) {
                let idx = this.aggressorIndex;
                let safety = 0;
                do {
                    idx = (idx + 1) % this.playerManager.players.length;
                    safety++;
                } while (this.playerManager.playerObjects.get(this.playerManager.players[idx]).folded && safety < this.playerManager.players.length);
                this.aggressorIndex = idx;
            }

            if (isCurrentTurnPlayer) {
                let safety = 0;
                do {
                    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
                    safety++;
                } while (this.playerManager.playerObjects.get(this.playerManager.players[this.currentTurnIndex]).folded && safety < this.playerManager.players.length);
                this.turnStartTime = Date.now();

                const activeNonFolded = this.playerManager.players.map(id => this.playerManager.playerObjects.get(id)).filter(p => p && !p.folded);
                if (activeNonFolded.length <= 1) {
                    this.handleWinner();
                } else if (this.allPlayersHaveActedAndMatched()) {
                    this.nextRound();
                }
            }
            return res;
        }

        const removed = this.playerManager.removePlayer(playerId, this.gameInProgress);
        return removed;
    }

    // --- Proxy getters for backward compatibility with controllers ---
    get queue() { return this.playerManager.queue; }
    get players() { return this.playerManager.players; }
    set players(val) { this.playerManager.players = val; }
    get spectators() { return this.playerManager.spectators; }
    set spectators(val) { this.playerManager.spectators = val; }
    get playerObjects() { return this.playerManager.playerObjects; }
    get maxPlayers() { return this.playerManager.maxPlayers; }
    get consecutiveTimeouts() { return this.playerManager.consecutiveTimeouts; }
    get pendingRemovals() { return this.playerManager.pendingRemovals; }

    /**
     * Starts a new poker game session.
     * @returns {Object} Success object or error details.
     */
    startGame() {
        if (this.playerManager.players.length < 2) {
            return { success: false, error: "At least 2 players are required to start the game." };
        }
        this.gameStarted = true;
        this.gameInProgress = true;
        this.newGameSession();
        return { success: true };
    }

    /**
     * Deals hole cards to a specified player.
     * @param {string} playerId The recipient player ID.
     * @returns {number[]|false} Array of card numbers or false.
     */
    dealHandToPlayer(playerId) {
        if (typeof playerId !== "string" || !this.playerManager.players.includes(playerId)) {
            return false;
        }

        if (this.playerHands.has(playerId)) {
            return this.playerHands.get(playerId);
        }

        const playerIndex = this.playerManager.players.indexOf(playerId);
        const totalPlayers = this.roundPlayerCount; 

        const hand = this.deck.hand(playerIndex, totalPlayers);
        this.playerHands.set(playerId, hand);
        return hand;
    }

    /**
     * Checks and handles turn timeout conditions.
     * @returns {boolean} True if a timeout action was triggered.
     */
    checkTimeout() {
        if (!this.gameInProgress || this.playerManager.players.length === 0) return false;
        const now = Date.now();
        if (this.turnStartTime && (now - this.turnStartTime >= 30000)) {
            const currentId = this.playerManager.players[this.currentTurnIndex];
            const player = this.playerManager.playerObjects.get(currentId);
            if (player && !player.folded && !player.hasActed) {
                const canCheck = (player.currentBet === this.currentHighestBet);
                const action = canCheck ? "Check" : "Fold";
                
                const timeouts = (this.playerManager.consecutiveTimeouts.get(currentId) || 0) + 1;
                this.playerManager.consecutiveTimeouts.set(currentId, timeouts);

                this.recordAction(currentId, action, 0);

                if (timeouts >= 2) {
                    this.removePlayer(currentId);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Records a player's betting action.
     * @param {string} playerId The actor player ID.
     * @param {string} action Action type (Fold, Check, Call, Raise).
     * @param {number} [amount=0] Raise amount when applicable.
     * @returns {Object} Action result status.
     */
    recordAction(playerId, action, amount = 0) {
        const player = this.playerManager.playerObjects.get(playerId);
        if (!player || player.folded || !this.playerManager.players.includes(playerId)) {
            return { success: false, error: "Invalid player or inactive in this round." };
        }
        if (this.playerManager.players[this.currentTurnIndex] !== playerId) {
            return { success: false, error: "Not your turn." };
        }
        if (player.hasActed && action !== "Raise") return { success: false, error: "You have already acted this round." };

        this.playerManager.consecutiveTimeouts.set(playerId, 0);

        if (action === "Fold") {
            player.folded = true;
            if (this.playerManager.players.indexOf(playerId) === this.aggressorIndex) {
                let idx = this.aggressorIndex;
                let safety = 0;
                do {
                    idx = (idx + 1) % this.playerManager.players.length;
                    safety++;
                } while (this.playerManager.playerObjects.get(this.playerManager.players[idx]).folded && safety < this.playerManager.players.length);
                this.aggressorIndex = idx;
            }
        } else if (action === "Check") {
            if (player.currentBet < this.currentHighestBet) {
                return { success: false, error: "Cannot check; must call the current bet." };
            }
        } else if (action === "Call") {
            const diff = this.currentHighestBet - player.currentBet;
            if (player.chips < diff) {
                return { success: false, error: "Not enough chips to call." };
            }
            player.chips -= diff;
            player.currentBet += diff;
            this.pot += diff;
        } else if (action === "Raise") {
            if (amount <= this.currentHighestBet) {
                return { success: false, error: "Raise amount must exceed current highest bet." };
            }
            const diff = amount - player.currentBet;
            if (player.chips < diff) {
                return { success: false, error: "Not enough chips to raise." };
            }
            player.chips -= diff;
            player.currentBet = amount;
            this.currentHighestBet = amount;
            this.pot += diff;
            this.aggressorIndex = this.playerManager.players.indexOf(playerId);
            for (const id of this.playerManager.players) {
                if (id !== playerId) {
                    const p = this.playerManager.playerObjects.get(id);
                    if (p && !p.folded) p.hasActed = false;
                }
            }
        }

        player.hasActed = true;

        const activeNonFolded = this.playerManager.players.map(id => this.playerManager.playerObjects.get(id)).filter(p => p && !p.folded);
        if (activeNonFolded.length <= 1) {
            const winnerData = this.handleWinner();
            return { success: true, roundAdvanced: true, winnerData };
        }

        if (this.allPlayersHaveActedAndMatched()) {
            const roundResult = this.nextRound();
            return { success: true, roundAdvanced: true, ...roundResult };
        }

        let safety = 0;
        do {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
            safety++;
        } while (this.playerManager.playerObjects.get(this.playerManager.players[this.currentTurnIndex]).folded && safety < this.playerManager.players.length);

        this.turnStartTime = Date.now();

        return { success: true, roundAdvanced: false };
    }

    /**
     * Checks if all active non-folded players have acted and matched bets.
     * @returns {boolean} True if round betting is balanced.
     */
    allPlayersHaveActedAndMatched() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.playerObjects.get(id))
            .filter(p => p && !p.folded);

        if (activeNonFolded.length <= 1) return true;

        for (const p of activeNonFolded) {
            if (!p.hasActed || p.currentBet !== this.currentHighestBet) {
                return false;
            }
        }
        return true;
    }

    /** Resets player action states for the next betting round. */
    resetPlayerActions() {
        for (const playerId of this.playerManager.players) {
            const p = this.playerManager.playerObjects.get(playerId);
            if (p && !p.folded) {
                p.hasActed = false;
                p.currentBet = 0;
            }
        }
        this.currentHighestBet = 0;
        this.currentTurnIndex = (this.dealerIndex + 1) % this.playerManager.players.length;
        let safety = 0;
        while (this.playerManager.playerObjects.get(this.playerManager.players[this.currentTurnIndex]).folded && safety < this.playerManager.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
            safety++;
        }
        this.turnStartTime = Date.now();
    }

    /**
     * Advances the betting street (Flop, Turn, River, Showdown).
     * @returns {Object} Street progression results.
     */
    nextRound() {
        if (!this.gameStarted || !this.gameInProgress) {
            return { error: "Game has not been started yet." };
        }

        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.playerObjects.get(id))
            .filter(p => p && !p.folded);

        if (activeNonFolded.length <= 1 || this.displayedCards.length >= 5) {
            const winnerData = this.handleWinner();
            return {
                communityCards: this.displayCards(),
                winnerData: winnerData,
                pot: this.pot
            };
        }

        this.resetPlayerActions();

        const totalP = this.roundPlayerCount;

        if (this.displayedCards.length === 0) {
            this.displayedCards = this.deck.showFlop(totalP);
        } else if (this.displayedCards.length === 3) {
            this.displayedCards.push(this.deck.showTurn(totalP));
        } else if (this.displayedCards.length === 4) {
            this.displayedCards.push(this.deck.showRiver(totalP));
        }

        return {
            communityCards: this.displayCards(),
            winnerData: null,
            pot: this.pot
        };
    }

    /**
     * Formats community cards into text representations.
     * @returns {string[]} Formatted card strings.
     */
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

    /** Initializes a new game session, posting blinds and resetting deck. */
    newGameSession() {
        this.playerManager.processPendingRemovals(this.gameInProgress);
        this.deck = new Deck();
        this.displayedCards = [];
        this.gameStarted = true;
        this.gameInProgress = true;
        this.pot = 0;
        this.currentHighestBet = 0;

        this.playerManager.updateQueueDistribution(this.gameInProgress);
        this.roundPlayerCount = this.playerManager.players.length;

        if (this.gameCount > 0 && this.playerManager.players.length > 0) {
            this.dealerIndex = (this.dealerIndex + 1) % this.playerManager.players.length;
        }
        this.gameCount++;

        for (const playerId of this.playerManager.players) {
            const p = this.playerManager.playerObjects.get(playerId);
            if (p) {
                p.folded = false;
                p.currentBet = 0; 
                p.hasActed = false;
            }
        }

        const n = this.playerManager.players.length;
        if (n >= 2) {
            let sbIndex = (n === 2) ? this.dealerIndex : (this.dealerIndex + 1) % n;
            let bbIndex = (n === 2) ? (this.dealerIndex + 1) % n : (this.dealerIndex + 2) % n;

            const sbPlayer = this.playerManager.playerObjects.get(this.playerManager.players[sbIndex]);
            const bbPlayer = this.playerManager.playerObjects.get(this.playerManager.players[bbIndex]);

            const sbAmount = Math.min(10, sbPlayer.chips);
            sbPlayer.chips -= sbAmount;
            sbPlayer.currentBet = sbAmount;
            this.pot += sbAmount;

            const bbAmount = Math.min(20, bbPlayer.chips);
            bbPlayer.chips -= bbAmount;
            bbPlayer.currentBet = bbAmount;
            this.currentHighestBet = bbAmount;
            this.pot += bbAmount;

            if (n > 2) {
                this.currentTurnIndex = (this.dealerIndex + 3) % n;
            } else {
                this.currentTurnIndex = sbIndex;
            }
            this.aggressorIndex = bbIndex;
        }

        this.turnStartTime = Date.now();
    }

    /** Resets the table state back to the lobby. */
    resetToLobby() {
        this.playerManager.processPendingRemovals(this.gameInProgress);
        this.deck = new Deck();
        this.displayedCards = [];
        this.roundPlayerCount = null;
        this.playerHands.clear();
        this.gameOver = false;
        this.gameStarted = false;
        this.gameInProgress = false;
        this.pot = 0;
        this.currentHighestBet = 0;
        this.currentTurnIndex = 0;
        this.turnStartTime = null;
        this.playerManager.consecutiveTimeouts.clear();
        this.playerManager.updateQueueDistribution(this.gameInProgress);
        for (const [_, p] of this.playerManager.playerObjects) {
            p.folded = false;
            p.currentBet = 0;
            p.hasActed = false;
        }
    }

    /**
     * Determines hand winners and distributes the pot.
     * @returns {Object} Winner details and pot share.
     */
    handleWinner() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.playerObjects.get(id))
            .filter(p => p && !p.folded);

        let winners = [];
        let maxScore = 0;

        if (activeNonFolded.length === 1) {
            winners = [activeNonFolded[0].id];
        } else {
            const commonCards = this.deck.commonCards(this.roundPlayerCount);
            let highest = -1;

            for (const playerId of this.playerManager.players) {
                const p = this.playerManager.playerObjects.get(playerId);
                if (!p || p.folded) continue;

                const hand = this.playerHands.get(playerId);
                if (!hand) continue;

                const score = Deck.bestHand(hand, commonCards);

                if (score > highest) {
                    highest = score;
                    maxScore = score;
                    winners = [playerId];
                } else if (score === highest) {
                    winners.push(playerId);
                }
            }
        }

        if (winners.length > 0) {
            const share = Math.floor(this.pot / winners.length);
            for (const winId of winners) {
                const winnerPlayer = this.playerManager.playerObjects.get(winId);
                if (winnerPlayer) {
                    winnerPlayer.chips += share;
                }
            }
        }

        const resultPot = this.pot;
        this.gameOver = true;
        this.playerManager.processPendingRemovals(this.gameInProgress);
        return { winners, maxScore, pot: resultPot };
    }
}

ActiveTable.Player = PlayerManager.Player;
module.exports = ActiveTable;
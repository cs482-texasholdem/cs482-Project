const Deck = require("../util/pokerLogic");

/**
 * Represents an individual Player at the table.
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

/**
 * Represents a single global poker table.
 */
class ActiveTable {
    constructor(tableId = "main", skillLevel = "general", timeLimit = 30) {
        this.tableId = tableId;
        this.skillLevel = skillLevel;
        this.timeLimit = timeLimit;
        this.maxPlayers = 10;
        this.queue = []; 
        this.players = []; 
        this.spectators = []; 
        this.playerObjects = new Map(); 
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
        this.consecutiveTimeouts = new Map();
    }

    isFull() {
        return this.queue.length >= this.maxPlayers;
    }

    hasPlayer(playerId) {
        return this.playerObjects.has(playerId) || this.queue.includes(playerId);
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

        playerId = playerId.trim();

        if (this.hasPlayer(playerId)) {
            return false;
        }

        const player = new Player(playerId);
        this.playerObjects.set(playerId, player);
        this.queue.push(playerId);
        this._updateQueueDistribution();
        return true;
    }

    _updateQueueDistribution() {
        if (!this.gameInProgress) {
            this.players = this.queue.slice(0, this.maxPlayers);
            this.spectators = this.queue.slice(this.maxPlayers);
        } else {
            const activeSet = new Set(this.players);
            this.spectators = this.queue.filter(id => !activeSet.has(id));
        }
    }

    removePlayer(playerId) {
        if (!this.playerObjects.has(playerId) && !this.queue.includes(playerId)) {
            return false;
        }

        const pIndex = this.players.indexOf(playerId);
        const isCurrentTurnPlayer = (this.gameInProgress && pIndex !== -1 && this.currentTurnIndex === pIndex);

        this.playerObjects.delete(playerId);
        this.consecutiveTimeouts.delete(playerId);
        const index = this.queue.indexOf(playerId);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }

        if (pIndex !== -1) {
            this.players.splice(pIndex, 1);
            if (this.players.length > 0) {
                if (pIndex < this.currentTurnIndex) {
                    this.currentTurnIndex--;
                }
                this.currentTurnIndex = (this.currentTurnIndex + this.players.length) % this.players.length;
            } else {
                this.currentTurnIndex = 0;
            }
        }

        const sIndex = this.spectators.indexOf(playerId);
        if (sIndex !== -1) {
            this.spectators.splice(sIndex, 1);
        }

        this.playerHands.delete(playerId);
        this._updateQueueDistribution();

        if (this.gameInProgress) {
            const activeNonFolded = this.players.map(id => this.playerObjects.get(id)).filter(p => p && !p.folded);
            if (activeNonFolded.length <= 1 || this.players.length < 2) {
                this.handleWinner();
                this.resetToLobby();
            } else {
                // Bulletproof turn adjustment: skip folded players securely
                let safety = 0;
                while (safety < this.players.length) {
                    const currentId = this.players[this.currentTurnIndex];
                    const pObj = this.playerObjects.get(currentId);
                    if (pObj && !pObj.folded) {
                        break;
                    }
                    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
                    safety++;
                }
                this.turnStartTime = Date.now();
            }
        }

        return true;
    }

    startGame() {
        if (this.players.length < 2) {
            return { success: false, error: "At least 2 players are required to start the game." };
        }
        this.gameStarted = true;
        this.gameInProgress = true;
        this.newGameSession();
        return { success: true };
    }

    dealHandToPlayer(playerId) {
        if (typeof playerId !== "string" || !this.players.includes(playerId)) {
            return false;
        }

        if (this.playerHands.has(playerId)) {
            return this.playerHands.get(playerId);
        }

        const playerIndex = this.players.indexOf(playerId);
        const totalPlayers = this.roundPlayerCount; 

        const hand = this.deck.hand(playerIndex, totalPlayers);
        this.playerHands.set(playerId, hand);
        return hand;
    }

    checkTimeout() {
        if (!this.gameInProgress || this.players.length === 0) return false;
        const now = Date.now();
        if (this.turnStartTime && (now - this.turnStartTime >= 30000)) {
            const currentId = this.players[this.currentTurnIndex];
            const player = this.playerObjects.get(currentId);
            if (player && !player.folded && !player.hasActed) {
                const canCheck = (player.currentBet === this.currentHighestBet);
                const action = canCheck ? "Check" : "Fold";
                
                const timeouts = (this.consecutiveTimeouts.get(currentId) || 0) + 1;
                this.consecutiveTimeouts.set(currentId, timeouts);

                this.recordAction(currentId, action, 0);

                if (timeouts >= 2) {
                    this.removePlayer(currentId);
                }
                return true;
            }
        }
        return false;
    }

    recordAction(playerId, action, amount = 0) {
        const player = this.playerObjects.get(playerId);
        if (!player || player.folded || !this.players.includes(playerId)) {
            return { success: false, error: "Invalid player or inactive in this round." };
        }
        if (this.players[this.currentTurnIndex] !== playerId) {
            return { success: false, error: "Not your turn." };
        }
        if (player.hasActed && action !== "Raise") return { success: false, error: "You have already acted this round." };

        this.consecutiveTimeouts.set(playerId, 0);

        if (action === "Fold") {
            player.folded = true;
            if (this.players.indexOf(playerId) === this.aggressorIndex) {
                let idx = this.aggressorIndex;
                let safety = 0;
                do {
                    idx = (idx + 1) % this.players.length;
                    safety++;
                } while (this.playerObjects.get(this.players[idx]).folded && safety < this.players.length);
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
            this.aggressorIndex = this.players.indexOf(playerId);
            for (const id of this.players) {
                if (id !== playerId) {
                    const p = this.playerObjects.get(id);
                    if (p && !p.folded) p.hasActed = false;
                }
            }
        }

        player.hasActed = true;

        const activeNonFolded = this.players.map(id => this.playerObjects.get(id)).filter(p => p && !p.folded);
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
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            safety++;
        } while (this.playerObjects.get(this.players[this.currentTurnIndex]).folded && safety < this.players.length);

        this.turnStartTime = Date.now();

        return { success: true, roundAdvanced: false };
    }

    allPlayersHaveActedAndMatched() {
        const activeNonFolded = this.players
            .map(id => this.playerObjects.get(id))
            .filter(p => p && !p.folded);

        if (activeNonFolded.length <= 1) return true;

        for (const p of activeNonFolded) {
            if (!p.hasActed || p.currentBet !== this.currentHighestBet) {
                return false;
            }
        }
        return true;
    }

    resetPlayerActions() {
        for (const playerId of this.players) {
            const p = this.playerObjects.get(playerId);
            if (p && !p.folded) {
                p.hasActed = false;
                p.currentBet = 0;
            }
        }
        this.currentHighestBet = 0;
        this.currentTurnIndex = (this.dealerIndex + 1) % this.players.length;
        let safety = 0;
        while (this.playerObjects.get(this.players[this.currentTurnIndex]).folded && safety < this.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            safety++;
        }
        this.turnStartTime = Date.now();
    }

    nextRound() {
        if (!this.gameStarted || !this.gameInProgress) {
            return { error: "Game has not been started yet." };
        }

        const activeNonFolded = this.players
            .map(id => this.playerObjects.get(id))
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

    newGameSession() {
        this.deck = new Deck();
        this.displayedCards = [];
        this.gameStarted = true;
        this.gameInProgress = true;
        this.pot = 0;
        this.currentHighestBet = 0;

        this.players = this.queue.slice(0, this.maxPlayers);
        this.spectators = this.queue.slice(this.maxPlayers);
        this.roundPlayerCount = this.players.length;

        if (this.gameCount > 0 && this.players.length > 0) {
            this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        }
        this.gameCount++;

        for (const playerId of this.players) {
            const p = this.playerObjects.get(playerId);
            if (p) {
                p.folded = false;
                p.currentBet = 0; 
                p.hasActed = false;
            }
        }

        const n = this.players.length;
        if (n >= 2) {
            let sbIndex = (n === 2) ? this.dealerIndex : (this.dealerIndex + 1) % n;
            let bbIndex = (n === 2) ? (this.dealerIndex + 1) % n : (this.dealerIndex + 2) % n;

            const sbPlayer = this.playerObjects.get(this.players[sbIndex]);
            const bbPlayer = this.playerObjects.get(this.players[bbIndex]);

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

    resetToLobby() {
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
        this.consecutiveTimeouts.clear();
        this._updateQueueDistribution();
        for (const [_, p] of this.playerObjects) {
            p.folded = false;
            p.currentBet = 0;
            p.hasActed = false;
        }
    }

    handleWinner() {
        const activeNonFolded = this.players
            .map(id => this.playerObjects.get(id))
            .filter(p => p && !p.folded);

        let winners = [];
        let maxScore = 0;

        if (activeNonFolded.length === 1) {
            winners = [activeNonFolded[0].id];
        } else {
            const commonCards = this.deck.commonCards(this.roundPlayerCount);
            let highest = -1;

            for (const playerId of this.players) {
                const p = this.playerObjects.get(playerId);
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
                const winnerPlayer = this.playerObjects.get(winId);
                if (winnerPlayer) {
                    winnerPlayer.chips += share;
                }
            }
        }

        const resultPot = this.pot;
        this.gameOver = true;
        return { winners, maxScore, pot: resultPot };
    }
}

ActiveTable.Player = Player;
module.exports = ActiveTable;
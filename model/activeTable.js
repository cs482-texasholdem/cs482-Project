/**
 * ============================================================================
 * File Name: activeTable.js
 * Purpose: Manages table session, records action history, tracks positional 
 *          indices (dealer, blinds, seating order), and persists game records.
 * ============================================================================
 */

const Deck = require("../util/pokerLogic");
const PlayerManager = require("./playerManager");
const GameDao = require("./GameDao");

class PotManager {
    constructor() {
        this.pot = 0;
        this.currentHighestBet = 0;
    }

    reset() {
        this.pot = 0;
        this.currentHighestBet = 0;
    }

    postBlinds(players, playerManager, dealerIndex) {
        this.pot = 0;
        this.currentHighestBet = 0;
        const n = players.length;
        if (n < 2) return { sbIndex: 0, bbIndex: 0 };

        let sbIndex = (n === 2) ? dealerIndex : (dealerIndex + 1) % n;
        let bbIndex = (n === 2) ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;

        const sbPlayer = playerManager.getPlayer(players[sbIndex]);
        const bbPlayer = playerManager.getPlayer(players[bbIndex]);

        if (sbPlayer) {
            const sbAmount = Math.min(10, sbPlayer.chips);
            sbPlayer.chips -= sbAmount;
            sbPlayer.currentBet = sbAmount;
            this.pot += sbAmount;
        }

        if (bbPlayer) {
            const bbAmount = Math.min(20, bbPlayer.chips);
            bbPlayer.chips -= bbAmount;
            bbPlayer.currentBet = bbAmount;
            this.currentHighestBet = bbAmount;
            this.pot += bbAmount;
        }

        return { sbIndex, bbIndex };
    }

    distributePot(winners, playerManager) {
        if (winners.length > 0 && this.pot > 0) {
            const share = Math.floor(this.pot / winners.length);
            for (const winId of winners) {
                const winnerPlayer = playerManager.getPlayer(winId);
                if (winnerPlayer) {
                    winnerPlayer.chips += share;
                }
            }
        }
        return this.pot;
    }
}

class ActiveTable {
    constructor(tableId = "main", skillLevel = "general", timeLimit = 30) {
        this.tableId = tableId;
        this.skillLevel = skillLevel;
        this.timeLimit = timeLimit;
        this.playerManager = new PlayerManager(10);
        this.potManager = new PotManager();
        this.displayedCards = [];
        this.deck = new Deck();
        this.currentShuffleSeed = this.deck.seed;
        this.initialPlayersSnapshot = [];
        this.recordedDealerIndex = 0;
        this.recordedSbIndex = 0;
        this.recordedBbIndex = 0;
        this.actionHistory = [];
        this.currentRoundName = "Pre-Flop";
        this.roundPlayerCount = null; 
        this.playerHands = new Map();
        this.gameOver = false;
        this.gameStarted = false;
        this.gameInProgress = false; 
        this.currentTurnIndex = 0;
        this.dealerIndex = 0;
        this.aggressorIndex = 0;
        this.gameCount = 0;
        this.turnStartTime = null;
    }

    isFull() { return this.playerManager.isFull(); }
    hasPlayer(playerId) { return this.playerManager.hasPlayer(playerId); }
    getPlayerCount() { return this.playerManager.getPlayerCount(); }
    getSpectatorCount() { return this.playerManager.getSpectatorCount(); }
    
    addPlayer(playerId) { 
        const added = this.playerManager.addPlayer(playerId);
        this.playerManager.updateQueueDistribution(this.gameInProgress);
        return added;
    }

    removePlayer(playerId) {
        const pIndex = this.playerManager.players.indexOf(playerId);
        const isCurrentTurnPlayer = (this.gameInProgress && pIndex !== -1 && this.currentTurnIndex === pIndex);

        if (this.gameInProgress) {
            const res = this.playerManager.removePlayer(playerId, this.gameInProgress);
            const aggressorId = this.playerManager.players[this.aggressorIndex];
            const aggressorPlayer = this.playerManager.getPlayer(aggressorId);
            
            if (aggressorPlayer && this.players.indexOf(playerId) === this.aggressorIndex) {
                let idx = this.aggressorIndex;
                let safety = 0;
                do {
                    idx = (idx + 1) % this.playerManager.players.length;
                    const nextId = this.playerManager.players[idx];
                    const nextP = this.playerManager.getPlayer(nextId);
                    if (nextP && !nextP.folded) break;
                    safety++;
                } while (safety < this.playerManager.players.length);
                this.aggressorIndex = idx;
            }

            if (isCurrentTurnPlayer) {
                let safety = 0;
                do {
                    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
                    const currentId = this.playerManager.players[this.currentTurnIndex];
                    const currentP = this.playerManager.getPlayer(currentId);
                    if (currentP && !currentP.folded) break;
                    safety++;
                } while (safety < this.playerManager.players.length);

                this.turnStartTime = Date.now();

                const activeNonFolded = this.playerManager.players
                    .map(id => this.playerManager.getPlayer(id))
                    .filter(p => p && !p.folded);

                if (activeNonFolded.length <= 1) {
                    this.handleWinner();
                } else if (this.allPlayersHaveActedAndMatched()) {
                    this.nextRound();
                }
            }
            return res;
        }

        return this.playerManager.removePlayer(playerId, this.gameInProgress);
    }

    get queue() { return this.playerManager.queue; }
    get players() { return this.playerManager.players; }
    set players(val) { this.playerManager.players = val; }
    get spectators() { return this.playerManager.spectators; }
    set spectators(val) { this.playerManager.spectators = val; }
    get playerObjects() { return this.playerManager.playerObjects; }
    get maxPlayers() { return this.playerManager.maxPlayers; }
    get consecutiveTimeouts() { return this.playerManager.consecutiveTimeouts; }
    get pendingRemovals() { return this.playerManager.pendingRemovals; }
    
    get pot() { return this.potManager.pot; }
    set pot(val) { this.potManager.pot = val; }
    get currentHighestBet() { return this.potManager.currentHighestBet; }
    set currentHighestBet(val) { this.potManager.currentHighestBet = val; }

    startGame() {
        if (this.playerManager.players.length < 2) {
            return { success: false, error: "At least 2 players are required to start the game." };
        }
        this.gameStarted = true;
        this.gameInProgress = true;
        this.newGameSession();
        return { success: true };
    }

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

    checkTimeout() {
        if (!this.gameInProgress || this.playerManager.players.length === 0) return false;
        const now = Date.now();
        if (this.turnStartTime && (now - this.turnStartTime >= 30000)) {
            const currentId = this.playerManager.players[this.currentTurnIndex];
            const player = this.playerManager.getPlayer(currentId);
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

    recordAction(playerId, action, amount = 0) {
        const player = this.playerManager.getPlayer(playerId);
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
                } while (this.playerManager.getPlayer(this.playerManager.players[idx])?.folded && safety < this.playerManager.players.length);
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
            this.potManager.pot += diff;
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
            this.potManager.currentHighestBet = amount;
            this.potManager.pot += diff;
            this.aggressorIndex = this.playerManager.players.indexOf(playerId);
            for (const id of this.playerManager.players) {
                if (id !== playerId) {
                    const p = this.playerManager.getPlayer(id);
                    if (p && !p.folded) p.hasActed = false;
                }
            }
        }

        player.hasActed = true;

        this.actionHistory.push({
            playerId,
            action,
            amount: action === "Raise" ? amount : 0,
            round: this.currentRoundName
        });

        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
            .filter(p => p && !p.folded);

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
        } while (this.playerManager.getPlayer(this.playerManager.players[this.currentTurnIndex])?.folded && safety < this.playerManager.players.length);

        this.turnStartTime = Date.now();

        return { success: true, roundAdvanced: false };
    }

    allPlayersHaveActedAndMatched() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
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
        for (const playerId of this.playerManager.players) {
            const p = this.playerManager.getPlayer(playerId);
            if (p && !p.folded) {
                p.hasActed = false;
                p.currentBet = 0;
            }
        }
        this.potManager.currentHighestBet = 0;
        this.currentTurnIndex = (this.dealerIndex + 1) % this.playerManager.players.length;
        let safety = 0;
        while (this.playerManager.getPlayer(this.playerManager.players[this.currentTurnIndex])?.folded && safety < this.playerManager.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
            safety++;
        }
        this.turnStartTime = Date.now();
    }

    nextRound() {
        if (!this.gameStarted || !this.gameInProgress) {
            return { error: "Game has not been started yet." };
        }

        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
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
            this.currentRoundName = "Flop";
        } else if (this.displayedCards.length === 3) {
            this.displayedCards.push(this.deck.showTurn(totalP));
            this.currentRoundName = "Turn";
        } else if (this.displayedCards.length === 4) {
            this.displayedCards.push(this.deck.showRiver(totalP));
            this.currentRoundName = "River";
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
            if (card === undefined) return placeholder;
            if (!Number.isInteger(card) || card < 1 || card > 52) {
                throw new Error("Displayed cards must be valid card numbers.");
            }
            return Deck.cardToText(card);
        });
    }

    newGameSession() {
        this.playerManager.processPendingRemovals(this.gameInProgress);
        this.deck = new Deck();
        this.currentShuffleSeed = this.deck.seed;
        this.displayedCards = [];
        this.actionHistory = [];
        this.currentRoundName = "Pre-Flop";
        this.gameStarted = true;
        this.gameInProgress = true;
        this.potManager.reset();

        this.playerManager.updateQueueDistribution(this.gameInProgress);
        this.roundPlayerCount = this.playerManager.players.length;
        this.initialPlayersSnapshot = [...this.playerManager.players];

        if (this.gameCount > 0 && this.playerManager.players.length > 0) {
            this.dealerIndex = (this.dealerIndex + 1) % this.playerManager.players.length;
        }
        this.gameCount++;

        this.recordedDealerIndex = this.dealerIndex;

        for (const playerId of this.playerManager.players) {
            const p = this.playerManager.getPlayer(playerId);
            if (p) {
                p.folded = false;
                p.currentBet = 0; 
                p.hasActed = false;
            }
        }

        const n = this.playerManager.players.length;
        if (n >= 2) {
            const blindIndices = this.potManager.postBlinds(this.playerManager.players, this.playerManager, this.dealerIndex);
            this.recordedSbIndex = blindIndices.sbIndex;
            this.recordedBbIndex = blindIndices.bbIndex;

            let sbIndex = (n === 2) ? this.dealerIndex : (this.dealerIndex + 1) % n;
            if (n > 2) {
                this.currentTurnIndex = (this.dealerIndex + 3) % n;
            } else {
                this.currentTurnIndex = sbIndex;
            }
            this.aggressorIndex = (n === 2) ? (this.dealerIndex + 1) % n : (this.dealerIndex + 2) % n;
        }

        this.turnStartTime = Date.now();
    }

    resetToLobby() {
        this.playerManager.processPendingRemovals(this.gameInProgress);
        this.deck = new Deck();
        this.displayedCards = [];
        this.roundPlayerCount = null;
        this.playerHands.clear();
        this.gameOver = false;
        this.gameStarted = false;
        this.gameInProgress = false;
        this.potManager.reset();
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

    handleWinner() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
            .filter(p => p && !p.folded);

        let winners = [];
        let maxScore = 0;

        if (activeNonFolded.length === 1) {
            winners = [activeNonFolded[0].id];
        } else {
            const commonCards = this.deck.commonCards(this.roundPlayerCount);
            let highest = -1;

            for (const playerId of this.playerManager.players) {
                const p = this.playerManager.getPlayer(playerId);
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

        const resultPot = this.potManager.distributePot(winners, this.playerManager);
        this.gameOver = true;

        GameDao.create({
            tableId: this.tableId,
            initialPlayers: this.initialPlayersSnapshot,
            dealerIndex: this.recordedDealerIndex,
            smallBlindIndex: this.recordedSbIndex,
            bigBlindIndex: this.recordedBbIndex,
            shuffleSeed: this.currentShuffleSeed,
            actions: this.actionHistory,
            potFinal: resultPot,
            winners: winners
        }).catch(err => {
            console.error("Failed to persist game history record:", err);
        });

        this.playerManager.processPendingRemovals(this.gameInProgress);
        return { winners, maxScore, pot: resultPot };
    }
}

ActiveTable.Player = PlayerManager.Player;
ActiveTable.PotManager = PotManager;
module.exports = ActiveTable;
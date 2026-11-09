/**
 * ============================================================================
 * File Name: activeTable.js
 * Purpose: Manages table session, records action history, tracks positional 
 *          indices, persists game records, manages multi-tier side-pots, and 
 *          respects player muck preferences during showdown reveals.
 * ============================================================================
 */

const Deck = require("../util/pokerLogic");
const PlayerManager = require("./playerManager");
const GameDao = require("./GameDao");

class PotManager {
    constructor() {
        this.pots = [{ amount: 0, eligiblePlayers: [] }];
        this.currentHighestBet = 0;
    }

    get pot() {
        return this.pots.reduce((sum, p) => sum + p.amount, 0);
    }

    set pot(val) {
        if (this.pots.length > 0) {
            this.pots[0].amount = val;
        } else {
            this.pots = [{ amount: val, eligiblePlayers: [] }];
        }
    }

    reset() {
        this.pots = [{ amount: 0, eligiblePlayers: [] }];
        this.currentHighestBet = 0;
    }

    postBlinds(players, playerManager, dealerIndex) {
        this.reset();
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
            sbPlayer.totalHandContribution = (sbPlayer.totalHandContribution || 0) + sbAmount;
        }

        if (bbPlayer) {
            const bbAmount = Math.min(20, bbPlayer.chips);
            bbPlayer.chips -= bbAmount;
            bbPlayer.currentBet = bbAmount;
            this.currentHighestBet = bbAmount;
            bbPlayer.totalHandContribution = (bbPlayer.totalHandContribution || 0) + bbAmount;
        }

        return { sbIndex, bbIndex };
    }

    buildPots(players, playerManager) {
        const contributions = [];
        for (const pid of players) {
            const p = playerManager.getPlayer(pid);
            if (p) {
                contributions.push({
                    playerId: pid,
                    contribution: p.totalHandContribution || 0,
                    folded: p.folded
                });
            }
        }

        const thresholds = [...new Set(contributions.map(c => c.contribution))]
            .filter(c => c > 0)
            .sort((a, b) => a - b);

        let newPots = [];
        let previousThreshold = 0;

        for (const threshold of thresholds) {
            let potAmount = 0;
            let eligible = [];

            for (const c of contributions) {
                const contribAtTier = Math.min(c.contribution, threshold) - Math.min(c.contribution, previousThreshold);
                if (contribAtTier > 0) {
                    potAmount += contribAtTier;
                }
                if (c.contribution >= threshold && !c.folded) {
                    eligible.push(c.playerId);
                }
            }

            if (potAmount > 0) {
                newPots.push({ amount: potAmount, eligiblePlayers: eligible });
            }
            previousThreshold = threshold;
        }

        if (newPots.length === 0) {
            newPots.push({ amount: 0, eligiblePlayers: players.filter(id => !playerManager.getPlayer(id)?.folded) });
        }

        this.pots = newPots;
    }

    distributePot(winners, playerManager, commonCards, playerHands) {
        let totalDistributed = 0;

        for (const potObj of this.pots) {
            if (potObj.amount <= 0 || potObj.eligiblePlayers.length === 0) continue;

            const eligibleWinners = winners.filter(wId => potObj.eligiblePlayers.includes(wId));

            if (eligibleWinners.length === 0) {
                let bestEligibleScore = -1;
                let potWinners = [];

                for (const eId of potObj.eligiblePlayers) {
                    const hand = playerHands.get(eId);
                    if (!hand) continue;
                    const score = Deck.bestHand(hand, commonCards);
                    if (score > bestEligibleScore) {
                        bestEligibleScore = score;
                        potWinners = [eId];
                    } else if (score === bestEligibleScore) {
                        potWinners.push(eId);
                    }
                }

                if (potWinners.length > 0) {
                    const share = Math.floor(potObj.amount / potWinners.length);
                    const remainder = potObj.amount % potWinners.length;
                    potWinners.forEach((wId, idx) => {
                        const wp = playerManager.getPlayer(wId);
                        if (wp) {
                            wp.chips += share + (idx === 0 ? remainder : 0);
                        }
                    });
                }
            } else {
                const share = Math.floor(potObj.amount / eligibleWinners.length);
                const remainder = potObj.amount % eligibleWinners.length;
                eligibleWinners.forEach((wId, idx) => {
                    const wp = playerManager.getPlayer(wId);
                    if (wp) {
                        wp.chips += share + (idx === 0 ? remainder : 0);
                    }
                });
            }
            totalDistributed += potObj.amount;
        }

        return totalDistributed;
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

        this.isLocked = false;
        this.turnToken = 0;
    }

    _acquireLock(callback) {
        if (this.isLocked) {
            return { success: false, error: "Table state is currently updating. Please try again." };
        }
        this.isLocked = true;
        try {
            return callback();
        } finally {
            this.isLocked = false;
        }
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
        return this._acquireLock(() => {
            const pIndex = this.playerManager.players.indexOf(playerId);
            const isCurrentTurnPlayer = (this.gameInProgress && pIndex !== -1 && this.currentTurnIndex === pIndex);

            if (this.gameInProgress) {
                const res = this.playerManager.removePlayer(playerId, this.gameInProgress);
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
                    this.turnToken++;

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
        });
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
        return this._acquireLock(() => {
            if (this.playerManager.players.length < 2) {
                return { success: false, error: "At least 2 players are required to start the game." };
            }
            this.gameStarted = true;
            this.gameInProgress = true;
            this.newGameSession();
            return { success: true };
        });
    }

    finishGame() {
        return this._acquireLock(() => {
            if (!this.gameInProgress) {
                return { success: false, error: "No game in progress to finish." };
            }
            const winnerData = this.handleWinner();
            return { success: true, winnerData };
        });
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
        if (this.isLocked) {
            return false;
        }
        return this._acquireLock(() => {
            if (!this.gameInProgress || this.playerManager.players.length === 0) return false;
            const now = Date.now();
            const timeoutDuration = this.timeLimit * 1000;
            
            if (this.turnStartTime && (now - this.turnStartTime >= timeoutDuration)) {
                const currentId = this.playerManager.players[this.currentTurnIndex];
                const player = this.playerManager.getPlayer(currentId);
                
                if (player && !player.folded && !player.hasActed) {
                    const canCheck = (player.currentBet === this.currentHighestBet);
                    const action = canCheck ? "Check" : "Fold";
                    
                    const timeouts = (this.playerManager.consecutiveTimeouts.get(currentId) || 0) + 1;
                    this.playerManager.consecutiveTimeouts.set(currentId, timeouts);

                    const actionResult = this._executeActionInternal(currentId, action, 0);

                    //remove player after 2 timeouts consecutively
                    if (timeouts >= 2) {
                        this.playerManager.removePlayer(currentId, this.gameInProgress);
                    }

                    // Force reset the timer for the next turn so it doesn't instantly re-trigger
                    this.turnStartTime = Date.now();
                    this.turnToken++;

                    return {
                        timedOut: true,
                        playerId: currentId,
                        action: action,
                        winnerData: actionResult.winnerData || null
                    };
                }
            }
            return false;
        });
    }

    recordAction(playerId, action, amount = 0) {
        return this._acquireLock(() => {
            const player = this.playerManager.getPlayer(playerId);
            if (!player || !this.playerManager.players.includes(playerId)) {
                return { success: false, error: "Invalid player or inactive in this round." };
            }
            if (action !== "Fold" && player.folded) {
                return { success: false, error: "Player has already folded." };
            }
            if (action !== "Fold" && this.playerManager.players[this.currentTurnIndex] !== playerId) {
                return { success: false, error: "Not your turn." };
            }
            if (action !== "Fold" && player.hasActed && action !== "Raise") {
                return { success: false, error: "You have already acted this round." };
            }

            // Reset the timeout count when the player performs a real action.
            this.playerManager.consecutiveTimeouts.set(playerId, 0);

            return this._executeActionInternal(playerId, action, amount);
        });
    }

    _executeActionInternal(playerId, action, amount = 0) {
        const player = this.playerManager.getPlayer(playerId);
        const wasCurrentTurn = (this.playerManager.players[this.currentTurnIndex] === playerId);

        if (action === "Fold") {
            player.folded = true;
            player.mucked = true;
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
                const allInAmount = player.chips;
                player.chips = 0;
                player.currentBet += allInAmount;
                player.totalHandContribution = (player.totalHandContribution || 0) + allInAmount;
            } else {
                player.chips -= diff;
                player.currentBet += diff;
                player.totalHandContribution = (player.totalHandContribution || 0) + diff;
            }
        } else if (action === "Raise") {
            if (amount <= this.currentHighestBet) {
                return { success: false, error: "Raise amount must exceed current highest bet." };
            }
            const diff = amount - player.currentBet;
            if (player.chips < diff) {
                const allInAmount = player.chips;
                player.chips = 0;
                player.currentBet += allInAmount;
                player.totalHandContribution = (player.totalHandContribution || 0) + allInAmount;
                this.potManager.currentHighestBet = player.currentBet;
            } else {
                player.chips -= diff;
                player.currentBet = amount;
                this.potManager.currentHighestBet = amount;
                player.totalHandContribution = (player.totalHandContribution || 0) + diff;
            }
            this.aggressorIndex = this.playerManager.players.indexOf(playerId);
            for (const id of this.playerManager.players) {
                if (id !== playerId) {
                    const p = this.playerManager.getPlayer(id);
                    if (p && !p.folded) p.hasActed = false;
                }
            }
        }

        if (action !== "Fold") {
            player.hasActed = true;
        }

        this.potManager.buildPots(this.playerManager.players, this.playerManager);

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

        if (wasCurrentTurn) {
            let safety = 0;
            do {
                this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerManager.players.length;
                safety++;
            } while (this.playerManager.getPlayer(this.playerManager.players[this.currentTurnIndex])?.folded && safety < this.playerManager.players.length);
        }

        this.turnStartTime = Date.now();
        this.turnToken++;

        return { success: true, roundAdvanced: false };
    }

    allPlayersHaveActedAndMatched() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
            .filter(p => p && !p.folded);

        if (activeNonFolded.length <= 1) return true;

        for (const p of activeNonFolded) {
            if (!p.folded && p.chips > 0 && (!p.hasActed || p.currentBet !== this.currentHighestBet)) {
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
        this.turnToken++;
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
                p.mucked = false;
                p.currentBet = 0; 
                p.hasActed = false;
                p.totalHandContribution = 0;
            }
        }

        const n = this.playerManager.players.length;
        if (n >= 2) {
            const blindIndices = this.potManager.postBlinds(this.playerManager.players, this.playerManager, this.dealerIndex);
            this.recordedSbIndex = blindIndices.sbIndex;
            this.recordedBbIndex = blindIndices.bbIndex;

            this.potManager.buildPots(this.playerManager.players, this.playerManager);

            let sbIndex = (n === 2) ? this.dealerIndex : (this.dealerIndex + 1) % n;
            if (n > 2) {
                this.currentTurnIndex = (this.dealerIndex + 3) % n;
            } else {
                this.currentTurnIndex = sbIndex;
            }
            this.aggressorIndex = (n === 2) ? (this.dealerIndex + 1) % n : (this.dealerIndex + 2) % n;
        }

        this.turnStartTime = Date.now();
        this.turnToken++;
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
        this.turnToken++;
        this.playerManager.consecutiveTimeouts.clear();
        this.playerManager.updateQueueDistribution(this.gameInProgress);
        
        for (const [_, p] of this.playerManager.playerObjects) {
            p.folded = false;
            p.mucked = false;
            p.currentBet = 0;
            p.hasActed = false;
            p.totalHandContribution = 0;
        }
    }

    handleWinner() {
        const activeNonFolded = this.playerManager.players
            .map(id => this.playerManager.getPlayer(id))
            .filter(p => p && !p.folded);

        let winners = [];
        let maxScore = 0;

        const commonCards = this.deck.commonCards(this.roundPlayerCount);

        if (activeNonFolded.length === 1) {
            winners = [activeNonFolded[0].id];
        } else {
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

        const resultPot = this.potManager.distributePot(
            winners, 
            this.playerManager, 
            commonCards, 
            this.playerHands
        );
        this.gameOver = true;

        const showdownHands = {};
        for (const playerId of this.playerManager.players) {
            const p = this.playerManager.getPlayer(playerId);
            if (p && !p.folded) {
                const hand = this.playerHands.get(playerId);
                if (hand) {
                    if (p.muckPreference && !winners.includes(playerId)) {
                        continue;
                    }
                    showdownHands[playerId] = hand.map(c => Deck.cardToText(c));
                }
            }
        }

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
        return { winners, maxScore, pot: resultPot, showdownHands };
    }
}

ActiveTable.Player = PlayerManager.Player;
ActiveTable.PotManager = PotManager;
module.exports = ActiveTable;
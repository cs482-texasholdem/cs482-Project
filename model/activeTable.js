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
<<<<<<< HEAD
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

        //table attr
=======
    constructor(tableId = "main", skillLevel = "general", timeLimit = 30) {
>>>>>>> next_round_testing
        this.tableId = tableId;
        this.skillLevel = skillLevel;
        // Set the blind amounts for this table.
        if (skillLevel === "beginner") {
            this.smallBlindAmount = 1;
            this.bigBlindAmount = 2;
        } else if (skillLevel === "intermediate") {
            this.smallBlindAmount = 25;
            this.bigBlindAmount = 50;
        } else if (skillLevel === "advanced") {
            this.smallBlindAmount = 5;
            this.bigBlindAmount = 10;
        } else {
            throw new Error("Unknown skill level.");
        }


        this.timeLimit = timeLimit;
        this.maxPlayers = 10;
<<<<<<< HEAD
        this.players = [];
        
        //moving blinds and dealer around the table
        this.dealerIndex = null;
        this.smallBlindIndex = null;
        this.bigBlindIndex = null;
        this.currentPlayerIndex = null;
        this.turnEndsAt = null; //timestamp

        //chips and pot
        this.playerChips = new Map();
        this.playerBets = new Map();
        this.pot = 0;
        this.currentBet = 0;

        //call/raise/fold/check
        this.foldedPlayers = new Set(); 
        this.checkPlayers = new Set();
=======
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
>>>>>>> next_round_testing
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

<<<<<<< HEAD
    /**
     * Adds a player if they are not already present and the table is not full.
     * @param {string} playerId - ID of the player to add.
     * @returns {boolean} True if the player was added; otherwise, false.
     */
    addPlayer(playerId, chips = 1000) {
=======
    getSpectatorCount() {
        return this.spectators.length;
    }

    addPlayer(playerId) {
>>>>>>> next_round_testing
        if (typeof playerId !== "string" || !playerId.trim()) {
            return false;
        }

        if (!Number.isInteger(chips) || chips <= 0) {
            return false;
        }

        playerId = playerId.trim();

        if (this.hasPlayer(playerId)) {
            return false;
        }

<<<<<<< HEAD
        this.players.push(playerId);
        this.playerChips.set(playerId, chips);

=======
        const player = new Player(playerId);
        this.playerObjects.set(playerId, player);
        this.queue.push(playerId);
        this._updateQueueDistribution();
>>>>>>> next_round_testing
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

<<<<<<< HEAD
        this.players.splice(index, 1);
        this.playerChips.delete(playerId);
        return true;
    }

    /**
     * Removes a player from the table.
     * @returns {boolean} True if the player was removed; otherwise, false.
     */
    assignBlinds() {
        if (this.players.length < 2 || this.dealerIndex === null) {
            return false;
        }
        if (this.players.length === 2) { //special case (with two players, the dealer is also the small blind)
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

    /**
     * Starts the turn for a player.
     * @param {number} playerIndex - Index of the player.
     * @returns {boolean} True if the turn started successfully.
     */
    startTurn(playerIndex) {
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.players.length) {
            return false;
        }

        if (this.foldedPlayers.has(this.players[playerIndex])) {
            return false;
        }

        this.currentPlayerIndex = playerIndex;
        this.turnEndsAt = Date.now() + this.timeLimit * 1000;

        return true;
    }

    /**
     * Gets the number of seconds remaining in the current turn.
     * @returns {number} Seconds remaining, or 0 if the timer has expired.
     */
    getTimeRemaining() {
        if (this.turnEndsAt === null) {
            return 0;
        }
        return Math.max(0, Math.ceil((this.turnEndsAt - Date.now()) / 1000));
    }

    /**
     * Checks whether the current turn has expired.
     * @returns {boolean} True if the timer has expired.
     */
    isTurnExpired() {
        return this.turnEndsAt !== null && Date.now() >= this.turnEndsAt;
    }
    
    /**
     * Advances to the next player who has not folded.
     * @returns {boolean} True if the next turn started successfully.
     */
    advanceTurn() {
        if (this.players.length < 2 || this.currentPlayerIndex === null) {
            return false;
        }

        // Check each remaining seat, moving clockwise.
        for (let i = 1; i <= this.players.length; i++) {
            const nextIndex = (this.currentPlayerIndex + i) % this.players.length;
            const nextPlayer = this.players[nextIndex];

            if (!this.foldedPlayers.has(nextPlayer)) {
                return this.startTurn(nextIndex);
            }
        }

        // No eligible players remain.
        this.currentPlayerIndex = null;
        this.turnEndsAt = null;

        return false;
    }
    
    /**
     * Folds a player and advances to the next eligible player.
     * @param {string} playerId - ID of the player who folds.
     * @returns {boolean} True if the player folded successfully.
     */
    foldPlayer(playerId) {
        if (!this.fold(playerId)) {
            return false;
        }

        // If this player has the current turn, advance to the next player.
        const playerIndex = this.players.indexOf(playerId);

        if (playerIndex === this.currentPlayerIndex) {
            this.advanceTurn();
        }

        return true;
    }
    
    /**
     * Checks whether the current player's turn has timed out.
     * Automatically folds the player if their time has expired.
     * @returns {boolean} True if a player was automatically folded.
     */
    checkTurnTimeout() {
        if (!this.isTurnExpired() || this.currentPlayerIndex === null) {
            return false;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];

        if (!currentPlayer) {
            return false;
        }

        return this.foldPlayer(currentPlayer);
    }

    /**
     * Helper function for the blinds
     * @param {string} playerId - ID of the player to get chip value
     * @param {number} blindAmount - The value of the blind amount they owe
     * @returns {void}
     */
    postBlind(playerIndex, blindAmount) {
        const playerId = this.players[playerIndex];
        const chips = this.playerChips.get(playerId);
        const bet = Math.min(blindAmount, chips); //case for use has $1 when big blind

        this.playerChips.set(playerId, chips - bet);
        this.playerBets.set(playerId, bet);
        this.pot += bet;
    }

    /**
     * Deducts blind bets from player stacks and adds them to the pot.
     * @returns {boolean} Whether the blinds were posted.
     */
    postBlinds() {
        if (this.smallBlindIndex === null || this.bigBlindIndex === null) {
            return false;
        }

        this.postBlind(this.smallBlindIndex, this.smallBlindAmount);
        this.postBlind(this.bigBlindIndex, this.bigBlindAmount);

        this.currentBet = this.bigBlindAmount;

        return true;
    }

    /**
     * Adds player into Set of folded players
     * @param {string} playerId  - ID of the player input into Set
     * @returns {boolean} Whether the blinds were posted.
     */
    fold(playerId){
        // Reject players who aren't seated or already folded.
        if (!this.hasPlayer(playerId) || this.foldedPlayers.has(playerId)) {
            return false;
        }

        this.foldedPlayers.add(playerId);
        return true;
    }

    /**
     * Adds player into Set of checked players
     * @param {string} playerId  - ID of the player input into Set
     * @returns {boolean} Whether the blinds were posted.
     */
    check(playerId) {
        if (!this.hasPlayer(playerId) ||
            this.checkPlayers.has(playerId) ||
            this.foldedPlayers.has(playerId)) {
            return false;
        }

        // Get the player's current bet, or use 0 if no bet is recorded.
        const playerBet = this.playerBets.get(playerId) ?? 0;

        // Checking is allowed only when no additional chips are owed.
        if (playerBet !== this.currentBet) {
            return false;
        }

        this.checkPlayers.add(playerId);
        return true;
    }

    /**
     * Allows user to match current bet
     * @param {string} playerId To get ID to get current pot
     * @returns {boolean} Whether the blinds were posted.
     */
    call(playerId) {
        if (!this.hasPlayer(playerId) || this.foldedPlayers.has(playerId)) {
            return false;
        }

        const chips = this.playerChips.get(playerId);
        const playerBet = this.playerBets.get(playerId) ?? 0;
        const amountOwed = this.currentBet - playerBet;

        //matched bet
        if (amountOwed <= 0 || chips <= 0) {
            return false;
        }

        // Pay the amount owed, or all remaining chips if there aren't enough.
        const payment = Math.min(amountOwed, chips);

        this.playerChips.set(playerId, chips - payment);
        this.playerBets.set(playerId, playerBet + payment);
        this.pot += payment;

        return true;
    }

    /**
     * Allows user to match current bet
     * @param {string} playerId To get ID to get current pot
     * @param {number} raiseTo - user's value to raise
     * @returns {boolean} Whether the blinds were posted.
     */
    raise(playerId, raiseTo) {
        if (!this.hasPlayer(playerId) ||
            this.foldedPlayers.has(playerId)) {
            return false;
        }

        const chips = this.playerChips.get(playerId);
        const playerBet = this.playerBets.get(playerId) ?? 0;

        // higher than current bet
        if (!Number.isInteger(raiseTo) ||
            raiseTo <= this.currentBet) {
            return false;
        }

        const payment = raiseTo - playerBet;

        // Reject raises the player cannot afford.
        if (payment <= 0 || payment > chips) {
            return false;
        }

        this.playerChips.set(playerId, chips - payment);
        this.playerBets.set(playerId, raiseTo);
        this.pot += payment;
        this.currentBet = raiseTo;

=======
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

>>>>>>> next_round_testing
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
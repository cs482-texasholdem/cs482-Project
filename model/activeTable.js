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
        
        //moving blinds and dealer around the table
        this.dealerIndex = null;
        this.smallBlindIndex = null;
        this.bigBlindIndex = null;
        this.currentPlayerIndex = null;
        this.turnEndsAt = null; //timestamp
        this.foldedPlayers = []; //IDs of folded players for current hand

        //chips and pot
        this.playerChips = new Map();
        this.playerBets = new Map();
        this.pot = 0;

        //call/raise/fold/check
        this.foldedPlayers = new Set(); 

        //chips and pot
        this.playerChips = new Map();
        this.playerBets = new Map();
        this.pot = 0;
        this.currentBet = 0;

        //call/raise/fold/check
        this.foldedPlayers = new Set(); 
        this.checkPlayers = new Set();
        


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
    addPlayer(playerId, chips = 1000) {
        if (typeof playerId !== "string" || !playerId.trim()) {
            return false;
        }

        if (!Number.isInteger(chips) || chips <= 0) {
            return false;
        }

        playerId = playerId.trim();

        if (this.hasPlayer(playerId) || this.isFull()) {
            return false;
        }

        this.players.push(playerId);
        this.playerChips.set(playerId, chips);

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

        if (this.foldedPlayers.includes(this.players[playerIndex])) {
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

            if (!this.foldedPlayers.includes(nextPlayer)) {
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
        if (!this.players.includes(playerId)) {
            return false;
        }

        if (this.foldedPlayers.includes(playerId)) {
            return false;
        }

        this.foldedPlayers.push(playerId);

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
    postBlinds(){
        if (this.smallBlindIndex === null || this.bigBlindIndex === null) {
            return false;
        }

        this.postBlind(this.smallBlindIndex, 1);
        this.postBlind(this.bigBlindIndex, 2);

        return true;
    }

    /**
     * Adds player into Set of folded players
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
     * @returns {boolean} Whether the blinds were posted.
     */
    check(playerId) {
        if (!this.hasPlayer(playerId) ||
            this.checkPlayers.has(playerId) ||
            this.foldedPlayers.has(playerId)) {
            return false;
        }

        const playerBet = this.playerBets.get(playerId) ?? 0;

        // Checking is allowed only when no additional chips are owed.
        if (playerBet !== this.currentBet) {
            return false;
        }

        this.checkPlayers.add(playerId);
        return true;
    }

    /**
     * Adds player into Set of call players and raises the money
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
/*
    raise(playerId){
        const playerId = this.players[playerIndex];
        const chips = this.playerChips.get(playerId);

    } 
*/

}

module.exports = ActiveTable;

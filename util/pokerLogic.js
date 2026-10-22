class Deck {
    constructor() {
        this.deck = Array.from({ length: 52 }, (_, i) => i + 1);
        this.shuffleCards();
    }

    shuffleCards() {
        this.deck.sort((a, b) => a - b);
        for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    
    hand(playerIndex, totalPlayers) {
        const card1 = this.deck[playerIndex];
        const card2 = this.deck[playerIndex + totalPlayers];
        return [card1, card2];
    }

    showFlop(totalPlayers) {
        const burnIndex = 2 * totalPlayers;
        const flopStart = burnIndex + 1;
        return this.deck.slice(flopStart, flopStart + 3);
    }

    showTurn(totalPlayers) {
        const turnIndex = 2 * totalPlayers + 5;
        return this.deck[turnIndex];
    }

    showRiver(totalPlayers) {
        const riverIndex = 2 * totalPlayers + 7;
        return this.deck[riverIndex];
    }
}

module.exports = Deck;
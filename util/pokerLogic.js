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
}

module.exports = Deck;
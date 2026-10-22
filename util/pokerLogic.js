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

  commonCards(totalPlayers) {
    const flop = this.showFlop(totalPlayers);
    const turn = this.showTurn(totalPlayers);
    const river = this.showRiver(totalPlayers);
    return [...flop, turn, river];
  }

  // --- Internal Helper Methods for Hand Evaluation ---
  static #parseCard(card) {
    return {
      rank: (card - 1) % 13, // 0 (Two) to 12 (Ace)
      suit: Math.floor((card - 1) / 13) // 0 to 3
    };
  }

  static #getParsedCards(hand, commonCards) {
    const allCards = [...hand, commonCards].flat();
    return allCards.map(c => Deck.#parseCard(c));
  }

  static #getRankCounts(parsedCards) {
    const counts = {};
    for (const card of parsedCards) {
      counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    return counts;
  }

  static #getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [head, ...tail] = arr;
    const withHead = Deck.#getCombinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = Deck.#getCombinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  static #getStraightRanks(combo) {
    const ranks = combo.map(c => (c - 1) % 13).sort((a, b) => b - a);
    const uniqueRanks = [...new Set(ranks)];
    
    // Check for Wheel Straight (A-2-3-4-5)
    if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2) && uniqueRanks.includes(3)) {
      return [3, 2, 1, 0, -1]; // 5, 4, 3, 2, Ace (low)
    }
    
    return uniqueRanks.slice(0, 5);
  }

  static #getGroupRanks(combo, pattern) {
    const counts = Deck.#getRankCounts(Deck.#getParsedCards(combo, []));
    const sortedEntries = Object.entries(counts)
      .map(([rank, count]) => ({ rank: Number(rank), count }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);

    let resultRanks = [];
    for (const group of sortedEntries) {
      for (let i = 0; i < group.count; i++) {
        resultRanks.push(group.rank);
      }
    }
    return resultRanks.slice(0, 5);
  }

  static #evaluate5CardHand(combo) {
    let category = 0;
    let sortedRanks = combo.map(c => (c - 1) % 13).sort((a, b) => b - a);

    if (Deck.checkRoyalFlush(combo, [])) {
      category = 9;
      sortedRanks = [12, 11, 10, 9, 8];
    } else if (Deck.checkStraightFlush(combo, [])) {
      category = 8;
      sortedRanks = Deck.#getStraightRanks(combo);
    } else if (Deck.check4Kind(combo, [])) {
      category = 7;
      sortedRanks = Deck.#getGroupRanks(combo, [4, 1]);
    } else if (Deck.checkFullHouse(combo, [])) {
      category = 6;
      sortedRanks = Deck.#getGroupRanks(combo, [3, 2]);
    } else if (Deck.checkFlush(combo, [])) {
      category = 5;
      sortedRanks = combo.map(c => (c - 1) % 13).sort((a, b) => b - a);
    } else if (Deck.checkStraight(combo, [])) {
      category = 4;
      sortedRanks = Deck.#getStraightRanks(combo);
    } else if (Deck.check3Kind(combo, [])) {
      category = 3;
      sortedRanks = Deck.#getGroupRanks(combo, [3, 1, 1]);
    } else if (Deck.checkTwoPair(combo, [])) {
      category = 2;
      sortedRanks = Deck.#getGroupRanks(combo, [2, 2, 1]);
    } else if (Deck.checkPair(combo, [])) {
      category = 1;
      sortedRanks = Deck.#getGroupRanks(combo, [2, 1, 1, 1]);
    } else {
      category = 0;
      sortedRanks = combo.map(c => (c - 1) % 13).sort((a, b) => b - a);
    }

    let score = category * Math.pow(13, 5);
    for (let i = 0; i < 5; i++) {
      score += sortedRanks[i] * Math.pow(13, 4 - i);
    }
    return score;
  }

  // --- Static Hand Evaluation Methods ---

  static bestHand(hand, commonCards) {
    const allCards = [...hand, ...commonCards];
    const combinations = Deck.#getCombinations(allCards, 5);
    let maxScore = -1;

    for (const combo of combinations) {
      const score = Deck.#evaluate5CardHand(combo);
      if (score > maxScore) {
        maxScore = score;
      }
    }
    return maxScore;
  }

  static checkFlush(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const suitCounts = [0, 0, 0, 0];
    for (const card of cards) {
      suitCounts[card.suit]++;
    }
    const flushSuit = suitCounts.findIndex(count => count >= 5);
    if (flushSuit === -1) return false;

    return cards
      .filter(c => c.suit === flushSuit)
      .map(c => c.rank)
      .sort((a, b) => b - a);
  }

  static checkStraight(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const uniqueRanks = [...new Set(cards.map(c => c.rank))].sort((a, b) => b - a);

    const checkRanks = [...uniqueRanks];
    if (uniqueRanks.includes(12)) {
      checkRanks.push(-1);
    }

    let consecutive = 1;
    for (let i = 0; i < checkRanks.length - 1; i++) {
      if (checkRanks[i] - 1 === checkRanks[i + 1]) {
        consecutive++;
        if (consecutive >= 5) {
          return true;
        }
      } else if (checkRanks[i] !== checkRanks[i + 1]) {
        consecutive = 1;
      }
    }
    return false;
  }

  static checkStraightFlush(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    for (let suit = 0; suit < 4; suit++) {
      const suitCards = cards.filter(c => c.suit === suit);
      if (suitCards.length >= 5) {
        if (Deck.checkStraight([], suitCards.map(c => (c.suit * 13) + c.rank + 1))) {
          return true;
        }
      }
    }
    return false;
  }

  static checkRoyalFlush(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    for (let suit = 0; suit < 4; suit++) {
      const suitRanks = new Set(cards.filter(c => c.suit === suit).map(c => c.rank));
      if (
        suitRanks.has(8) &&
        suitRanks.has(9) &&
        suitRanks.has(10) &&
        suitRanks.has(11) &&
        suitRanks.has(12)
      ) {
        return true;
      }
    }
    return false;
  }

  static check4Kind(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const counts = Deck.#getRankCounts(cards);
    return Object.values(counts).includes(4);
  }

  static checkFullHouse(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const counts = Deck.#getRankCounts(cards);
    const values = Object.values(counts);
    const hasThree = values.includes(3);
    const hasPair = values.filter(v => v >= 2).length >= 2;
    return hasThree && hasPair;
  }

  static check3Kind(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const counts = Deck.#getRankCounts(cards);
    return Object.values(counts).includes(3) && !Deck.checkFullHouse(hand, commonCards);
  }

  static checkTwoPair(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const counts = Deck.#getRankCounts(cards);
    const pairs = Object.values(counts).filter(v => v >= 2);
    return pairs.length >= 2;
  }

  static checkPair(hand, commonCards) {
    const cards = Deck.#getParsedCards(hand, commonCards);
    const counts = Deck.#getRankCounts(cards);
    const pairs = Object.values(counts).filter(v => v === 2);
    const threes = Object.values(counts).filter(v => v === 3);
    return pairs.length === 1 && threes.length === 0 && !Deck.checkTwoPair(hand, commonCards);
  }
}

module.exports = Deck;
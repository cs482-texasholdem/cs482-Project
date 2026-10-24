const Deck = require('./pokerLogic.js');

describe('Deck Class & Poker Hand Evaluator', () => {

  describe('Deck Instance & Methods', () => {
    test('constructor initializes a shuffled deck of 52 unique cards', () => {
      const deck = new Deck();
      expect(deck.deck).toHaveLength(52);
      
      // Ensure all numbers from 1 to 52 are present
      const sortedDeck = [...deck.deck].sort((a, b) => a - b);
      for (let i = 1; i <= 52; i++) {
        expect(sortedDeck[i - 1]).toBe(i);
      }
    });

    test('shuffleCards changes the deck order', () => {
      const deck = new Deck();
      const initialDeckOrder = [...deck.deck];
      deck.shuffleCards();
      const firstShuffle = [...deck.deck];
      deck.shuffleCards();
      const secondShuffle = [...deck.deck];

      expect(initialDeckOrder).toHaveLength(52);
      expect(firstShuffle).toHaveLength(52);
      expect(firstShuffle).not.toEqual(initialDeckOrder);
      expect(secondShuffle).toHaveLength(52);
      expect(secondShuffle).not.toEqual(initialDeckOrder);
      expect(secondShuffle).not.toEqual(firstShuffle);
      // While theoretically a shuffle could match the original, the probability is 1/52!
    });

    test('hand method returns the correct player cards', () => {
      const deck = new Deck();
      const playerHand = deck.hand(0, 4);
      expect(Array.isArray(playerHand)).toBe(true);
      expect(playerHand).toHaveLength(2);
      expect(playerHand[0]).toBe(deck.deck[0]);
      expect(playerHand[1]).toBe(deck.deck[4]);
    });

    test('cardToText correctly maps card numbers to text representations', () => {
      // Hearts (Suit 0: 1 - 13)
      expect(Deck.cardToText(1)).toBe('2♥');
      expect(Deck.cardToText(13)).toBe('A♥');

      // Diamonds (Suit 1: 14 - 26)
      expect(Deck.cardToText(14)).toBe('2♦');
      expect(Deck.cardToText(26)).toBe('A♦');

      // Clubs (Suit 2: 27 - 39)
      expect(Deck.cardToText(27)).toBe('2♣');
      expect(Deck.cardToText(39)).toBe('A♣');

      // Spades (Suit 3: 40 - 52)
      expect(Deck.cardToText(40)).toBe('2♠');
      expect(Deck.cardToText(52)).toBe('A♠');

      // Random middle checks
      expect(Deck.cardToText(8)).toBe('9♥'); // (8-1)%13 = 7 -> '9', Math.floor(7/13) = 0 -> '♥'
      expect(Deck.cardToText(49)).toBe('J♠'); // (49-1)%13 = 11 -> 'K', Math.floor(48/13) = 3 -> '♠'
    });
  });

  describe('Community Card Methods - Robust Validation', () => {
    
    test('community cards have correct lengths for flop, turn, river, and common cards', () => {
      const totalPlayers = 4;
      const deck = new Deck();

      const flop = deck.showFlop(totalPlayers);
      const turn = deck.showTurn(totalPlayers);
      const river = deck.showRiver(totalPlayers);
      const common = deck.commonCards(totalPlayers);

      expect(flop).toHaveLength(3);
      // Handles whether turn/river return as a single element or an array
      expect(Array.isArray(turn) ? turn : [turn]).toHaveLength(1);
      expect(Array.isArray(river) ? river : [river]).toHaveLength(1);
      expect(common).toHaveLength(5);
    });

    test('community cards are unique and contain no duplicates', () => {
      const totalPlayers = 4;
      const deck = new Deck();

      deck.showFlop(totalPlayers);
      deck.showTurn(totalPlayers);
      deck.showRiver(totalPlayers);
      const common = deck.commonCards(totalPlayers);

      const uniqueCommunitySet = new Set(common);
      expect(uniqueCommunitySet.size).toBe(5);
    });

    test('commonCards matches the sequential combination of flop, turn, and river', () => {
      const totalPlayers = 4;
      const deck = new Deck();

      const flop = deck.showFlop(totalPlayers);
      const turn = deck.showTurn(totalPlayers);
      const river = deck.showRiver(totalPlayers);
      const common = deck.commonCards(totalPlayers);

      const turnArray = Array.isArray(turn) ? turn : [turn];
      const riverArray = Array.isArray(river) ? river : [river];
      const allCommunityCards = [...flop, ...turnArray, ...riverArray];

      expect(common).toEqual(allCommunityCards);
    });

    test('community cards do not overlap with any player hands', () => {
      const totalPlayers = 4;
      const deck = new Deck();

      const playerHands = [];
      for (let i = 0; i < totalPlayers; i++) {
        playerHands.push(deck.hand(i, totalPlayers));
      }

      deck.showFlop(totalPlayers);
      deck.showTurn(totalPlayers);
      deck.showRiver(totalPlayers);
      const common = deck.commonCards(totalPlayers);
      const uniqueCommunitySet = new Set(common);

      const allPlayerCards = playerHands.flat();
      allPlayerCards.forEach(card => {
        expect(uniqueCommunitySet.has(card)).toBeFalsy();
      });
    });
  });

  describe('Poker Hand Checkers (Static Methods)', () => {

    test('checkRoyalFlush', () => {
      const validHand = [1, 2]; 
      const validCommon = [9, 10, 11, 12, 13]; 
      expect(Deck.checkRoyalFlush(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [2, 3, 4, 5, 6];
      expect(Deck.checkRoyalFlush(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkStraightFlush', () => {
      const validHand = [5, 6];
      const validCommon = [7, 8, 9, 2, 3];
      expect(Deck.checkStraightFlush(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [20, 21, 3, 23, 24];
      expect(Deck.checkStraightFlush(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('check4Kind', () => {
      const validHand = [1, 14]; 
      const validCommon = [27, 40, 2, 3, 4];
      expect(Deck.check4Kind(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 4, 5, 6, 7];
      expect(Deck.check4Kind(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkFullHouse', () => {
      const validHand = [1, 14];
      const validCommon = [27, 2, 15, 3, 4];
      expect(Deck.checkFullHouse(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 4, 5, 6, 7];
      expect(Deck.checkFullHouse(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkFlush', () => {
      const validHand = [1, 18];
      const validCommon = [9, 13, 17, 2, 3];
      expect(Deck.checkFlush(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 17, 18, 19, 7];
      expect(Deck.checkFlush(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkStraight', () => {
      const validHand = [1, 5];
      const validCommon = [6, 7, 8, 20, 22];
      expect(Deck.checkStraight(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 3];
      const invalidCommon = [10, 25, 40, 4, 5];
      expect(Deck.checkStraight(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('check3Kind', () => {
      const validHand = [1, 14];
      const validCommon = [27, 5, 6, 7, 8];
      expect(Deck.check3Kind(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 4, 5, 6, 7];
      expect(Deck.check3Kind(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkTwoPair', () => {
      const validHand = [1, 14];
      const validCommon = [2, 15, 6, 7, 8];
      expect(Deck.checkTwoPair(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 4, 5, 6, 7];
      expect(Deck.checkTwoPair(invalidHand, invalidCommon)).toBeFalsy();
    });

    test('checkPair', () => {
      const validHand = [1, 14];
      const validCommon = [2, 3, 4, 5, 6];
      expect(Deck.checkPair(validHand, validCommon)).toBeTruthy();

      const invalidHand = [1, 2];
      const invalidCommon = [3, 4, 5, 6, 7];
      expect(Deck.checkPair(invalidHand, invalidCommon)).toBeFalsy();
    });

  });

  describe('bestHand Score Evaluation', () => {

    test('hand hierarchy: Royal Flush scores higher than Straight Flush', () => {
      const royalFlushScore = Deck.bestHand([1, 13], [9, 10, 11, 12, 2]);
      const straightFlushScore = Deck.bestHand([5, 6], [7, 8, 9, 20, 21]);
      expect(royalFlushScore).toBeGreaterThan(straightFlushScore);
    });

    test('hand hierarchy: Straight Flush scores higher than Four of a Kind', () => {
      const straightFlushScore = Deck.bestHand([5, 6], [7, 8, 9, 20, 21]);
      const fourOfAKindScore = Deck.bestHand([1, 14], [27, 40, 2, 3, 4]);
      expect(straightFlushScore).toBeGreaterThan(fourOfAKindScore);
    });

    test('hand hierarchy: Four of a Kind scores higher than Full House', () => {
      const fourOfAKindScore = Deck.bestHand([1, 14], [27, 40, 2, 3, 4]);
      const fullHouseScore = Deck.bestHand([1, 14], [27, 2, 15, 3, 4]);
      expect(fourOfAKindScore).toBeGreaterThan(fullHouseScore);
    });

    test('hand hierarchy: Full House scores higher than Flush', () => {
      const fullHouseScore = Deck.bestHand([1, 14], [27, 2, 15, 3, 4]);
      const flushScore = Deck.bestHand([1, 5], [9, 13, 17, 2, 3]);
      expect(fullHouseScore).toBeGreaterThan(flushScore);
    });

    test('hand hierarchy: Flush scores higher than Straight', () => {
      const flushScore = Deck.bestHand([1, 5], [9, 13, 17, 2, 3]);
      const straightScore = Deck.bestHand([1, 5], [6, 7, 8, 20, 22]);
      expect(flushScore).toBeGreaterThan(straightScore);
    });

    test('hand hierarchy: Straight scores higher than Three of a Kind', () => {
      const straightScore = Deck.bestHand([1, 5], [6, 7, 8, 20, 22]);
      const threeOfAKindScore = Deck.bestHand([1, 14], [27, 5, 6, 20, 8]);
      expect(straightScore).toBeGreaterThan(threeOfAKindScore);
    });

    test('hand hierarchy: Three of a Kind scores higher than Two Pair', () => {
      const threeOfAKindScore = Deck.bestHand([1, 14], [27, 5, 6, 20, 8]);
      const twoPairScore = Deck.bestHand([1, 14], [2, 15, 6, 20, 8]);
      expect(threeOfAKindScore).toBeGreaterThan(twoPairScore);
    });

    test('hand hierarchy: Two Pair scores higher than Pair', () => {
      const twoPairScore = Deck.bestHand([1, 14], [2, 15, 6, 20, 8]);
      const pairScore = Deck.bestHand([1, 14], [2, 21, 4, 23, 6]);
      expect(twoPairScore).toBeGreaterThan(pairScore);
    });

    test('hand hierarchy: Pair scores higher than High Card', () => {
      const pairScore = Deck.bestHand([1, 14], [2, 21, 4, 23, 6]);
      const highCardScore = Deck.bestHand([1, 3], [5, 20, 22, 24, 13]);
      expect(pairScore).toBeGreaterThan(highCardScore);
    });

    test('edge case: Wheel Straight (Ace-low straight: A-2-3-4-5) is evaluated correctly', () => {
      const wheelHand = [1, 2]; 
      const wheelCommon = [3, 4, 5, 20, 25]; 

      const wheelScore = Deck.bestHand(wheelHand, wheelCommon);
      const randomLowHandScore = Deck.bestHand([1, 12], [2, 20, 25, 30, 35]);

      expect(typeof wheelScore).toBe('number');
      expect(wheelScore).toBeGreaterThan(randomLowHandScore);
    });

    test('tie: Royal Flush (Board plays / identical ranking suits)', () => {
      const common = [9, 10, 11, 12, 13];
      const player1Hand = [1, 2];
      const player2Hand = [3, 4];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Straight Flush (Equivalent straight flush values)', () => {
      const commonBoard = [5, 6, 7, 8, 9]; 
      
      const player1Hand = [1, 2]; 
      const player2Hand = [3, 4]; 

      const score1 = Deck.bestHand(player1Hand, commonBoard);
      const score2 = Deck.bestHand(player2Hand, commonBoard);

      expect(score1).toBe(score2);
    });

    test('tie: Four of a Kind (Same quad rank, identical kickers)', () => {
      const common = [27, 40, 2, 3, 5]; 
      const player1Hand = [1, 14];
      const player2Hand = [1, 14];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Full House (Identical trips and pair combination)', () => {
      const common = [2, 15, 3, 4, 6];
      const player1Hand = [1, 14]; 
      const player2Hand = [1, 14];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Flush (Same suit category distribution / identical top flush values)', () => {
      const common = [9, 13, 17, 2, 3];
      const player1Hand = [1, 5];
      const player2Hand = [1, 5];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Straight (Identical straight rank values)', () => {
      const common = [6, 7, 8, 20, 21];
      const player1Hand = [1, 5];
      const player2Hand = [1, 5];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Three of a Kind (Same trips rank and identical kickers)', () => {
      const common = [27, 5, 6, 7, 9];
      const player1Hand = [1, 14];
      const player2Hand = [1, 14];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Two Pair (Same two pair ranks and matching kicker)', () => {
      const common = [2, 15, 6, 7, 9];
      const player1Hand = [1, 14];
      const player2Hand = [1, 14];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: Pair (Same pair rank and identical remaining kickers)', () => {
      const common = [2, 3, 4, 5, 7];
      const player1Hand = [1, 14];
      const player2Hand = [1, 14];

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('tie: High Card (Board plays completely; both players play the board high cards)', () => {
      const common = [9, 10, 11, 12, 13]; 
      
      const player1Hand = [2, 3]; 
      const player2Hand = [4, 5]; 

      const score1 = Deck.bestHand(player1Hand, common);
      const score2 = Deck.bestHand(player2Hand, common);

      expect(score1).toBe(score2);
    });

    test('intra-category comparison: higher Straight Flush beats lower Straight Flush', () => {
      const lowerStraightFlush = Deck.bestHand([1, 2], [3, 4, 5, 20, 25]);
      const higherStraightFlush = Deck.bestHand([4, 5], [6, 7, 8, 20, 25]);
      expect(higherStraightFlush).toBeGreaterThan(lowerStraightFlush);
    });

    test('intra-category comparison: Four of a Kind with higher quad rank beats lower quad rank', () => {
      const lowerQuads = Deck.bestHand([2, 15], [28, 41, 5, 6, 7]); 
      const higherQuads = Deck.bestHand([3, 16], [29, 42, 5, 6, 7]); 
      expect(higherQuads).toBeGreaterThan(lowerQuads);
    });

    test('intra-category comparison: Four of a Kind with same quads but higher kicker beats lower kicker', () => {
      const lowKickerQuads = Deck.bestHand([1, 14], [27, 40, 2, 3, 5]); 
      const highKickerQuads = Deck.bestHand([1, 14], [27, 40, 2, 3, 12]); 
      expect(highKickerQuads).toBeGreaterThan(lowKickerQuads);
    });

    test('intra-category comparison: Full House with higher trips component beats lower trips component', () => {
      const lowerFullHouse = Deck.bestHand([1, 14], [27, 2, 15, 3, 4]); 
      const higherFullHouse = Deck.bestHand([2, 15], [28, 1, 14, 3, 4]); 
      expect(higherFullHouse).toBeGreaterThan(lowerFullHouse);
    });

    test('intra-category comparison: Flush with higher top card beats lower top card', () => {
      const lowerFlush = Deck.bestHand([1, 9], [13, 17, 21, 2, 3]);
      const higherFlush = Deck.bestHand([1, 5], [9, 13, 17, 2, 3]);
      expect(higherFlush).toBeGreaterThan(lowerFlush);
    });

    test('intra-category comparison: higher Straight beats lower Straight', () => {
      const lowerStraight = Deck.bestHand([1, 5], [6, 7, 8, 20, 22]); 
      const higherStraight = Deck.bestHand([5, 9], [10, 11, 12, 20, 22]); 
      expect(higherStraight).toBeGreaterThan(lowerStraight);
    });

    test('intra-category comparison: Three of a Kind with stronger kickers beats weaker kickers', () => {
      const weakKickers = Deck.bestHand([1, 14], [27, 5, 6, 7, 9]);
      const strongKickers = Deck.bestHand([1, 14], [27, 10, 11, 7, 9]);
      expect(strongKickers).toBeGreaterThan(weakKickers);
    });

    test('intra-category comparison: Two Pair with higher second pair beats lower second pair', () => {
      const lowerTwoPair = Deck.bestHand([1, 14], [2, 15, 6, 7, 9]); 
      const higherTwoPair = Deck.bestHand([1, 14], [3, 16, 6, 7, 9]); 
      expect(higherTwoPair).toBeGreaterThan(lowerTwoPair);
    });

    test('intra-category comparison: Pair with higher sequential kickers beats lower kickers', () => {
      const lowerPairKickers = Deck.bestHand([1, 14], [2, 8, 4, 5, 7]);
      const higherPairKickers = Deck.bestHand([1, 14], [2, 10, 11, 12, 7]);
      expect(higherPairKickers).toBeGreaterThan(lowerPairKickers);
    });

    test('intra-category comparison: High Card hand with higher secondary cards beats lower ones', () => {
      const lowerHighCard = Deck.bestHand([1, 4], [7, 10, 16, 19, 22]);
      const higherHighCard = Deck.bestHand([2, 5], [8, 11, 17, 20, 23]);
      expect(higherHighCard).toBeGreaterThan(lowerHighCard);
    });
  });
});
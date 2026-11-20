/**
 * ============================================================================
 * File Name: achievementEvaluator.js
 * Purpose: Evaluates all 20 player achievements server-side using persisted
 *          game history (GameDao), deterministic deck reconstruction (Deck),
 *          and user social data (UserDao).
 * ============================================================================
 */

const GameDao = require("../model/GameDao");
const UserDao = require("../model/UserDao");
const Deck = require("./pokerLogic");

const ACHIEVEMENT_CATALOG = [
    {
        id: "first_blood",
        name: "First Blood",
        shortDesc: "Win your first hand at a table.",
        criteria: "Win at least 1 recorded hand at any table.",
        icon: "bi-droplet-fill",
        theme: "badge-crimson"
    },
    {
        id: "card_shark",
        name: "Card Shark",
        shortDesc: "Win 10 hands overall.",
        criteria: "Win a total of 10 hands across your recorded games.",
        icon: "bi-suit-spade-fill",
        theme: "badge-sapphire"
    },
    {
        id: "high_roller",
        name: "High Roller",
        shortDesc: "Win 50 hands overall.",
        criteria: "Win a total of 50 hands across your recorded games.",
        icon: "bi-gem",
        theme: "badge-emerald"
    },
    {
        id: "rake_it_in",
        name: "Rake It In",
        shortDesc: "Win a single pot of 500 or more chips.",
        criteria: "Win a single hand with a final pot of at least 500 chips.",
        icon: "bi-cash-stack",
        theme: "badge-gold"
    },
    {
        id: "whale_hunter",
        name: "Whale Hunter",
        shortDesc: "Win a single pot of 2,000 or more chips.",
        criteria: "Win a single hand with a final pot of at least 2,000 chips.",
        icon: "bi-trophy-fill",
        theme: "badge-royal-gold"
    },
    {
        id: "hot_streak",
        name: "Hot Streak",
        shortDesc: "Win 3 hands in a row at the same table.",
        criteria: "Achieve 3 consecutive hand wins at the same tableId.",
        icon: "bi-fire",
        theme: "badge-ember"
    },
    {
        id: "showtime",
        name: "Showtime",
        shortDesc: "Win a hand that reaches showdown.",
        criteria: "Win a hand that reaches the River / showdown stage.",
        icon: "bi-eye-fill",
        theme: "badge-violet"
    },
    {
        id: "full_house_club",
        name: "Full House Club",
        shortDesc: "Make a Full House in a hand.",
        criteria: "Form a Full House using hole cards and community cards in a hand.",
        icon: "bi-layers-fill",
        theme: "badge-teal"
    },
    {
        id: "four_of_a_kind",
        name: "Four of a Kind",
        shortDesc: "Make Four of a Kind in a hand.",
        criteria: "Form Four of a Kind using hole cards and community cards in a hand.",
        icon: "bi-grid-3x3-gap-fill",
        theme: "badge-amber"
    },
    {
        id: "straight_shooter",
        name: "Straight Shooter",
        shortDesc: "Make a Straight Flush in a hand.",
        criteria: "Form a Straight Flush using hole cards and community cards in a hand.",
        icon: "bi-lightning-charge-fill",
        theme: "badge-cyan"
    },
    {
        id: "royal_crown",
        name: "Royal Crown",
        shortDesc: "Make a Royal Flush.",
        criteria: "Make a Royal Flush (10-J-Q-K-A of the same suit) in a hand.",
        icon: "bi-crown-fill",
        theme: "badge-royal-purple"
    },
    {
        id: "pocket_rockets",
        name: "Pocket Rockets",
        shortDesc: "Win a hand holding pocket Aces.",
        criteria: "Win a hand after being dealt two Aces (A♥, A♦, A♣, or A♠) as hole cards.",
        icon: "bi-suit-heart-fill",
        theme: "badge-crimson"
    },
    {
        id: "calculated_aggressor",
        name: "Calculated Aggressor",
        shortDesc: "Execute 25 raises across games.",
        criteria: "Perform a total of 25 Raise actions across recorded games.",
        icon: "bi-graph-up-arrow",
        theme: "badge-cobalt"
    },
    {
        id: "ice_cold_call",
        name: "Ice Cold Call",
        shortDesc: "Call an all-in and win the pot.",
        criteria: "Call an all-in / large escalation and win the resulting pot.",
        icon: "bi-snow",
        theme: "badge-ice"
    },
    {
        id: "side_pot_specialist",
        name: "Side-Pot Specialist",
        shortDesc: "Win a side pot after going all-in.",
        criteria: "Go all-in and win a pot/hand involving multi-player action.",
        icon: "bi-diagram-3-fill",
        theme: "badge-bronze"
    },
    {
        id: "pre_flop_blitz",
        name: "Pre-Flop Blitz",
        shortDesc: "Win a pot pre-flop before community cards are dealt.",
        criteria: "Win a hand while the action round is still Pre-Flop with no community cards dealt.",
        icon: "bi-speedometer2",
        theme: "badge-lime"
    },
    {
        id: "iron_seat",
        name: "Iron Seat",
        shortDesc: "Participate in 25 completed hands.",
        criteria: "Play in at least 25 completed hands.",
        icon: "bi-shield-shaded",
        theme: "badge-steel"
    },
    {
        id: "friendly_table",
        name: "Friendly Table",
        shortDesc: "Add your first friend.",
        criteria: "Have at least 1 friend on your friends list.",
        icon: "bi-person-plus-fill",
        theme: "badge-mint"
    },
    {
        id: "social_butterfly",
        name: "Social Butterfly",
        shortDesc: "Build a friends list of 5 players.",
        criteria: "Have at least 5 friends on your friends list.",
        icon: "bi-people-fill",
        theme: "badge-magenta"
    },
    {
        id: "veteran_grinder",
        name: "Veteran Grinder",
        shortDesc: "Reach 100 total hands played across your account.",
        criteria: "Participate in 100 total hands across your account.",
        icon: "bi-award-fill",
        theme: "badge-platinum"
    }
];

function isPocketAces(holeCards) {
    if (!Array.isArray(holeCards) || holeCards.length < 2) return false;
    return holeCards.every(card => typeof card === "number" && ((card - 1) % 13) === 12);
}

function reconstructGameCards(game, playerId) {
    if (!game || !game.shuffleSeed || !Array.isArray(game.initialPlayers)) {
        return { holeCards: [], boardCards: [] };
    }
    const playerIndex = game.initialPlayers.indexOf(playerId);
    const totalPlayers = game.initialPlayers.length;
    if (playerIndex === -1 || totalPlayers < 2) {
        return { holeCards: [], boardCards: [] };
    }

    try {
        const deck = new Deck(game.shuffleSeed);
        const holeCards = deck.hand(playerIndex, totalPlayers);
        const actions = Array.isArray(game.actions) ? game.actions : [];

        const hasRiver = actions.some(a => a.round === "River");
        const hasTurn = hasRiver || actions.some(a => a.round === "Turn");
        const hasFlop = hasTurn || actions.some(a => a.round === "Flop");

        let boardCards = [];
        if (hasRiver) {
            boardCards = deck.commonCards(totalPlayers);
        } else if (hasTurn) {
            boardCards = [...deck.showFlop(totalPlayers), deck.showTurn(totalPlayers)];
        } else if (hasFlop) {
            boardCards = deck.showFlop(totalPlayers);
        }

        return { holeCards, boardCards };
    } catch (_) {
        return { holeCards: [], boardCards: [] };
    }
}

async function evaluatePlayerAchievements(playerId) {
    const cleanId = typeof playerId === "string" ? playerId.trim() : "";
    const allGames = cleanId ? await GameDao.readAll() : [];

    const chronologicalGames = [...allGames]
        .filter(g => Array.isArray(g.initialPlayers) && g.initialPlayers.includes(cleanId))
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    let userDoc = null;
    if (cleanId) {
        userDoc = await UserDao.findOne({
            $or: [{ username: cleanId }, { email: cleanId }]
        });
    }

    let handsPlayed = chronologicalGames.length;
    let handsWon = 0;
    let maxPotWon = 0;
    let totalRaises = 0;
    let maxStreakAtSameTable = 0;
    const tableStreaks = new Map();

    let unlockedFirstBlood = false;
    let unlockedShowtime = false;
    let unlockedFullHouse = false;
    let unlockedFourOfAKind = false;
    let unlockedStraightFlush = false;
    let unlockedRoyalFlush = false;
    let unlockedPocketRockets = false;
    let unlockedIceColdCall = false;
    let unlockedSidePotSpecialist = false;
    let unlockedPreFlopBlitz = false;

    for (const game of chronologicalGames) {
        const wonHand = Array.isArray(game.winners) && game.winners.includes(cleanId);
        const potFinal = Number(game.potFinal) || 0;
        const actions = Array.isArray(game.actions) ? game.actions : [];
        const tableKey = game.tableId || "main";

        if (wonHand) {
            handsWon++;
            unlockedFirstBlood = true;
            if (potFinal > maxPotWon) {
                maxPotWon = potFinal;
            }
            const nextStreak = (tableStreaks.get(tableKey) || 0) + 1;
            tableStreaks.set(tableKey, nextStreak);
            if (nextStreak > maxStreakAtSameTable) {
                maxStreakAtSameTable = nextStreak;
            }
        } else {
            tableStreaks.set(tableKey, 0);
        }

        const playerActions = actions.filter(a => a.playerId === cleanId);
        const playerRaises = playerActions.filter(a => a.action === "Raise").length;
        totalRaises += playerRaises;

        const reachedRiverOrShowdown = actions.some(a => a.round === "River");
        if (wonHand && reachedRiverOrShowdown) {
            unlockedShowtime = true;
        }

        const onlyPreFlopActions =
            actions.length > 0 &&
            actions.every(a => !a.round || a.round === "Pre-Flop");
        if (wonHand && onlyPreFlopActions) {
            unlockedPreFlopBlitz = true;
        }

        const { holeCards, boardCards } = reconstructGameCards(game, cleanId);
        if (holeCards.length === 2 && boardCards.length >= 3) {
            if (Deck.checkFullHouse(holeCards, boardCards)) {
                unlockedFullHouse = true;
            }
            if (Deck.check4Kind(holeCards, boardCards)) {
                unlockedFourOfAKind = true;
            }
            if (Deck.checkStraightFlush(holeCards, boardCards)) {
                unlockedStraightFlush = true;
            }
            if (Deck.checkRoyalFlush(holeCards, boardCards)) {
                unlockedRoyalFlush = true;
            }
        }

        if (wonHand && isPocketAces(holeCards)) {
            unlockedPocketRockets = true;
        }

        const didCall = playerActions.some(a => a.action === "Call");
        const hadLargeEscalation = actions.some(a => a.action === "Raise" && (Number(a.amount) || 0) >= 200);
        if (wonHand && didCall && hadLargeEscalation) {
            unlockedIceColdCall = true;
        }

        const didRaise = playerActions.some(a => a.action === "Raise");
        if (wonHand && didRaise && potFinal >= 300) {
            unlockedSidePotSpecialist = true;
        }
    }

    const friendsCount = Array.isArray(userDoc?.friends) ? userDoc.friends.length : 0;

    const progressMap = {
        first_blood: { completed: unlockedFirstBlood, progressText: `${handsWon} / 1 win` },
        card_shark: { completed: handsWon >= 10, progressText: `${handsWon} / 10 wins` },
        high_roller: { completed: handsWon >= 50, progressText: `${handsWon} / 50 wins` },
        rake_it_in: { completed: maxPotWon >= 500, progressText: `Best pot: ${maxPotWon} / 500` },
        whale_hunter: { completed: maxPotWon >= 2000, progressText: `Best pot: ${maxPotWon} / 2,000` },
        hot_streak: { completed: maxStreakAtSameTable >= 3, progressText: `Best streak: ${maxStreakAtSameTable} / 3` },
        showtime: { completed: unlockedShowtime, progressText: unlockedShowtime ? "Unlocked" : "Not yet won at showdown" },
        full_house_club: { completed: unlockedFullHouse, progressText: unlockedFullHouse ? "Unlocked" : "No Full House made" },
        four_of_a_kind: { completed: unlockedFourOfAKind, progressText: unlockedFourOfAKind ? "Unlocked" : "No Four of a Kind made" },
        straight_shooter: { completed: unlockedStraightFlush, progressText: unlockedStraightFlush ? "Unlocked" : "No Straight Flush made" },
        royal_crown: { completed: unlockedRoyalFlush, progressText: unlockedRoyalFlush ? "Unlocked" : "No Royal Flush made" },
        pocket_rockets: { completed: unlockedPocketRockets, progressText: unlockedPocketRockets ? "Unlocked" : "No pocket Aces win" },
        calculated_aggressor: { completed: totalRaises >= 25, progressText: `${totalRaises} / 25 raises` },
        ice_cold_call: { completed: unlockedIceColdCall, progressText: unlockedIceColdCall ? "Unlocked" : "Not yet completed" },
        side_pot_specialist: { completed: unlockedSidePotSpecialist, progressText: unlockedSidePotSpecialist ? "Unlocked" : "Not yet completed" },
        pre_flop_blitz: { completed: unlockedPreFlopBlitz, progressText: unlockedPreFlopBlitz ? "Unlocked" : "Not yet completed" },
        iron_seat: { completed: handsPlayed >= 25, progressText: `${handsPlayed} / 25 hands` },
        friendly_table: { completed: friendsCount >= 1, progressText: `${friendsCount} / 1 friend` },
        social_butterfly: { completed: friendsCount >= 5, progressText: `${friendsCount} / 5 friends` },
        veteran_grinder: { completed: handsPlayed >= 100, progressText: `${handsPlayed} / 100 hands` }
    };

    const achievements = ACHIEVEMENT_CATALOG.map(item => {
        const status = progressMap[item.id] || { completed: false, progressText: "0" };
        return {
            ...item,
            completed: Boolean(status.completed),
            progressText: status.progressText
        };
    });

    const completedAchievements = achievements.filter(a => a.completed);

    return {
        playerId: cleanId,
        totalCount: achievements.length,
        completedCount: completedAchievements.length,
        achievements,
        completedAchievements
    };
}

module.exports = {
    ACHIEVEMENT_CATALOG,
    evaluatePlayerAchievements
};
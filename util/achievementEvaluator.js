/**
 * ============================================================================
 * File Name: achievementEvaluator.js
 * Purpose: Evaluates all 20 player achievements server-side using persisted
 *          game history (GameDao), deterministic deck reconstruction (Deck),
 *          and user social data (UserDao), returning structured progress data.
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
        theme: "badge-crimson",
        target: 1
    },
    {
        id: "card_shark",
        name: "Card Shark",
        shortDesc: "Win 10 hands overall.",
        criteria: "Win a total of 10 hands across your recorded games.",
        icon: "bi-suit-spade-fill",
        theme: "badge-sapphire",
        target: 10
    },
    {
        id: "high_roller",
        name: "High Roller",
        shortDesc: "Win 50 hands overall.",
        criteria: "Win a total of 50 hands across your recorded games.",
        icon: "bi-gem",
        theme: "badge-emerald",
        target: 50
    },
    {
        id: "rake_it_in",
        name: "Rake It In",
        shortDesc: "Win a single pot of 500 or more chips.",
        criteria: "Win a single hand with a final pot of at least 500 chips.",
        icon: "bi-cash-stack",
        theme: "badge-gold",
        target: 500
    },
    {
        id: "whale_hunter",
        name: "Whale Hunter",
        shortDesc: "Win a single pot of 2,000 or more chips.",
        criteria: "Win a single hand with a final pot of at least 2,000 chips.",
        icon: "bi-trophy-fill",
        theme: "badge-royal-gold",
        target: 2000
    },
    {
        id: "hot_streak",
        name: "Hot Streak",
        shortDesc: "Win 3 hands in a row at the same table.",
        criteria: "Achieve 3 consecutive hand wins at the same tableId.",
        icon: "bi-fire",
        theme: "badge-ember",
        target: 3
    },
    {
        id: "showtime",
        name: "Showtime",
        shortDesc: "Win a hand that reaches showdown.",
        criteria: "Win a hand that reaches the River / showdown stage.",
        icon: "bi-eye-fill",
        theme: "badge-violet",
        target: 1
    },
    {
        id: "full_house_club",
        name: "Full House Club",
        shortDesc: "Make a Full House in a hand.",
        criteria: "Form a Full House using hole cards and community cards in a hand.",
        icon: "bi-layers-fill",
        theme: "badge-teal",
        target: 1
    },
    {
        id: "four_of_a_kind",
        name: "Four of a Kind",
        shortDesc: "Make Four of a Kind in a hand.",
        criteria: "Form Four of a Kind using hole cards and community cards in a hand.",
        icon: "bi-grid-3x3-gap-fill",
        theme: "badge-amber",
        target: 1
    },
    {
        id: "straight_shooter",
        name: "Straight Shooter",
        shortDesc: "Make a Straight Flush in a hand.",
        criteria: "Form a Straight Flush using hole cards and community cards in a hand.",
        icon: "bi-lightning-charge-fill",
        theme: "badge-cyan",
        target: 1
    },
    {
        id: "royal_crown",
        name: "Royal Crown",
        shortDesc: "Make a Royal Flush.",
        criteria: "Make a Royal Flush (10-J-Q-K-A of the same suit) in a hand.",
        icon: "bi-crown-fill",
        theme: "badge-royal-purple",
        target: 1
    },
    {
        id: "pocket_rockets",
        name: "Pocket Rockets",
        shortDesc: "Win a hand holding pocket Aces.",
        criteria: "Win a hand after being dealt two Aces (A♥, A♦, A♣, or A♠) as hole cards.",
        icon: "bi-suit-heart-fill",
        theme: "badge-crimson",
        target: 1
    },
    {
        id: "calculated_aggressor",
        name: "Calculated Aggressor",
        shortDesc: "Execute 25 raises across games.",
        criteria: "Perform a total of 25 Raise actions across recorded games.",
        icon: "bi-graph-up-arrow",
        theme: "badge-cobalt",
        target: 25
    },
    {
        id: "ice_cold_call",
        name: "Ice Cold Call",
        shortDesc: "Call an all-in and win the pot.",
        criteria: "Call an all-in / large escalation and win the resulting pot.",
        icon: "bi-snow",
        theme: "badge-ice",
        target: 1
    },
    {
        id: "side_pot_specialist",
        name: "Side-Pot Specialist",
        shortDesc: "Win a side pot after going all-in.",
        criteria: "Go all-in and win a pot/hand involving multi-player action.",
        icon: "bi-diagram-3-fill",
        theme: "badge-bronze",
        target: 1
    },
    {
        id: "pre_flop_blitz",
        name: "Pre-Flop Blitz",
        shortDesc: "Win a pot pre-flop before community cards are dealt.",
        criteria: "Win a hand while the action round is still Pre-Flop with no community cards dealt.",
        icon: "bi-speedometer2",
        theme: "badge-lime",
        target: 1
    },
    {
        id: "iron_seat",
        name: "Iron Seat",
        shortDesc: "Participate in 25 completed hands.",
        criteria: "Play in at least 25 completed hands.",
        icon: "bi-shield-shaded",
        theme: "badge-steel",
        target: 25
    },
    {
        id: "friendly_table",
        name: "Friendly Table",
        shortDesc: "Add your first friend.",
        criteria: "Have at least 1 friend on your friends list.",
        icon: "bi-person-plus-fill",
        theme: "badge-mint",
        target: 1
    },
    {
        id: "social_butterfly",
        name: "Social Butterfly",
        shortDesc: "Build a friends list of 5 players.",
        criteria: "Have at least 5 friends on your friends list.",
        icon: "bi-people-fill",
        theme: "badge-magenta",
        target: 5
    },
    {
        id: "veteran_grinder",
        name: "Veteran Grinder",
        shortDesc: "Reach 100 total hands played across your account.",
        criteria: "Participate in 100 total hands across your account.",
        icon: "bi-award-fill",
        theme: "badge-platinum",
        target: 100
    }
];

function normalizeId(val) {
    return typeof val === "string" ? val.trim().toLowerCase() : "";
}

function includesPlayer(list, targetLower) {
    if (!Array.isArray(list) || !targetLower) return false;
    return list.some(item => normalizeId(item) === targetLower);
}

function isPocketAces(holeCards) {
    if (!Array.isArray(holeCards) || holeCards.length < 2) return false;
    return holeCards.every(card => typeof card === "number" && ((card - 1) % 13) === 12);
}

function reconstructGameCards(game, targetLower) {
    if (!game || !game.shuffleSeed || !Array.isArray(game.initialPlayers)) {
        return { holeCards: [], boardCards: [] };
    }
    const playerIndex = game.initialPlayers.findIndex(p => normalizeId(p) === targetLower);
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

function buildProgressEntry(current, target, unitLabel, booleanUnlockedText = "Unlocked", booleanLockedText = "Locked") {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const completed = safeCurrent >= safeTarget;
    const percent = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));

    let progressText;
    if (safeTarget === 1 && unitLabel === "flag") {
        progressText = completed ? booleanUnlockedText : booleanLockedText;
    } else {
        progressText = `${Math.min(safeCurrent, safeTarget).toLocaleString()} / ${safeTarget.toLocaleString()} ${unitLabel}`;
    }

    return {
        current: safeCurrent,
        target: safeTarget,
        percent,
        completed,
        progressText
    };
}

async function evaluatePlayerAchievements(playerId) {
    const cleanId = typeof playerId === "string" ? playerId.trim() : "";
    const targetLower = normalizeId(cleanId);

    const allGames = targetLower ? await GameDao.readAll() : [];

    const chronologicalGames = [...allGames]
        .filter(g => includesPlayer(g.initialPlayers, targetLower))
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    let userDoc = null;
    if (cleanId) {
        userDoc = await UserDao.findOne({
            $or: [
                { username: new RegExp(`^${escapeRegExp(cleanId)}$`, "i") },
                { email: new RegExp(`^${escapeRegExp(cleanId)}$`, "i") }
            ]
        });
    }

    const handsPlayed = chronologicalGames.length;
    let handsWon = 0;
    let maxPotWon = 0;
    let totalRaises = 0;
    let maxStreakAtSameTable = 0;
    const tableStreaks = new Map();

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
        const wonHand = includesPlayer(game.winners, targetLower);
        const potFinal = Number(game.potFinal) || 0;
        const actions = Array.isArray(game.actions) ? game.actions : [];
        const tableKey = game.tableId || "main";

        if (wonHand) {
            handsWon++;
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

        const playerActions = actions.filter(a => normalizeId(a.playerId) === targetLower);
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

        const { holeCards, boardCards } = reconstructGameCards(game, targetLower);
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
        first_blood: buildProgressEntry(handsWon, 1, "wins"),
        card_shark: buildProgressEntry(handsWon, 10, "wins"),
        high_roller: buildProgressEntry(handsWon, 50, "wins"),
        rake_it_in: buildProgressEntry(maxPotWon, 500, "chips"),
        whale_hunter: buildProgressEntry(maxPotWon, 2000, "chips"),
        hot_streak: buildProgressEntry(maxStreakAtSameTable, 3, "streak"),
        showtime: buildProgressEntry(unlockedShowtime ? 1 : 0, 1, "flag", "Showdown Win", "Pending"),
        full_house_club: buildProgressEntry(unlockedFullHouse ? 1 : 0, 1, "flag", "Full House Made", "Pending"),
        four_of_a_kind: buildProgressEntry(unlockedFourOfAKind ? 1 : 0, 1, "flag", "Quads Made", "Pending"),
        straight_shooter: buildProgressEntry(unlockedStraightFlush ? 1 : 0, 1, "flag", "Straight Flush", "Pending"),
        royal_crown: buildProgressEntry(unlockedRoyalFlush ? 1 : 0, 1, "flag", "Royal Flush", "Pending"),
        pocket_rockets: buildProgressEntry(unlockedPocketRockets ? 1 : 0, 1, "flag", "Pocket Aces Win", "Pending"),
        calculated_aggressor: buildProgressEntry(totalRaises, 25, "raises"),
        ice_cold_call: buildProgressEntry(unlockedIceColdCall ? 1 : 0, 1, "flag", "All-In Call Win", "Pending"),
        side_pot_specialist: buildProgressEntry(unlockedSidePotSpecialist ? 1 : 0, 1, "flag", "Side-Pot Win", "Pending"),
        pre_flop_blitz: buildProgressEntry(unlockedPreFlopBlitz ? 1 : 0, 1, "flag", "Pre-Flop Win", "Pending"),
        iron_seat: buildProgressEntry(handsPlayed, 25, "hands"),
        friendly_table: buildProgressEntry(friendsCount, 1, "friends"),
        social_butterfly: buildProgressEntry(friendsCount, 5, "friends"),
        veteran_grinder: buildProgressEntry(handsPlayed, 100, "hands")
    };

    const achievements = ACHIEVEMENT_CATALOG.map(item => {
        const status = progressMap[item.id] || {
            current: 0,
            target: item.target || 1,
            percent: 0,
            completed: false,
            progressText: "0"
        };
        return {
            ...item,
            completed: status.completed,
            current: status.current,
            target: status.target,
            percent: status.percent,
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

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
    ACHIEVEMENT_CATALOG,
    evaluatePlayerAchievements
};
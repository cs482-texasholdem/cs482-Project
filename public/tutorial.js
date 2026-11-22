/**
 * ============================================================================
 * File Name: tutorial.js
 * Purpose: Interactive controller for tutorial.html. Manages timeline navigation,
 *          section skipping, hand hierarchy & optional tie-breaker inspection,
 *          step-by-step control walkthrough, blinds rotation preview, mucking
 *          preview, a curated guided hand with bots, and an unlimited multi-
 *          difficulty bot practice engine with full 5-of-7 hand evaluation.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    initTimelineNavigation();
    initHandRankingsSection();
    initControlsWalkthrough();
    initBlindsPreview();
    initMuckingPreview();
    initGuidedHand();
    initBotPracticeEngine();
});

// ============================================================================
// 1. Timeline Navigation & Skip Controls
// ============================================================================

let currentTutorialStep = 0;
const TOTAL_STEPS = 7;

function initTimelineNavigation() {
    const timelineBtns = document.querySelectorAll("#tutorialTimeline .timeline-step-btn");
    timelineBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetStep = Number(btn.dataset.step);
            if (Number.isInteger(targetStep)) {
                goToTutorialStep(targetStep);
            }
        });
    });

    document.querySelectorAll("[data-next-step]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (currentTutorialStep < TOTAL_STEPS - 1) {
                goToTutorialStep(currentTutorialStep + 1);
            }
        });
    });

    document.querySelectorAll("[data-prev-step]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (currentTutorialStep > 0) {
                goToTutorialStep(currentTutorialStep - 1);
            }
        });
    });

    document.querySelectorAll("[data-skip-section]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const nextStep = Math.min(TOTAL_STEPS - 1, currentTutorialStep + 1);
            goToTutorialStep(nextStep);
        });
    });

    const skipTutorialBtn = document.getElementById("skipTutorialBtn");
    if (skipTutorialBtn) {
        skipTutorialBtn.addEventListener("click", () => {
            window.location.href = "lobby.html";
        });
    }

    goToTutorialStep(0);
}

function goToTutorialStep(stepIndex) {
    currentTutorialStep = Math.max(0, Math.min(TOTAL_STEPS - 1, stepIndex));

    document.querySelectorAll("[data-step-panel]").forEach((panel) => {
        const idx = Number(panel.dataset.stepPanel);
        panel.classList.toggle("d-none", idx !== currentTutorialStep);
    });

    document.querySelectorAll("#tutorialTimeline .timeline-step-btn").forEach((btn) => {
        const idx = Number(btn.dataset.step);
        btn.classList.toggle("active", idx === currentTutorialStep);
        btn.classList.toggle("completed", idx < currentTutorialStep);
    });

    const progressLabel = document.getElementById("tutorialProgressLabel");
    if (progressLabel) {
        progressLabel.textContent = `Step ${currentTutorialStep + 1} of ${TOTAL_STEPS}`;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// Card Rendering Helper
// ============================================================================

function createCardElement(cardText, faceDown = false) {
    const el = document.createElement("div");
    el.className = "playing-card-mini";
    if (faceDown) {
        el.classList.add("face-down");
        el.textContent = "🂠";
        return el;
    }
    if (cardText.includes("♥") || cardText.includes("♦")) {
        el.classList.add("red");
    }
    el.textContent = cardText;
    return el;
}

function renderCardRow(container, cards, faceDown = false) {
    if (!container) return;
    container.textContent = "";
    cards.forEach((c) => {
        container.appendChild(createCardElement(c, faceDown));
    });
}

// ============================================================================
// 2. Hand Rankings & Optional Tie-Breaking Inspector
// ============================================================================

const HAND_RANKINGS_DATA = [
    {
        rank: 1,
        name: "Royal Flush",
        shortDesc: "A, K, Q, J, 10 all of the exact same suit.",
        cards: ["A♠", "K♠", "Q♠", "J♠", "10♠"],
        tieBreaker: "Suits have equal value in Texas Hold'em. If two players share a Royal Flush on the community board, they split the pot equally."
    },
    {
        rank: 2,
        name: "Straight Flush",
        shortDesc: "Five consecutive cards all of the same suit.",
        cards: ["9♥", "8♥", "7♥", "6♥", "5♥"],
        tieBreaker: "The Straight Flush with the highest top card wins (e.g., 9-high beats 8-high). An Ace-to-5 ('steel wheel') is the lowest Straight Flush."
    },
    {
        rank: 3,
        name: "Four of a Kind (Quads)",
        shortDesc: "All four cards of the same rank plus one side card (kicker).",
        cards: ["Q♠", "Q♥", "Q♦", "Q♣", "7♠"],
        tieBreaker: "Higher four-of-a-kind rank wins (e.g., Quad Kings beat Quad Queens). If both players use four-of-a-kind from the board, the highest 5th card (kicker) wins."
    },
    {
        rank: 4,
        name: "Full House",
        shortDesc: "Three of a kind combined with a pair.",
        cards: ["K♠", "K♥", "K♦", "9♣", "9♠"],
        tieBreaker: "First compare the Three-of-a-Kind rank (e.g., Kings full of 2s beats Queens full of Aces). If tied, the higher Pair wins."
    },
    {
        rank: 5,
        name: "Flush",
        shortDesc: "Any five cards of the same suit, not in sequence.",
        cards: ["A♦", "J♦", "8♦", "4♦", "2♦"],
        tieBreaker: "Compare the highest card first, then the second-highest, down to the fifth card. Suits never break ties."
    },
    {
        rank: 6,
        name: "Straight",
        shortDesc: "Five consecutive cards of mixed suits.",
        cards: ["10♣", "9♦", "8♥", "7♠", "6♣"],
        tieBreaker: "The Straight ending in the highest rank wins. Ace can play high (A-K-Q-J-10) or low (5-4-3-2-A), never wrapping around (K-A-2-3-4 is invalid)."
    },
    {
        rank: 7,
        name: "Three of a Kind (Trips / Set)",
        shortDesc: "Three cards of the same rank and two unrelated side cards.",
        cards: ["8♠", "8♥", "8♦", "A♣", "5♠"],
        tieBreaker: "Higher three-of-a-kind rank wins. If both players share the same trips on the board, the highest 4th card (kicker), then 5th card, breaks the tie."
    },
    {
        rank: 8,
        name: "Two Pair",
        shortDesc: "Two distinct pairs plus one kicker.",
        cards: ["J♠", "J♦", "4♣", "4♥", "A♠"],
        tieBreaker: "Compare the higher pair first; if equal, compare the lower pair; if both pairs match, the 5th card (kicker) decides the winner."
    },
    {
        rank: 9,
        name: "One Pair",
        shortDesc: "Two cards of matching rank plus three kickers.",
        cards: ["10♥", "10♠", "K♦", "7♣", "3♥"],
        tieBreaker: "Higher pair wins. If both players have the same pair, compare the highest kicker, then second, then third kicker."
    },
    {
        rank: 10,
        name: "High Card",
        shortDesc: "When no player makes a pair or better.",
        cards: ["A♣", "Q♦", "9♠", "6♥", "2♣"],
        tieBreaker: "Compare each player's highest card down through their 5th best card. Only the top 5 cards count."
    }
];

function initHandRankingsSection() {
    const listContainer = document.getElementById("handRankingsList");
    if (!listContainer) return;

    HAND_RANKINGS_DATA.forEach((hand) => {
        const item = document.createElement("div");
        item.className = "hand-rank-item d-flex justify-content-between align-items-center gap-2";
        item.dataset.handRank = String(hand.rank);

        const left = document.createElement("div");
        const titleRow = document.createElement("div");
        titleRow.className = "fw-bold text-white";
        titleRow.textContent = `#${hand.rank} · ${hand.name}`;

        const desc = document.createElement("div");
        desc.className = "small text-white opacity-75";
        desc.textContent = hand.shortDesc;

        left.append(titleRow, desc);

        const right = document.createElement("div");
        right.className = "d-flex align-items-center gap-1 flex-shrink-0";
        hand.cards.forEach((c) => {
            const badge = document.createElement("span");
            const isRed = c.includes("♥") || c.includes("♦");
            badge.className = `badge ${isRed ? "bg-danger" : "bg-light text-dark"}`;
            badge.textContent = c;
            right.appendChild(badge);
        });

        item.append(left, right);
        item.addEventListener("click", () => selectHandDetail(hand, item));
        listContainer.appendChild(item);
    });
}

function selectHandDetail(hand, selectedElement) {
    document.querySelectorAll(".hand-rank-item").forEach((el) => el.classList.remove("selected"));
    if (selectedElement) selectedElement.classList.add("selected");

    const titleEl = document.getElementById("detailHandTitle");
    const summaryEl = document.getElementById("detailHandSummary");
    const cardsEl = document.getElementById("detailHandCards");
    const tieEl = document.getElementById("detailHandTieBreaker");

    if (titleEl) titleEl.textContent = `#${hand.rank} — ${hand.name}`;
    if (summaryEl) summaryEl.textContent = hand.shortDesc;
    if (tieEl) tieEl.textContent = hand.tieBreaker;
    renderCardRow(cardsEl, hand.cards, false);
}

// ============================================================================
// 3. Step-by-Step App Controls & Betting Rules Walkthrough
// ============================================================================

const CONTROL_STEPS = [ // TODO: Match UI of actual gameplay
    {
        targetId: "demo-bet-summary",
        title: "1. Bet Summary Bar (Current Bet & Chips Available)",
        desc: "Before acting, check 'Current Highest Bet' ($20 here) vs. 'Your Current Bet' ($0). To stay in the hand, your total bet for the round must match the Current Highest Bet."
    },
    {
        targetId: "demo-btn-fold",
        title: "2. Fold Button",
        desc: "Clicking 'Fold' forfeits your cards and exits the current hand immediately. You lose any chips you already put into the pot, but you risk nothing further."
    },
    {
        targetId: "demo-btn-check",
        title: "3. Check Button",
        desc: "Clicking 'Check' passes the action to the next player without betting any chips. You can ONLY Check when Your Current Bet already equals the Current Highest Bet (for example, $0 vs. $0)."
    },
    {
        targetId: "demo-btn-call",
        title: "4. Call Button",
        desc: "When another player has bet or raised ($20 here), 'Check' is disabled. Clicking 'Call' matches the Current Highest Bet so you stay in the round."
    },
    {
        targetId: "demo-raise-controls",
        title: "5. Raise Amount Input & Slider",
        desc: "Use the number input or slider to choose a total bet higher than the Current Highest Bet. A valid raise must increase the bet by at least the previous raise increment (or Big Blind)."
    },
    {
        targetId: "demo-btn-raise",
        title: "6. Raise Button",
        desc: "Clicking 'Raise' commits your chosen raise amount to the pot and forces every remaining player to either Call your new higher bet, Re-Raise, or Fold."
    }
];

let currentControlIdx = 0;

function initControlsWalkthrough() {
    const prevBtn = document.getElementById("prevControlTourBtn");
    const nextBtn = document.getElementById("nextControlTourBtn");
    const raiseInput = document.getElementById("demo-raise-amount");
    const betScale = document.getElementById("demo-bet-scale");
    const raiseBtn = document.getElementById("demo-btn-raise");
    const feedback = document.getElementById("demo-control-feedback");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            currentControlIdx = (currentControlIdx - 1 + CONTROL_STEPS.length) % CONTROL_STEPS.length;
            renderControlTourStep();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            currentControlIdx = (currentControlIdx + 1) % CONTROL_STEPS.length;
            renderControlTourStep();
        });
    }

    if (betScale && raiseInput && raiseBtn) {
        betScale.addEventListener("input", () => {
            raiseInput.value = betScale.value;
            raiseBtn.textContent = `Raise to $${betScale.value}`;
        });
        raiseInput.addEventListener("input", () => {
            const val = Math.max(40, Math.min(1000, Number(raiseInput.value) || 40));
            betScale.value = String(val);
            raiseBtn.textContent = `Raise to $${val}`;
        });
    }

    document.getElementById("demo-btn-fold")?.addEventListener("click", () => {
        if (feedback) feedback.textContent = "Fold clicked: You mucked your hand and exited the round without risking more chips.";
    });
    document.getElementById("demo-btn-check")?.addEventListener("click", () => {
        if (feedback) feedback.textContent = "Check clicked: In a live hand, Check is only enabled when Current Highest Bet equals Your Current Bet ($20 is owed right now, so Call or Raise is required).";
    });
    document.getElementById("demo-btn-call")?.addEventListener("click", () => {
        if (feedback) feedback.textContent = "Call clicked: You matched the $20 bet! Your bet is now $20 and your remaining chips are $980.";
    });
    raiseBtn?.addEventListener("click", () => {
        const amt = Number(raiseInput?.value) || 40;
        if (feedback) feedback.textContent = `Raise clicked: You raised the bet to $${amt}! Opponents must now match $${amt} or fold.`;
    });

    renderControlTourStep();
}

function renderControlTourStep() {
    const step = CONTROL_STEPS[currentControlIdx];
    document.querySelectorAll(".control-spotlight").forEach((el) => el.classList.remove("control-spotlight"));

    const target = document.getElementById(step.targetId);
    if (target) target.classList.add("control-spotlight");

    const counterEl = document.getElementById("controlTourCounter");
    const titleEl = document.getElementById("controlTourTitle");
    const descEl = document.getElementById("controlTourDesc");

    if (counterEl) counterEl.textContent = `Control ${currentControlIdx + 1} of ${CONTROL_STEPS.length}`;
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.textContent = step.desc;
}

// ============================================================================
// 4. Blinds Rotation Preview
// ============================================================================

function initBlindsPreview() { // TODO: Make more interactive by showing actual table.
    const rotations = [
        "Hand #1: You are Dealer (D), Bot A posts Small Blind ($10), Bot B posts Big Blind ($20). You act first Pre-Flop!",
        "Hand #2: Bot A is Dealer (D), Bot B posts Small Blind ($10), You post Big Blind ($20). You act last Pre-Flop!",
        "Hand #3: Bot B is Dealer (D), You post Small Blind ($10), Bot A posts Big Blind ($20)."
    ];
    let idx = 0;

    const btn = document.getElementById("rotateBlindsBtn");
    const summary = document.getElementById("blindRotationSummary");
    if (btn && summary) {
        btn.addEventListener("click", () => {
            idx = (idx + 1) % rotations.length;
            summary.textContent = rotations[idx];
        });
    }
}

// ============================================================================
// 5. Mucking Mechanics Preview
// ============================================================================

function initMuckingPreview() {
    const toggle = document.getElementById("tutorialMuckSwitch");
    const cardsBox = document.getElementById("muckPreviewCards");
    const statusEl = document.getElementById("muckPreviewStatus");
    const sampleLosingHand = ["7♣", "2♦"];

    function updatePreview() {
        const isMuckOn = Boolean(toggle?.checked);
        renderCardRow(cardsBox, sampleLosingHand, isMuckOn);
        if (statusEl) {
            statusEl.textContent = isMuckOn
                ? "Muck ON: Your losing hand stays hidden (🂠 🂠) from opponents at Showdown!"
                : "Muck OFF: Your losing hand (7♣ 2♦) is revealed to the table at Showdown.";
        }
    }

    if (toggle) {
        toggle.addEventListener("change", updatePreview);
        updatePreview();
    }
}

// ============================================================================
// 6. Hard-Coded Guided Walkthrough Hand
// ============================================================================

const GUIDED_SCENARIO_STEPS = [
    {
        stage: "Pre-Flop",
        pot: 30,
        playerChips: 1000,
        playerBet: 0,
        bot1: { chips: 990, bet: 10, status: "Small Blind ($10)", folded: false, reveal: false },
        bot2: { chips: 980, bet: 20, status: "Big Blind ($20)", folded: false, reveal: false },
        community: ["🂠", "🂠", "🂠", "🂠", "🂠"],
        coachTitle: "Step 1 · Pre-Flop Decision (Blinds Posted)",
        coachText: "Bot Nova posted the $10 Small Blind and Bot Atlas posted the $20 Big Blind. You hold A♠ K♥ on the Dealer button! Click 'Call $20' to enter the hand.",
        actions: [{ label: "Call $20", style: "btn-primary" }]
    },
    {
        stage: "Flop",
        pot: 60,
        playerChips: 980,
        playerBet: 0,
        bot1: { chips: 980, bet: 0, status: "Checked", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, status: "Checked", folded: false, reveal: false },
        community: ["A♦", "8♣", "3♠", "🂠", "🂠"],
        coachTitle: "Step 2 · The Flop (Top Pair, Top Kicker!)",
        coachText: "Three community cards are dealt: A♦ 8♣ 3♠! You paired your Ace with a King kicker. Both bots checked to you. Click 'Raise to $40' to build the pot.",
        actions: [{ label: "Raise to $40", style: "btn-success" }]
    },
    {
        stage: "Turn",
        pot: 140,
        playerChips: 940,
        playerBet: 0,
        bot1: { chips: 940, bet: 0, status: "Called $40", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, status: "Folded (Mucked)", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "🂠"],
        coachTitle: "Step 3 · The Turn (Two Pair!)",
        coachText: "Bot Atlas folded (automatically mucking their cards), while Bot Nova called $40. The Turn brings K♦—giving you Two Pair (Aces & Kings)! Click 'Check' to trap Bot Nova.",
        actions: [{ label: "Check", style: "btn-secondary" }]
    },
    {
        stage: "River",
        pot: 140,
        playerChips: 940,
        playerBet: 0,
        bot1: { chips: 900, bet: 40, status: "Bet $40", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, status: "Folded", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "5♥"],
        coachTitle: "Step 4 · The River (Bot Nova Bets $40)",
        coachText: "The River is 5♥ and Bot Nova bets $40! Your Two Pair (Aces & Kings) is very strong. Click 'Call $40' to go to Showdown.",
        actions: [{ label: "Call $40", style: "btn-primary" }]
    },
    {
        stage: "Showdown",
        pot: 0,
        playerChips: 1120,
        playerBet: 0,
        bot1: { chips: 900, bet: 0, status: "Lost (Showed A♣ J♠)", folded: false, reveal: true },
        bot2: { chips: 980, bet: 0, status: "Folded", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "5♥"],
        coachTitle: "Showdown Complete · You Won the $220 Pot!",
        coachText: "Your Two Pair (A♠ A♦ K♥ K♦ 8♣) beats Bot Nova's One Pair of Aces (A♣ J♠)! Notice that because Bot Nova had Muck Losing Cards OFF, their cards were revealed—whereas if Bot Nova had Muck ON, their losing hand would have stayed hidden.",
        actions: []
    }
];

let guidedIdx = 0;

function initGuidedHand() {
    document.getElementById("restartGuidedHandBtn")?.addEventListener("click", () => {
        guidedIdx = 0;
        renderGuidedHandState();
    });
    renderGuidedHandState();
}

function renderGuidedHandState() {
    const state = GUIDED_SCENARIO_STEPS[guidedIdx];
    const muckOn = Boolean(document.getElementById("guided-muck-toggle")?.checked);

    document.getElementById("guided-stage").textContent = state.stage;
    document.getElementById("guided-pot").textContent = String(state.pot);
    document.getElementById("guided-player-chips").textContent = String(state.playerChips);
    document.getElementById("guided-player-bet").textContent = String(state.playerBet);

    renderCardRow(document.getElementById("guided-player-cards"), ["A♠", "K♥"], false);
    renderCardRow(
        document.getElementById("guided-community-cards"),
        state.community.map((c) => (c === "🂠" ? "" : c)),
        false
    );
    // Render face-down placeholders properly for unrevealed community cards
    const commContainer = document.getElementById("guided-community-cards");
    if (commContainer) {
        commContainer.textContent = "";
        state.community.forEach((c) => {
            commContainer.appendChild(createCardElement(c, c === "🂠"));
        });
    }

    // Bot 1
    const bot1Box = document.getElementById("guided-bot-1");
    bot1Box?.classList.toggle("folded-seat", state.bot1.folded);
    document.getElementById("guided-bot-1-chips").textContent = `$${state.bot1.chips}`;
    document.getElementById("guided-bot-1-bet").textContent = `$${state.bot1.bet}`;
    document.getElementById("guided-bot-1-status").textContent =
        state.stage === "Showdown" && muckOn ? "Lost (Mucked 🂠 🂠)" : state.bot1.status;
    renderCardRow(
        document.getElementById("guided-bot-1-cards"),
        ["A♣", "J♠"],
        !(state.bot1.reveal && !muckOn)
    );

    // Bot 2
    const bot2Box = document.getElementById("guided-bot-2");
    bot2Box?.classList.toggle("folded-seat", state.bot2.folded);
    document.getElementById("guided-bot-2-chips").textContent = `$${state.bot2.chips}`;
    document.getElementById("guided-bot-2-bet").textContent = `$${state.bot2.bet}`;
    document.getElementById("guided-bot-2-status").textContent = state.bot2.status;
    renderCardRow(document.getElementById("guided-bot-2-cards"), ["9♦", "4♣"], true);

    // Winner highlight
    document.getElementById("guided-player-seat")?.classList.toggle("winner-seat", state.stage === "Showdown");

    // Coach prompt & action buttons
    document.getElementById("guided-coach-title").textContent = state.coachTitle;
    document.getElementById("guided-coach-text").textContent = state.coachText;

    const btnContainer = document.getElementById("guided-action-buttons");
    if (btnContainer) {
        btnContainer.textContent = "";
        state.actions.forEach((act) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `btn ${act.style} fw-bold px-4`;
            btn.textContent = act.label;
            btn.addEventListener("click", () => {
                if (guidedIdx < GUIDED_SCENARIO_STEPS.length - 1) {
                    guidedIdx++;
                    renderGuidedHandState();
                }
            });
            btnContainer.appendChild(btn);
        });
    }
}

// TODO: Refactor all logic to use pokerLogic.js and change UI to match actual gameplay.
// ============================================================================
// 7. Unlimited Multi-Difficulty Bot Practice Engine (5-of-7 Hand Evaluator)
// ============================================================================

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
    { val: 2, label: "2" },
    { val: 3, label: "3" },
    { val: 4, label: "4" },
    { val: 5, label: "5" },
    { val: 6, label: "6" },
    { val: 7, label: "7" },
    { val: 8, label: "8" },
    { val: 9, label: "9" },
    { val: 10, label: "10" },
    { val: 11, label: "J" },
    { val: 12, label: "Q" },
    { val: 13, label: "K" },
    { val: 14, label: "A" }
];

const HAND_CATEGORY_NAMES = [
    "High Card",
    "One Pair",
    "Two Pair",
    "Three of a Kind",
    "Straight",
    "Flush",
    "Full House",
    "Four of a Kind",
    "Straight Flush"
];

function buildShuffledDeck() {
    const deck = [];
    for (const s of SUITS) {
        for (const r of RANKS) {
            deck.push({ rank: r.val, suit: s, text: `${r.label}${s}` });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function evaluateFiveCards(cards) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map((c) => c.rank);
    const isFlush = sorted.every((c) => c.suit === sorted[0].suit);

    let isStraight = false;
    let straightHigh = 0;
    const uniqueRanks = [...new Set(ranks)];
    if (uniqueRanks.length === 5) {
        if (uniqueRanks[0] - uniqueRanks[4] === 4) {
            isStraight = true;
            straightHigh = uniqueRanks[0];
        } else if (
            uniqueRanks[0] === 14 &&
            uniqueRanks[1] === 5 &&
            uniqueRanks[2] === 4 &&
            uniqueRanks[3] === 3 &&
            uniqueRanks[4] === 2
        ) {
            isStraight = true;
            straightHigh = 5;
        }
    }

    const counts = new Map();
    for (const r of ranks) {
        counts.set(r, (counts.get(r) || 0) + 1);
    }
    const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    let category = 0;
    let tieRanks = [];

    if (isStraight && isFlush) {
        category = 8;
        tieRanks = [straightHigh];
    } else if (groups[0][1] === 4) {
        category = 7;
        tieRanks = [groups[0][0], groups[1][0]];
    } else if (groups[0][1] === 3 && groups[1][1] === 2) {
        category = 6;
        tieRanks = [groups[0][0], groups[1][0]];
    } else if (isFlush) {
        category = 5;
        tieRanks = ranks;
    } else if (isStraight) {
        category = 4;
        tieRanks = [straightHigh];
    } else if (groups[0][1] === 3) {
        category = 3;
        tieRanks = [groups[0][0], groups[1][0], groups[2][0]];
    } else if (groups[0][1] === 2 && groups[1][1] === 2) {
        category = 2;
        tieRanks = [groups[0][0], groups[1][0], groups[2][0]];
    } else if (groups[0][1] === 2) {
        category = 1;
        tieRanks = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
    } else {
        category = 0;
        tieRanks = ranks;
    }

    let score = category * 1e10;
    tieRanks.forEach((r, idx) => {
        score += r * Math.pow(15, 4 - idx);
    });

    return {
        score,
        category,
        name: category === 8 && straightHigh === 14 ? "Royal Flush" : HAND_CATEGORY_NAMES[category]
    };
}

function evaluateBestHand(cards) {
    if (cards.length < 5) {
        const sorted = [...cards].sort((a, b) => b.rank - a.rank);
        const isPair = sorted.length >= 2 && sorted[0].rank === sorted[1].rank;
        return {
            score: (isPair ? 1 : 0) * 1e10 + (sorted[0]?.rank || 0) * 1e5,
            category: isPair ? 1 : 0,
            name: isPair ? "Pocket Pair" : `High Card (${sorted[0]?.text || ""})`
        };
    }

    let best = null;
    const n = cards.length;
    for (let i = 0; i < n - 4; i++) {
        for (let j = i + 1; j < n - 3; j++) {
            for (let k = j + 1; k < n - 2; k++) {
                for (let l = k + 1; l < n - 1; l++) {
                    for (let m = l + 1; m < n; m++) {
                        const evalRes = evaluateFiveCards([cards[i], cards[j], cards[k], cards[l], cards[m]]);
                        if (!best || evalRes.score > best.score) {
                            best = evalRes;
                        }
                    }
                }
            }
        }
    }
    return best;
}

const practiceState = {
    handNumber: 0,
    dealerIndex: 0, // 0 = You, 1 = Bot 0, 2 = Bot 1
    inHand: false,
    round: "Pre-Flop",
    deck: [],
    community: [],
    pot: 0,
    highestBet: 0,
    smallBlind: 10,
    bigBlind: 20,
    seats: [
        { id: "player", name: "You", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: false, status: "Ready", reveal: true },
        { id: "bot0", name: "Bot Alpha", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: true, status: "Ready", reveal: false },
        { id: "bot1", name: "Bot Bravo", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: true, status: "Ready", reveal: false }
    ],
    turnIndex: 0,
    statusMessage: "Select a bot difficulty and click 'Deal New Hand' to begin!"
};

function initBotPracticeEngine() {
    const dealBtn = document.getElementById("dealPracticeHandBtn");
    const resetBtn = document.getElementById("resetPracticeChipsBtn");
    const foldBtn = document.getElementById("prac-btn-fold");
    const checkBtn = document.getElementById("prac-btn-check");
    const callBtn = document.getElementById("prac-btn-call");
    const raiseBtn = document.getElementById("prac-btn-raise");
    const raiseInput = document.getElementById("prac-raise-amount");
    const betScale = document.getElementById("prac-bet-scale");

    if (!dealBtn) return;

    dealBtn.addEventListener("click", startPracticeHand);
    resetBtn?.addEventListener("click", () => {
        practiceState.seats.forEach((s) => {
            s.chips = 1000;
            s.bet = 0;
            s.folded = false;
            s.cards = [];
            s.status = "Ready";
        });
        practiceState.inHand = false;
        practiceState.pot = 0;
        practiceState.community = [];
        practiceState.statusMessage = "Chips reset to $1,000 for everyone. Click 'Deal New Hand'!";
        renderPracticeTable();
    });

    betScale?.addEventListener("input", () => {
        if (raiseInput) raiseInput.value = betScale.value;
    });
    raiseInput?.addEventListener("input", () => {
        if (betScale) betScale.value = raiseInput.value;
    });

    foldBtn?.addEventListener("click", () => handleHumanPracticeAction("Fold"));
    checkBtn?.addEventListener("click", () => handleHumanPracticeAction("Check"));
    callBtn?.addEventListener("click", () => handleHumanPracticeAction("Call"));
    raiseBtn?.addEventListener("click", () => {
        const amt = Number(raiseInput?.value) || 0;
        handleHumanPracticeAction("Raise", amt);
    });

    renderPracticeTable();
}

function startPracticeHand() {
    // Auto-rebuy anyone at $0 so unlimited rounds can continue seamlessly
    practiceState.seats.forEach((s) => {
        if (s.chips < practiceState.bigBlind) {
            s.chips = 1000;
        }
        s.bet = 0;
        s.folded = false;
        s.acted = false;
        s.reveal = !s.isBot;
        s.status = "Active";
    });

    practiceState.handNumber += 1;
    practiceState.dealerIndex = (practiceState.handNumber - 1) % 3;
    practiceState.deck = buildShuffledDeck();
    practiceState.community = [];
    practiceState.pot = 0;
    practiceState.highestBet = 0;
    practiceState.round = "Pre-Flop";
    practiceState.inHand = true;

    // Deal 2 cards to each seat
    practiceState.seats.forEach((s) => {
        s.cards = [practiceState.deck.pop(), practiceState.deck.pop()];
    });

    // Post Small Blind and Big Blind
    const sbIdx = (practiceState.dealerIndex + 1) % 3;
    const bbIdx = (practiceState.dealerIndex + 2) % 3;

    postPracticeBlind(sbIdx, practiceState.smallBlind, "Small Blind");
    postPracticeBlind(bbIdx, practiceState.bigBlind, "Big Blind");

    practiceState.highestBet = practiceState.bigBlind;
    practiceState.turnIndex = (bbIdx + 1) % 3;
    practiceState.statusMessage = `Hand #${practiceState.handNumber} dealt! Blinds posted ($${practiceState.smallBlind}/$${practiceState.bigBlind}).`;

    renderPracticeTable();
    advancePracticeTurnIfBot();
}

function postPracticeBlind(seatIdx, blindAmt, label) {
    const seat = practiceState.seats[seatIdx];
    const actual = Math.min(seat.chips, blindAmt);
    seat.chips -= actual;
    seat.bet += actual;
    practiceState.pot += actual;
    seat.status = `${label} ($${actual})`;
}

function handleHumanPracticeAction(action, raiseTarget = 0) {
    if (!practiceState.inHand || practiceState.turnIndex !== 0) return;

    const player = practiceState.seats[0];
    if (action === "Fold") {
        player.folded = true;
        player.acted = true;
        player.status = "Folded (Mucked)";
    } else if (action === "Check") {
        if (player.bet < practiceState.highestBet) return;
        player.acted = true;
        player.status = "Checked";
    } else if (action === "Call") {
        const toCall = Math.min(player.chips, practiceState.highestBet - player.bet);
        player.chips -= toCall;
        player.bet += toCall;
        practiceState.pot += toCall;
        player.acted = true;
        player.status = player.chips === 0 ? "All-In" : `Called $${player.bet}`;
    } else if (action === "Raise") {
        const minRaise = practiceState.highestBet + practiceState.bigBlind;
        const maxRaise = player.bet + player.chips;
        const validTarget = Math.max(minRaise, Math.min(raiseTarget, maxRaise));
        const added = Math.min(player.chips, validTarget - player.bet);
        if (added <= 0) return;

        player.chips -= added;
        player.bet += added;
        practiceState.pot += added;
        practiceState.highestBet = player.bet;
        player.acted = true;
        player.status = player.chips === 0 ? "All-In" : `Raised to $${player.bet}`;

        practiceState.seats.forEach((s, idx) => {
            if (idx !== 0 && !s.folded && s.chips > 0) {
                s.acted = false;
            }
        });
    }

    progressPracticeRound();
}

function advancePracticeTurnIfBot() {
    if (!practiceState.inHand) return;
    if (practiceState.turnIndex === 0) {
        renderPracticeTable();
        return;
    }

    setTimeout(() => {
        if (!practiceState.inHand || practiceState.turnIndex === 0) return;
        executeBotDecision(practiceState.turnIndex);
        progressPracticeRound();
    }, 550);
}

function executeBotDecision(seatIdx) {
    const bot = practiceState.seats[seatIdx];
    const difficulty = document.getElementById("botDifficultySelect")?.value || "medium";
    const toCall = practiceState.highestBet - bot.bet;

    const availableCards = [...bot.cards, ...practiceState.community];
    const handEval = evaluateBestHand(availableCards);
    const highCardRank = Math.max(bot.cards[0].rank, bot.cards[1].rank);
    const isPocketPair = bot.cards[0].rank === bot.cards[1].rank;

    let decision = "Check";

    if (difficulty === "easy") {
        // Easy bot: passive calling station, rarely raises, only folds weak hands to large bets
        if (toCall === 0) {
            decision = "Check";
        } else if (toCall > 100 && handEval.category === 0 && highCardRank < 11) {
            decision = "Fold";
        } else {
            decision = "Call";
        }
    } else if (difficulty === "medium") {
        // Medium bot: raises strong pairs/made hands, folds junk to raises
        const strong = isPocketPair || handEval.category >= 1 || highCardRank >= 13;
        if (toCall === 0) {
            decision = strong && Math.random() < 0.45 && bot.chips >= practiceState.bigBlind * 2 ? "Raise" : "Check";
        } else if (strong || toCall <= practiceState.bigBlind) {
            decision = handEval.category >= 2 && Math.random() < 0.35 && bot.chips > toCall + practiceState.bigBlind ? "Raise" : "Call";
        } else {
            decision = "Fold";
        }
    } else {
        // Hard bot: aggressive with strong equity, applies pressure & respects pot odds
        const premium = isPocketPair || handEval.category >= 1 || (bot.cards[0].rank >= 11 && bot.cards[1].rank >= 11);
        const potOdds = toCall > 0 ? toCall / (practiceState.pot + toCall) : 0;

        if (toCall === 0) {
            decision = (premium || Math.random() < 0.3) && bot.chips >= practiceState.bigBlind * 2 ? "Raise" : "Check";
        } else if (handEval.category >= 2 || (premium && Math.random() < 0.5)) {
            decision = bot.chips > toCall + practiceState.bigBlind ? "Raise" : "Call";
        } else if (premium || potOdds <= 0.25) {
            decision = "Call";
        } else {
            decision = "Fold";
        }
    }

    if (decision === "Fold") {
        bot.folded = true;
        bot.acted = true;
        bot.status = "Folded (Mucked)";
    } else if (decision === "Check") {
        bot.acted = true;
        bot.status = "Checked";
    } else if (decision === "Call") {
        const pay = Math.min(bot.chips, toCall);
        bot.chips -= pay;
        bot.bet += pay;
        practiceState.pot += pay;
        bot.acted = true;
        bot.status = bot.chips === 0 ? "All-In" : `Called $${bot.bet}`;
    } else if (decision === "Raise") {
        const raiseTo = Math.min(bot.bet + bot.chips, Math.max(practiceState.highestBet + practiceState.bigBlind, practiceState.highestBet * 2));
        const pay = Math.min(bot.chips, raiseTo - bot.bet);
        bot.chips -= pay;
        bot.bet += pay;
        practiceState.pot += pay;
        practiceState.highestBet = bot.bet;
        bot.acted = true;
        bot.status = bot.chips === 0 ? "All-In" : `Raised to $${bot.bet}`;

        practiceState.seats.forEach((s, idx) => {
            if (idx !== seatIdx && !s.folded && s.chips > 0) {
                s.acted = false;
            }
        });
    }
}

function progressPracticeRound() {
    const activeSeats = practiceState.seats.filter((s) => !s.folded);

    // Everyone else folded -> last remaining player wins immediately
    if (activeSeats.length === 1) {
        const winner = activeSeats[0];
        winner.chips += practiceState.pot;
        practiceState.statusMessage = `${winner.name} wins $${practiceState.pot} (all opponents folded)! Click 'Deal New Hand' to play again.`;
        practiceState.pot = 0;
        practiceState.inHand = false;
        renderPracticeTable();
        return;
    }

    // Check if betting round is complete
    const allMatched = activeSeats.every((s) => s.chips === 0 || (s.acted && s.bet === practiceState.highestBet));

    if (allMatched) {
        if (practiceState.round === "River") {
            resolvePracticeShowdown(activeSeats);
            return;
        }

        // Advance community cards
        practiceState.seats.forEach((s) => {
            s.bet = 0;
            s.acted = false;
            if (!s.folded && s.chips > 0) s.status = "Active";
        });
        practiceState.highestBet = 0;

        if (practiceState.round === "Pre-Flop") {
            practiceState.round = "Flop";
            practiceState.community.push(practiceState.deck.pop(), practiceState.deck.pop(), practiceState.deck.pop());
        } else if (practiceState.round === "Flop") {
            practiceState.round = "Turn";
            practiceState.community.push(practiceState.deck.pop());
        } else if (practiceState.round === "Turn") {
            practiceState.round = "River";
            practiceState.community.push(practiceState.deck.pop());
        }

        // First active player left of dealer starts post-flop action
        let nextIdx = (practiceState.dealerIndex + 1) % 3;
        let guard = 0;
        while ((practiceState.seats[nextIdx].folded || practiceState.seats[nextIdx].chips === 0) && guard < 3) {
            nextIdx = (nextIdx + 1) % 3;
            guard++;
        }
        practiceState.turnIndex = nextIdx;
        practiceState.statusMessage = `${practiceState.round} dealt!`;
        renderPracticeTable();

        // If all active players are all-in, fast-forward remaining streets
        if (activeSeats.every((s) => s.chips === 0)) {
            setTimeout(progressPracticeRound, 650);
            return;
        }

        advancePracticeTurnIfBot();
        return;
    }

    // Advance turn to next active player with chips
    let nextIdx = (practiceState.turnIndex + 1) % 3;
    let guard = 0;
    while ((practiceState.seats[nextIdx].folded || practiceState.seats[nextIdx].chips === 0) && guard < 3) {
        nextIdx = (nextIdx + 1) % 3;
        guard++;
    }
    practiceState.turnIndex = nextIdx;
    renderPracticeTable();
    advancePracticeTurnIfBot();
}

function resolvePracticeShowdown(activeSeats) {
    let bestScore = -1;
    let winners = [];
    let winningHandName = "";

    activeSeats.forEach((seat) => {
        const evalRes = evaluateBestHand([...seat.cards, ...practiceState.community]);
        seat.evalResult = evalRes;
        if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            winners = [seat];
            winningHandName = evalRes.name;
        } else if (evalRes.score === bestScore) {
            winners.push(seat);
        }
    });

    const share = Math.floor(practiceState.pot / winners.length);
    const remainder = practiceState.pot % winners.length;
    winners.forEach((w, idx) => {
        w.chips += share + (idx === 0 ? remainder : 0);
    });

    const winnerIds = new Set(winners.map((w) => w.id));
    const humanMuck = Boolean(document.getElementById("prac-muck-toggle")?.checked);
    const difficulty = document.getElementById("botDifficultySelect")?.value || "medium";

    activeSeats.forEach((seat) => {
        const isWinner = winnerIds.has(seat.id);
        if (isWinner) {
            seat.reveal = true;
            seat.status = `Winner (${seat.evalResult.name})`;
        } else if (seat.id === "player") {
            seat.reveal = !humanMuck;
            seat.status = humanMuck ? "Lost (Mucked 🂠 🂠)" : `Lost (${seat.evalResult.name})`;
        } else {
            // Hard bots muck losing hands; Easy/Medium bots show them
            const botMucks = difficulty === "hard";
            seat.reveal = !botMucks;
            seat.status = botMucks ? "Lost (Mucked 🂠 🂠)" : `Lost (${seat.evalResult.name})`;
        }
    });

    const winnerNames = winners.map((w) => w.name).join(" & ");
    practiceState.statusMessage = `Showdown! ${winnerNames} won $${practiceState.pot} with ${winningHandName}! Click 'Deal New Hand' for another round.`;
    practiceState.pot = 0;
    practiceState.inHand = false;
    renderPracticeTable(winnerIds);
}

function renderPracticeTable(winnerIds = new Set()) {
    const difficulty = document.getElementById("botDifficultySelect")?.value || "medium";
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

    document.getElementById("prac-pot").textContent = String(practiceState.pot);
    document.getElementById("prac-round").textContent = practiceState.round;
    document.getElementById("prac-hand-num").textContent = String(practiceState.handNumber);
    document.getElementById("prac-table-status").textContent = practiceState.statusMessage;

    // Community cards (5 slots)
    const commEl = document.getElementById("prac-community-cards");
    if (commEl) {
        commEl.textContent = "";
        for (let i = 0; i < 5; i++) {
            const card = practiceState.community[i];
            commEl.appendChild(createCardElement(card ? card.text : "🂠", !card));
        }
    }

    // Bots (seats 1 & 2)
    [1, 2].forEach((seatIdx, botUiIdx) => {
        const seat = practiceState.seats[seatIdx];
        const box = document.getElementById(`prac-bot-${botUiIdx}`);
        const dealerTag = practiceState.inHand && practiceState.dealerIndex === seatIdx ? " (D)" : "";

        document.getElementById(`prac-bot-${botUiIdx}-name`).textContent = `${seat.name} [${diffLabel}]${dealerTag}`;
        document.getElementById(`prac-bot-${botUiIdx}-status`).textContent = seat.status;
        document.getElementById(`prac-bot-${botUiIdx}-chips`).textContent = String(seat.chips);
        document.getElementById(`prac-bot-${botUiIdx}-bet`).textContent = String(seat.bet);

        if (box) {
            box.classList.toggle("active-turn", practiceState.inHand && practiceState.turnIndex === seatIdx);
            box.classList.toggle("folded-seat", seat.folded);
            box.classList.toggle("winner-seat", winnerIds.has(seat.id));
        }

        const cardsBox = document.getElementById(`prac-bot-${botUiIdx}-cards`);
        if (seat.cards.length === 2) {
            renderCardRow(cardsBox, seat.cards.map((c) => c.text), !seat.reveal);
        } else if (cardsBox) {
            cardsBox.textContent = "";
        }
    });

    // Human seat (seat 0)
    const human = practiceState.seats[0];
    const humanDealerTag = practiceState.inHand && practiceState.dealerIndex === 0 ? " · Dealer (D)" : "";
    document.getElementById("prac-player-label").textContent = `You${humanDealerTag}`;
    document.getElementById("prac-player-chips").textContent = String(human.chips);
    document.getElementById("prac-player-bet").textContent = String(human.bet);

    const humanBox = document.getElementById("prac-player-seat");
    if (humanBox) {
        humanBox.classList.toggle("active-turn", practiceState.inHand && practiceState.turnIndex === 0);
        humanBox.classList.toggle("folded-seat", human.folded);
        humanBox.classList.toggle("winner-seat", winnerIds.has("player"));
    }

    const humanCardsBox = document.getElementById("prac-player-cards");
    if (human.cards.length === 2) {
        renderCardRow(humanCardsBox, human.cards.map((c) => c.text), false);
        const evalRes = evaluateBestHand([...human.cards, ...practiceState.community]);
        document.getElementById("prac-hand-eval").textContent = `Current Hand: ${evalRes.name}`;
    } else {
        if (humanCardsBox) humanCardsBox.textContent = "";
        document.getElementById("prac-hand-eval").textContent = "Current Hand: --";
    }

    // Update human betting controls
    const isHumanTurn = practiceState.inHand && practiceState.turnIndex === 0 && !human.folded;
    const toCall = Math.max(0, practiceState.highestBet - human.bet);
    const minRaise = practiceState.highestBet + practiceState.bigBlind;
    const maxRaise = human.bet + human.chips;

    const foldBtn = document.getElementById("prac-btn-fold");
    const checkBtn = document.getElementById("prac-btn-check");
    const callBtn = document.getElementById("prac-btn-call");
    const raiseBtn = document.getElementById("prac-btn-raise");
    const raiseInput = document.getElementById("prac-raise-amount");
    const betScale = document.getElementById("prac-bet-scale");

    if (foldBtn) foldBtn.disabled = !isHumanTurn;
    if (checkBtn) checkBtn.disabled = !isHumanTurn || toCall > 0;
    if (callBtn) {
        callBtn.disabled = !isHumanTurn || toCall === 0;
        callBtn.textContent = toCall > 0 ? `Call ($${Math.min(human.chips, toCall)})` : "Call";
    }
    if (raiseBtn) {
        raiseBtn.disabled = !isHumanTurn || maxRaise < minRaise;
    }
    if (raiseInput && betScale) {
        raiseInput.min = String(minRaise);
        raiseInput.max = String(Math.max(minRaise, maxRaise));
        betScale.min = String(minRaise);
        betScale.max = String(Math.max(minRaise, maxRaise));

        const clamped = Math.max(minRaise, Math.min(Number(raiseInput.value) || minRaise, maxRaise));
        raiseInput.value = String(clamped);
        betScale.value = String(clamped);
        raiseInput.disabled = !isHumanTurn || maxRaise < minRaise;
        betScale.disabled = !isHumanTurn || maxRaise < minRaise;
    }
}
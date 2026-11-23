/**
 * ============================================================================
 * File Name: tutorial.js
 * Purpose: Interactive controller for tutorial.html. Manages timeline navigation,
 *          section skipping, hand hierarchy & optional tie-breaker inspection,
 *          step-by-step live control walkthrough, interactive table blinds
 *          rotation preview, mucking preview, a curated guided hand, and an
 *          unlimited multi-difficulty bot practice engine.
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
// Shared Card & Seat Rendering Helpers (Matching tableDisplay.js)
// ============================================================================

function formatCardText(cardOrText, faceDown = false) {
    if (faceDown) return "🂠";
    if (typeof cardOrText === "number") {
        return Deck.cardToText(cardOrText);
    }
    return String(cardOrText || "🂠");
}

function createGameplayCardElement(cardOrText, faceDown = false) {
    const text = formatCardText(cardOrText, faceDown);
    const card = document.createElement("div");
    card.className = "card";

    if (faceDown || text === "🂠") {
        card.classList.add("face-down");
        card.textContent = "🂠";
        return card;
    }

    if (text.includes("♥") || text.includes("♦")) {
        card.classList.add("red-suit");
    }

    card.textContent = text;
    return card;
}

function renderGameplayCards(container, cards, faceDown = false) {
    if (!container) return;
    container.innerHTML = "";
    cards.forEach((c) => {
        const isHidden = faceDown || c === "🂠";
        container.appendChild(createGameplayCardElement(c, isHidden));
    });
}

function renderTableSeats(leftContainer, rightContainer, seats) {
    if (!leftContainer || !rightContainer) return;
    leftContainer.innerHTML = "";
    rightContainer.innerHTML = "";

    const half = Math.ceil(seats.length / 2);

    seats.forEach((p, index) => {
        const seat = document.createElement("div");
        let statusClass = "";
        if (p.folded) {
            statusClass = "folded";
        } else if (p.isActiveTurn || p.isCurrent) {
            statusClass = "active";
        }

        seat.className = `player-seat ${statusClass} ${p.isWinner ? "winner-seat" : ""}`.trim();

        const nameSpan = document.createElement("span");
        nameSpan.className = "player-name";
        nameSpan.textContent = p.name + (p.isCurrent ? " (You)" : "");

        if (p.isDealer) {
            const dealerBadge = document.createElement("span");
            dealerBadge.className = "dealer-badge";
            dealerBadge.textContent = "D";
            nameSpan.appendChild(dealerBadge);
        }

        if (p.blindRole === "SB" || p.blindRole === "BB") {
            const blindBadge = document.createElement("span");
            blindBadge.className = `blind-badge ${p.blindRole.toLowerCase()}`;
            blindBadge.textContent = p.blindRole;
            nameSpan.appendChild(blindBadge);
        }

        const statusSpan = document.createElement("span");
        statusSpan.className = "player-status";
        statusSpan.textContent = p.status;

        const chipsSpan = document.createElement("span");
        chipsSpan.className = "player-chips";
        const betSuffix = p.bet > 0 ? ` · Bet: ${p.bet}` : "";
        chipsSpan.textContent = `${Number(p.chips).toLocaleString()} chips${betSuffix}`;

        seat.append(nameSpan, statusSpan, chipsSpan);

        if (Array.isArray(p.cards) && p.cards.length > 0) {
            const cardsRow = document.createElement("div");
            cardsRow.className = "seat-cards";
            p.cards.forEach((c) => {
                cardsRow.appendChild(createGameplayCardElement(c, !p.revealCards));
            });
            seat.appendChild(cardsRow);
        }

        if (index < half) {
            leftContainer.appendChild(seat);
        } else {
            rightContainer.appendChild(seat);
        }
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
    renderGameplayCards(cardsEl, hand.cards, false);
}

// ============================================================================
// 3. Step-by-Step App Controls & Betting Rules Walkthrough (Live Gameplay UI)
// ============================================================================

const CONTROL_STEPS = [
    {
        targetId: "demo-your-hand-panel",
        title: "1. Your Hand Panel (Hole Cards, Chips & Current Bet)",
        desc: "Directly beneath the table, you see your private 2 hole cards (A♠ K♥), your total remaining chips (1,000), and how much you have already bet in the current round (0)."
    },
    {
        targetId: "demo-bet-summary",
        title: "2. Bet Summary Bar (Current Bet & Chips Available)",
        desc: "At the top of the 'Your Turn' panel, compare 'Current Bet' (20) with 'Your Bet' (0). To stay in the hand, your total round bet must match Current Bet."
    },
    {
        targetId: "demo-raise-controls",
        title: "3. Adjust Raise Amount (Number Input, Slider & Min/Max Labels)",
        desc: "Type an exact total bet into the number box or drag the slider between the minimum legal raise (40) and your all-in maximum (1,000)."
    },
    {
        targetId: "demo-muck-container",
        title: "4. Muck Losing Cards Toggle Switch",
        desc: "Before acting, toggle 'Muck Losing Cards' ON if you want your hole cards hidden face-down when losing at Showdown."
    },
    {
        targetId: "demo-btn-fold",
        title: "5. Fold Button",
        desc: "Clicking the circular 'Fold' button discards your cards immediately and exits the hand without risking any more chips."
    },
    {
        targetId: "demo-btn-check",
        title: "6. Check & Call Buttons",
        desc: "'Check' passes the turn for free ONLY when Your Bet already equals Current Bet. When facing a bet (like 20 here), 'Check' is disabled and 'Call' matches the 20 bet."
    },
    {
        targetId: "demo-btn-raise",
        title: "7. Raise Button",
        desc: "Clicking the circular 'Raise' button commits the amount selected on the slider/input, forcing remaining players to Call, Re-Raise, or Fold."
    }
];

let currentControlIdx = 0;

function initControlsWalkthrough() {
    const prevBtn = document.getElementById("prevControlTourBtn");
    const nextBtn = document.getElementById("nextControlTourBtn");
    const raiseInput = document.getElementById("demo-raise-amount");
    const betScale = document.getElementById("demo-bet-scale");
    const raiseBtn = document.getElementById("demo-btn-raise");
    const checkBtn = document.getElementById("demo-btn-check");
    const callBtn = document.getElementById("demo-btn-call");
    const foldBtn = document.getElementById("demo-btn-fold");
    const muckToggle = document.getElementById("demo-muck-toggle");
    const feedback = document.getElementById("demo-control-feedback");

    renderGameplayCards(document.getElementById("demo-player-cards"), ["A♠", "K♥"], false);

    // Match live gameplay state: facing a 20 Big Blind, so Check is disabled
    if (checkBtn) checkBtn.disabled = true;

    prevBtn?.addEventListener("click", () => {
        currentControlIdx = (currentControlIdx - 1 + CONTROL_STEPS.length) % CONTROL_STEPS.length;
        renderControlTourStep();
    });

    nextBtn?.addEventListener("click", () => {
        currentControlIdx = (currentControlIdx + 1) % CONTROL_STEPS.length;
        renderControlTourStep();
    });

    if (betScale && raiseInput) {
        betScale.addEventListener("input", () => {
            raiseInput.value = betScale.value;
        });
        raiseInput.addEventListener("input", () => {
            const val = Math.max(40, Math.min(1000, Number(raiseInput.value) || 40));
            betScale.value = String(val);
        });
    }

    foldBtn?.addEventListener("click", () => {
        if (feedback) feedback.textContent = "Fold clicked: Your cards are mucked and you exit the current hand.";
    });

    callBtn?.addEventListener("click", () => {
        document.getElementById("demo-your-bet").textContent = "20";
        document.getElementById("demo-your-chips").textContent = "980";
        document.getElementById("demo-available-chips").textContent = "980";
        if (feedback) feedback.textContent = "Call clicked: You matched the 20 bet! Your Bet is now 20 and Chips Available is 980.";
    });

    raiseBtn?.addEventListener("click", () => {
        const amt = Math.max(40, Math.min(1000, Number(raiseInput?.value) || 40));
        document.getElementById("demo-your-bet").textContent = String(amt);
        document.getElementById("demo-current-bet").textContent = String(amt);
        document.getElementById("demo-your-chips").textContent = (1000 - amt).toLocaleString();
        document.getElementById("demo-available-chips").textContent = (1000 - amt).toLocaleString();
        if (feedback) feedback.textContent = `Raise clicked: You raised the table bet to ${amt}! Opponents must match ${amt} or fold.`;
    });

    muckToggle?.addEventListener("change", () => {
        if (feedback) {
            feedback.textContent = muckToggle.checked
                ? "Muck Losing Cards ON: Your cards will remain hidden if you lose at Showdown."
                : "Muck Losing Cards OFF: Your cards will be shown at Showdown.";
        }
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
// 4. Interactive Table Blinds Rotation Preview
// ============================================================================

function initBlindsPreview() {
    const leftSide = document.getElementById("blind-left-side");
    const rightSide = document.getElementById("blind-right-side");
    const commCards = document.getElementById("blind-community-cards");
    const firstActorEl = document.getElementById("blind-first-actor");
    const potEl = document.getElementById("blind-pot-total");
    const summaryEl = document.getElementById("blindRotationSummary");
    const rotateBtn = document.getElementById("rotateBlindsBtn");

    if (!leftSide || !rightSide) return;

    const basePlayers = [
        { id: "you", name: "You", isCurrent: true, cards: ["A♠", "K♥"], revealCards: true },
        { id: "nova", name: "Bot Nova", isCurrent: false, cards: ["🂠", "🂠"], revealCards: false },
        { id: "atlas", name: "Bot Atlas", isCurrent: false, cards: ["🂠", "🂠"], revealCards: false }
    ];

    let dealerIdx = 0;
    let handCount = 1;

    function renderBlindsTable() {
        const n = basePlayers.length;
        const sbIdx = (dealerIdx + 1) % n;
        const bbIdx = (dealerIdx + 2) % n;
        const firstActIdx = (bbIdx + 1) % n;

        const seats = basePlayers.map((p, idx) => {
            const isDealer = idx === dealerIdx;
            const isSb = idx === sbIdx;
            const isBb = idx === bbIdx;
            const isFirst = idx === firstActIdx;

            let bet = 0;
            let status = "Waiting to act";
            let blindRole = "";

            if (isSb) {
                bet = 10;
                status = "Posted Small Blind (10)";
                blindRole = "SB";
            } else if (isBb) {
                bet = 20;
                status = "Posted Big Blind (20)";
                blindRole = "BB";
            }

            if (isFirst) {
                status = isDealer ? "Dealer · First to Act (Needs 20)" : "First to Act (Needs 20)";
            }

            return {
                name: p.name,
                isCurrent: p.isCurrent,
                isDealer,
                blindRole,
                isActiveTurn: isFirst,
                folded: false,
                chips: 1000 - bet,
                bet,
                status,
                cards: p.cards,
                revealCards: p.revealCards
            };
        });

        renderTableSeats(leftSide, rightSide, seats);
        renderGameplayCards(commCards, ["🂠", "🂠", "🂠", "🂠", "🂠"], true);

        const dealerName = basePlayers[dealerIdx].name;
        const sbName = basePlayers[sbIdx].name;
        const bbName = basePlayers[bbIdx].name;
        const firstName = basePlayers[firstActIdx].name;

        if (potEl) potEl.textContent = "30";
        if (firstActorEl) firstActorEl.textContent = firstName;
        if (summaryEl) {
            summaryEl.textContent = `Hand #${handCount}: ${dealerName} is Dealer (D), ${sbName} posts Small Blind (10), and ${bbName} posts Big Blind (20). ${firstName} acts first Pre-Flop!`;
        }
    }

    rotateBtn?.addEventListener("click", () => {
        dealerIdx = (dealerIdx + 1) % basePlayers.length;
        handCount += 1;
        renderBlindsTable();
    });

    renderBlindsTable();
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
        renderGameplayCards(cardsBox, sampleLosingHand, isMuckOn);
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
// 6. Hard-Coded Guided Walkthrough Hand (Live Table UI)
// ============================================================================

const GUIDED_SCENARIO_STEPS = [
    {
        stage: "Pre-Flop",
        pot: 30,
        playerChips: 1000,
        playerBet: 0,
        bot1: { chips: 990, bet: 10, blindRole: "SB", status: "Small Blind (10)", folded: false, reveal: false },
        bot2: { chips: 980, bet: 20, blindRole: "BB", status: "Big Blind (20)", folded: false, reveal: false },
        community: ["🂠", "🂠", "🂠", "🂠", "🂠"],
        coachTitle: "Step 1 · Pre-Flop Decision (Blinds Posted)",
        coachText: "Bot Nova posted the 10 Small Blind and Bot Atlas posted the 20 Big Blind. You hold A♠ K♥ on the Dealer button! Click 'Call 20' to enter the hand.",
        actions: [{ label: "Call 20", style: "btn-success" }]
    },
    {
        stage: "Flop",
        pot: 60,
        playerChips: 980,
        playerBet: 0,
        bot1: { chips: 980, bet: 0, blindRole: "SB", status: "Checked", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, blindRole: "BB", status: "Checked", folded: false, reveal: false },
        community: ["A♦", "8♣", "3♠", "🂠", "🂠"],
        coachTitle: "Step 2 · The Flop (Top Pair, Top Kicker!)",
        coachText: "Three community cards are dealt: A♦ 8♣ 3♠! You paired your Ace with a King kicker. Both bots checked to you. Click 'Raise to 40' to build the pot.",
        actions: [{ label: "Raise to 40", style: "btn-primary" }]
    },
    {
        stage: "Turn",
        pot: 140,
        playerChips: 940,
        playerBet: 0,
        bot1: { chips: 940, bet: 0, blindRole: "SB", status: "Called 40", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, blindRole: "BB", status: "Folded (Mucked)", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "🂠"],
        coachTitle: "Step 3 · The Turn (Two Pair!)",
        coachText: "Bot Atlas folded (automatically mucking their cards), while Bot Nova called 40. The Turn brings K♦—giving you Two Pair (Aces & Kings)! Click 'Check' to trap Bot Nova.",
        actions: [{ label: "Check", style: "btn-secondary" }]
    },
    {
        stage: "River",
        pot: 140,
        playerChips: 940,
        playerBet: 0,
        bot1: { chips: 900, bet: 40, blindRole: "SB", status: "Bet 40", folded: false, reveal: false },
        bot2: { chips: 980, bet: 0, blindRole: "BB", status: "Folded", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "5♥"],
        coachTitle: "Step 4 · The River (Bot Nova Bets 40)",
        coachText: "The River is 5♥ and Bot Nova bets 40! Your Two Pair (Aces & Kings) is very strong. Click 'Call 40' to go to Showdown.",
        actions: [{ label: "Call 40", style: "btn-success" }]
    },
    {
        stage: "Showdown",
        pot: 0,
        playerChips: 1120,
        playerBet: 0,
        bot1: { chips: 900, bet: 0, blindRole: "SB", status: "Lost (Showed A♣ J♠)", folded: false, reveal: true },
        bot2: { chips: 980, bet: 0, blindRole: "BB", status: "Folded", folded: true, reveal: false },
        community: ["A♦", "8♣", "3♠", "K♦", "5♥"],
        coachTitle: "Showdown Complete · You Won the 220 Pot!",
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
    document.getElementById("guided-muck-toggle")?.addEventListener("change", renderGuidedHandState);
    renderGuidedHandState();
}

function renderGuidedHandState() {
    const state = GUIDED_SCENARIO_STEPS[guidedIdx];
    const muckOn = Boolean(document.getElementById("guided-muck-toggle")?.checked);

    document.getElementById("guided-stage").textContent = state.stage;
    document.getElementById("guided-pot").textContent = String(state.pot);
    document.getElementById("guided-player-chips").textContent = Number(state.playerChips).toLocaleString();
    document.getElementById("guided-player-bet").textContent = String(state.playerBet);

    renderGameplayCards(document.getElementById("guided-player-cards"), ["A♠", "K♥"], false);
    renderGameplayCards(document.getElementById("guided-community-cards"), state.community, false);

    const seats = [
        {
            name: "You",
            isCurrent: true,
            isDealer: true,
            blindRole: "",
            isActiveTurn: state.stage !== "Showdown",
            isWinner: state.stage === "Showdown",
            folded: false,
            chips: state.playerChips,
            bet: state.playerBet,
            status: state.stage === "Showdown" ? "Winner (Two Pair)" : "Active",
            cards: ["A♠", "K♥"],
            revealCards: true
        },
        {
            name: "Bot Nova",
            isCurrent: false,
            isDealer: false,
            blindRole: state.bot1.blindRole,
            isActiveTurn: false,
            isWinner: false,
            folded: state.bot1.folded,
            chips: state.bot1.chips,
            bet: state.bot1.bet,
            status: state.stage === "Showdown" && muckOn ? "Lost (Mucked)" : state.bot1.status,
            cards: ["A♣", "J♠"],
            revealCards: state.bot1.reveal && !muckOn
        },
        {
            name: "Bot Atlas",
            isCurrent: false,
            isDealer: false,
            blindRole: state.bot2.blindRole,
            isActiveTurn: false,
            isWinner: false,
            folded: state.bot2.folded,
            chips: state.bot2.chips,
            bet: state.bot2.bet,
            status: state.bot2.status,
            cards: ["9♦", "4♣"],
            revealCards: false
        }
    ];

    renderTableSeats(
        document.getElementById("guided-left-side"),
        document.getElementById("guided-right-side"),
        seats
    );

    document.getElementById("guided-table-status").textContent = state.coachTitle;
    document.getElementById("guided-coach-title").textContent = state.coachTitle;
    document.getElementById("guided-coach-text").textContent = state.coachText;

    const btnContainer = document.getElementById("guided-action-buttons");
    if (btnContainer) {
        btnContainer.innerHTML = "";
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

// ============================================================================
// 7. Unlimited Multi-Difficulty Bot Practice Engine (Using pokerLogic.js)
// ============================================================================

const CATEGORY_LABELS = [
    "High Card",
    "One Pair",
    "Two Pair",
    "Three of a Kind",
    "Straight",
    "Flush",
    "Full House",
    "Four of a Kind",
    "Straight Flush",
    "Royal Flush"
];

/**
 * Evaluates a player's current cards using Deck from pokerLogic.js.
 * Returns { score, category, name } compatible with Deck.bestHand().
 */
function evaluatePracticeCardsWithPokerLogic(holeCards, communityCards) {
    const available = [...holeCards, ...communityCards];
    if (available.length < 5) {
        const parsed = holeCards.map((c) => ({
            rank: (c - 1) % 13,
            text: Deck.cardToText(c)
        })).sort((a, b) => b.rank - a.rank);

        const isPocketPair = parsed.length === 2 && parsed[0].rank === parsed[1].rank;
        return {
            score: (isPocketPair ? 1 : 0) * Math.pow(13, 5) + (parsed[0]?.rank || 0) * Math.pow(13, 4),
            category: isPocketPair ? 1 : 0,
            name: isPocketPair ? "Pocket Pair" : `High Card (${parsed[0]?.text || ""})`
        };
    }

    const score = Deck.bestHand(holeCards, communityCards);
    const category = Math.min(9, Math.floor(score / Math.pow(13, 5)));
    return {
        score,
        category,
        name: CATEGORY_LABELS[category] || "High Card"
    };
}

const practiceState = {
    handNumber: 0,
    dealerIndex: 0, // 0 = You, 1 = Bot Alpha, 2 = Bot Bravo
    inHand: false,
    round: "Pre-Flop",
    deck: null,
    community: [],
    pot: 0,
    highestBet: 0,
    lastRaiseSize: 20,
    smallBlind: 10,
    bigBlind: 20,
    seats: [
        { id: "player", name: "You", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: false, status: "Ready", reveal: true, blindRole: "" },
        { id: "bot0", name: "Bot Alpha", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: true, status: "Ready", reveal: false, blindRole: "" },
        { id: "bot1", name: "Bot Bravo", chips: 1000, bet: 0, folded: false, acted: false, cards: [], isBot: true, status: "Ready", reveal: false, blindRole: "" }
    ],
    turnIndex: 0,
    winnerIds: new Set(),
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
            s.acted = false;
            s.cards = [];
            s.status = "Ready";
            s.blindRole = "";
        });
        practiceState.inHand = false;
        practiceState.pot = 0;
        practiceState.highestBet = 0;
        practiceState.community = [];
        practiceState.winnerIds = new Set();
        practiceState.statusMessage = "Chips reset to 1,000 for everyone. Click 'Deal New Hand'!";
        renderPracticeTable(true);
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

    renderPracticeTable(true);
}

function startPracticeHand() {
    const totalPlayers = practiceState.seats.length;

    // Auto-rebuy any seat below Big Blind so practice play is uninterrupted
    practiceState.seats.forEach((s) => {
        if (s.chips < practiceState.bigBlind) {
            s.chips = 1000;
        }
        s.bet = 0;
        s.folded = false;
        s.acted = false;
        s.reveal = !s.isBot;
        s.status = "Active";
        s.blindRole = "";
    });

    practiceState.handNumber += 1;
    practiceState.dealerIndex = (practiceState.handNumber - 1) % totalPlayers;
    practiceState.deck = new Deck();
    practiceState.community = [];
    practiceState.pot = 0;
    practiceState.highestBet = 0;
    practiceState.lastRaiseSize = practiceState.bigBlind;
    practiceState.round = "Pre-Flop";
    practiceState.inHand = true;
    practiceState.winnerIds = new Set();

    // Deal 2 hole cards per player using Deck.hand(playerIndex, totalPlayers)
    practiceState.seats.forEach((s, idx) => {
        s.cards = practiceState.deck.hand(idx, totalPlayers);
    });

    // Post Small Blind and Big Blind
    const sbIdx = (practiceState.dealerIndex + 1) % totalPlayers;
    const bbIdx = (practiceState.dealerIndex + 2) % totalPlayers;

    postPracticeBlind(sbIdx, practiceState.smallBlind, "SB");
    postPracticeBlind(bbIdx, practiceState.bigBlind, "BB");

    practiceState.highestBet = practiceState.bigBlind;
    practiceState.turnIndex = (bbIdx + 1) % totalPlayers;
    practiceState.statusMessage = `Hand #${practiceState.handNumber} dealt! Blinds posted (${practiceState.smallBlind}/${practiceState.bigBlind}).`;

    renderPracticeTable(true);
    advancePracticeTurnIfBot();
}

function postPracticeBlind(seatIdx, blindAmt, role) {
    const seat = practiceState.seats[seatIdx];
    const actual = Math.min(seat.chips, blindAmt);
    seat.chips -= actual;
    seat.bet += actual;
    practiceState.pot += actual;
    seat.blindRole = role;
    seat.status = `${role === "SB" ? "Small Blind" : "Big Blind"} (${actual})`;
}

function handleHumanPracticeAction(action, raiseTarget = 0) {
    if (!practiceState.inHand || practiceState.turnIndex !== 0) return;

    const player = practiceState.seats[0];
    if (action === "Fold") {
        player.folded = true;
        player.acted = true;
        player.status = "Folded";
    } else if (action === "Check") {
        if (player.bet < practiceState.highestBet) return;
        player.acted = true;
        player.status = "Acted";
    } else if (action === "Call") {
        const toCall = Math.min(player.chips, practiceState.highestBet - player.bet);
        player.chips -= toCall;
        player.bet += toCall;
        practiceState.pot += toCall;
        player.acted = true;
        player.status = player.chips === 0 ? "All-In" : "Acted";
    } else if (action === "Raise") {
        const minRaise = practiceState.highestBet === 0
            ? practiceState.bigBlind
            : practiceState.highestBet + practiceState.lastRaiseSize;
        const maxRaise = player.bet + player.chips;
        const validTarget = Math.max(minRaise, Math.min(raiseTarget, maxRaise));
        const added = Math.min(player.chips, validTarget - player.bet);
        if (added <= 0) return;

        const previousHighest = practiceState.highestBet;
        player.chips -= added;
        player.bet += added;
        practiceState.pot += added;

        if (player.bet > previousHighest) {
            const raiseDelta = player.bet - previousHighest;
            practiceState.highestBet = player.bet;
            if (raiseDelta >= practiceState.lastRaiseSize) {
                practiceState.lastRaiseSize = raiseDelta;
                practiceState.seats.forEach((s, idx) => {
                    if (idx !== 0 && !s.folded && s.chips > 0) {
                        s.acted = false;
                    }
                });
            }
        }

        player.acted = true;
        player.status = player.chips === 0 ? "All-In" : `Raised (${player.bet})`;
    }

    progressPracticeRound();
}

function advancePracticeTurnIfBot() {
    if (!practiceState.inHand) return;
    if (practiceState.turnIndex === 0) {
        renderPracticeTable(true);
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

    const handEval = evaluatePracticeCardsWithPokerLogic(bot.cards, practiceState.community);
    const rank0 = (bot.cards[0] - 1) % 13;
    const rank1 = (bot.cards[1] - 1) % 13;
    const highCardRank = Math.max(rank0, rank1);
    const isPocketPair = rank0 === rank1;

    let decision = "Check";

    if (difficulty === "easy") {
        if (toCall === 0) {
            decision = "Check";
        } else if (toCall > 100 && handEval.category === 0 && highCardRank < 9) {
            decision = "Fold";
        } else {
            decision = "Call";
        }
    } else if (difficulty === "medium") {
        const strong = isPocketPair || handEval.category >= 1 || highCardRank >= 11;
        if (toCall === 0) {
            decision = strong && Math.random() < 0.45 && bot.chips >= practiceState.bigBlind * 2 ? "Raise" : "Check";
        } else if (strong || toCall <= practiceState.bigBlind) {
            decision = handEval.category >= 2 && Math.random() < 0.35 && bot.chips > toCall + practiceState.bigBlind ? "Raise" : "Call";
        } else {
            decision = "Fold";
        }
    } else {
        const premium = isPocketPair || handEval.category >= 1 || (rank0 >= 9 && rank1 >= 9);
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
        bot.status = "Folded";
    } else if (decision === "Check") {
        bot.acted = true;
        bot.status = "Acted";
    } else if (decision === "Call") {
        const pay = Math.min(bot.chips, toCall);
        bot.chips -= pay;
        bot.bet += pay;
        practiceState.pot += pay;
        bot.acted = true;
        bot.status = bot.chips === 0 ? "All-In" : "Acted";
    } else if (decision === "Raise") {
        const minRaise = practiceState.highestBet === 0
            ? practiceState.bigBlind
            : practiceState.highestBet + practiceState.lastRaiseSize;
        const raiseTo = Math.min(bot.bet + bot.chips, Math.max(minRaise, practiceState.highestBet * 2));
        const pay = Math.min(bot.chips, raiseTo - bot.bet);
        const previousHighest = practiceState.highestBet;

        bot.chips -= pay;
        bot.bet += pay;
        practiceState.pot += pay;
        bot.acted = true;
        bot.status = bot.chips === 0 ? "All-In" : `Raised (${bot.bet})`;

        if (bot.bet > previousHighest) {
            const raiseDelta = bot.bet - previousHighest;
            practiceState.highestBet = bot.bet;
            if (raiseDelta >= practiceState.lastRaiseSize) {
                practiceState.lastRaiseSize = raiseDelta;
                practiceState.seats.forEach((s, idx) => {
                    if (idx !== seatIdx && !s.folded && s.chips > 0) {
                        s.acted = false;
                    }
                });
            }
        }
    }
}

function progressPracticeRound() {
    const activeSeats = practiceState.seats.filter((s) => !s.folded);
    const totalPlayers = practiceState.seats.length;

    if (activeSeats.length === 1) {
        const winner = activeSeats[0];
        winner.chips += practiceState.pot;
        practiceState.winnerIds = new Set([winner.id]);
        practiceState.statusMessage = `${winner.name} wins ${practiceState.pot} (all opponents folded)! Click 'Deal New Hand' to play again.`;
        practiceState.pot = 0;
        practiceState.inHand = false;
        renderPracticeTable(true);
        return;
    }

    const allMatched = activeSeats.every((s) => s.chips === 0 || (s.acted && s.bet === practiceState.highestBet));

    if (allMatched) {
        if (practiceState.round === "River") {
            resolvePracticeShowdown(activeSeats);
            return;
        }

        practiceState.seats.forEach((s) => {
            s.bet = 0;
            s.acted = false;
            if (!s.folded && s.chips > 0) s.status = "Active";
        });
        practiceState.highestBet = 0;
        practiceState.lastRaiseSize = practiceState.bigBlind;

        // Deal community cards via Deck methods from pokerLogic.js
        if (practiceState.round === "Pre-Flop") {
            practiceState.round = "Flop";
            practiceState.community = practiceState.deck.showFlop(totalPlayers);
        } else if (practiceState.round === "Flop") {
            practiceState.round = "Turn";
            practiceState.community.push(practiceState.deck.showTurn(totalPlayers));
        } else if (practiceState.round === "Turn") {
            practiceState.round = "River";
            practiceState.community.push(practiceState.deck.showRiver(totalPlayers));
        }

        let nextIdx = (practiceState.dealerIndex + 1) % totalPlayers;
        let guard = 0;
        while ((practiceState.seats[nextIdx].folded || practiceState.seats[nextIdx].chips === 0) && guard < totalPlayers) {
            nextIdx = (nextIdx + 1) % totalPlayers;
            guard++;
        }
        practiceState.turnIndex = nextIdx;
        practiceState.statusMessage = `${practiceState.round} dealt!`;
        renderPracticeTable(true);

        if (activeSeats.every((s) => s.chips === 0)) {
            setTimeout(progressPracticeRound, 650);
            return;
        }

        advancePracticeTurnIfBot();
        return;
    }

    let nextIdx = (practiceState.turnIndex + 1) % totalPlayers;
    let guard = 0;
    while ((practiceState.seats[nextIdx].folded || practiceState.seats[nextIdx].chips === 0) && guard < totalPlayers) {
        nextIdx = (nextIdx + 1) % totalPlayers;
        guard++;
    }
    practiceState.turnIndex = nextIdx;
    renderPracticeTable(false);
    advancePracticeTurnIfBot();
}

function resolvePracticeShowdown(activeSeats) {
    let bestScore = -1;
    let winners = [];
    let winningHandName = "";

    activeSeats.forEach((seat) => {
        const evalRes = evaluatePracticeCardsWithPokerLogic(seat.cards, practiceState.community);
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
    practiceState.winnerIds = winnerIds;
    const humanMuck = Boolean(document.getElementById("prac-muck-toggle")?.checked);
    const difficulty = document.getElementById("botDifficultySelect")?.value || "medium";

    activeSeats.forEach((seat) => {
        const isWinner = winnerIds.has(seat.id);
        if (isWinner) {
            seat.reveal = true;
            seat.status = `Winner (${seat.evalResult.name})`;
        } else if (seat.id === "player") {
            seat.reveal = !humanMuck;
            seat.status = humanMuck ? "Lost (Mucked)" : `Lost (${seat.evalResult.name})`;
        } else {
            const botMucks = difficulty === "hard";
            seat.reveal = !botMucks;
            seat.status = botMucks ? "Lost (Mucked)" : `Lost (${seat.evalResult.name})`;
        }
    });

    const winnerNames = winners.map((w) => w.name).join(" & ");
    practiceState.statusMessage = `Showdown! ${winnerNames} won ${practiceState.pot} with ${winningHandName}! Click 'Deal New Hand' for another round.`;
    practiceState.pot = 0;
    practiceState.inHand = false;
    renderPracticeTable(true);
}

function renderPracticeTable(syncRaiseInputs = false) {
    const difficulty = document.getElementById("botDifficultySelect")?.value || "medium";
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

    document.getElementById("prac-pot").textContent = String(practiceState.pot);
    document.getElementById("prac-round").textContent = practiceState.round;
    document.getElementById("prac-hand-num").textContent = String(practiceState.handNumber);
    document.getElementById("prac-table-status").textContent = practiceState.statusMessage;

    const currentTurnSeat = practiceState.inHand ? practiceState.seats[practiceState.turnIndex] : null;
    document.getElementById("prac-current-turn").textContent = currentTurnSeat ? currentTurnSeat.name : "None";

    // Render 5 community card slots using gameplay .card styling
    const commEl = document.getElementById("prac-community-cards");
    if (commEl) {
        commEl.innerHTML = "";
        for (let i = 0; i < 5; i++) {
            const cardNum = practiceState.community[i];
            commEl.appendChild(createGameplayCardElement(cardNum, cardNum === undefined));
        }
    }

    // Render all seats on the live poker table layout
    const tableSeats = practiceState.seats.map((s, idx) => ({
        name: s.isBot ? `${s.name} [${diffLabel}]` : s.name,
        isCurrent: !s.isBot,
        isDealer: practiceState.inHand && practiceState.dealerIndex === idx,
        blindRole: practiceState.inHand ? s.blindRole : "",
        isActiveTurn: practiceState.inHand && practiceState.turnIndex === idx,
        isWinner: practiceState.winnerIds.has(s.id),
        folded: s.folded,
        chips: s.chips,
        bet: s.bet,
        status: s.status,
        cards: s.isBot ? s.cards : [],
        revealCards: s.reveal
    }));

    renderTableSeats(
        document.getElementById("prac-left-side"),
        document.getElementById("prac-right-side"),
        tableSeats
    );

    // Update "Your Hand" & "Your Turn" panels matching tableDisplay.js
    const human = practiceState.seats[0];
    document.getElementById("prac-player-label").textContent = "Your Hand (You)";
    document.getElementById("prac-player-chips").textContent = Number(human.chips).toLocaleString();
    document.getElementById("prac-available-chips").textContent = Number(human.chips).toLocaleString();
    document.getElementById("prac-player-bet").textContent = String(human.bet);
    document.getElementById("prac-current-bet").textContent = String(practiceState.highestBet);

    const humanCardsBox = document.getElementById("prac-player-cards");
    if (human.cards.length === 2) {
        renderGameplayCards(humanCardsBox, human.cards, false);
        const evalRes = evaluatePracticeCardsWithPokerLogic(human.cards, practiceState.community);
        document.getElementById("prac-hand-eval").textContent = evalRes.name;
    } else {
        if (humanCardsBox) humanCardsBox.innerHTML = "";
        document.getElementById("prac-hand-eval").textContent = "--";
    }

    const isHumanTurn = practiceState.inHand && practiceState.turnIndex === 0 && !human.folded;
    const toCall = Math.max(0, practiceState.highestBet - human.bet);
    const minRaise = practiceState.highestBet === 0
        ? practiceState.bigBlind
        : practiceState.highestBet + practiceState.lastRaiseSize;
    const maxRaise = human.bet + human.chips;
    const canRaise = isHumanTurn && maxRaise >= minRaise;

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
        callBtn.textContent = toCall > 0 ? `Call (${Math.min(human.chips, toCall)})` : "Call";
    }
    if (raiseBtn) raiseBtn.disabled = !canRaise;

    if (raiseInput && betScale) {
        raiseInput.min = String(minRaise);
        raiseInput.max = String(Math.max(minRaise, maxRaise));
        betScale.min = String(minRaise);
        betScale.max = String(Math.max(minRaise, maxRaise));
        raiseInput.disabled = !canRaise;
        betScale.disabled = !canRaise;

        document.getElementById("prac-raise-min-label").textContent = String(minRaise);
        document.getElementById("prac-raise-max-label").textContent = String(maxRaise);

        if (syncRaiseInputs) {
            const amount = canRaise
                ? Math.max(minRaise, Math.min(Number(raiseInput.value) || minRaise, maxRaise))
                : 0;
            raiseInput.value = String(amount);
            betScale.value = String(amount);
        }
    }
}

class Deck {
  constructor() {
    this.deck = Array.from({ length: 52 }, (_, i) => i + 1);
    this.shuffleCards();
  }

  /**
   * Performs a randomized Fisher-Yates shuffle using the deterministic PRNG.
   */
  shuffleCards() {
    this.deck.sort((a, b) => a - b);
    for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * Deals two hole cards to a specific player given the total player count.
   * @param {number} playerIndex Zero-based index of the player.
   * @param {number} totalPlayers Total number of players at the table.
   * @returns {number[]} Array containing the two hole cards.
   */
  hand(playerIndex, totalPlayers) {
    const card1 = this.deck[playerIndex];
    const card2 = this.deck[playerIndex + totalPlayers];
    return [card1, card2];
  }

  /**
   * Deals the three community cards (flop) after burning a card.
   * @param {number} totalPlayers Total number of players at the table.
   * @returns {number[]} Array of three flop cards.
   */
  showFlop(totalPlayers) {
    const burnIndex = 2 * totalPlayers;
    const flopStart = burnIndex + 1;
    return this.deck.slice(flopStart, flopStart + 3);
  }

  /**
   * Deals the fourth community card (turn) after burning a card.
   * @param {number} totalPlayers Total number of players at the table.
   * @returns {number} The turn card.
   */
  showTurn(totalPlayers) {
    const turnIndex = 2 * totalPlayers + 5;
    return this.deck[turnIndex];
  }

  /**
   * Deals the fifth community card (river) after burning a card.
   * @param {number} totalPlayers Total number of players at the table.
   * @returns {number} The river card.
   */
  showRiver(totalPlayers) {
    const riverIndex = 2 * totalPlayers + 7;
    return this.deck[riverIndex];
  }

  /**
   * Retrieves all five community cards in order (flop, turn, river).
   * @param {number} totalPlayers Total number of players at the table.
   * @returns {number[]} Array of all five community cards.
   */
  commonCards(totalPlayers) {
    const flop = this.showFlop(totalPlayers);
    const turn = this.showTurn(totalPlayers);
    const river = this.showRiver(totalPlayers);
    return [...flop, turn, river];
  }

  // --- Internal Helper Methods for Hand Evaluation ---
  
  static #parseCard(card) {
    return {
      rank: (card - 1) % 13,
      suit: Math.floor((card - 1) / 13)
    };
  }

  static #getParsedCards(hand, commonCards) {
    const allCards = [...hand, ...commonCards];
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
    
    if ([12, 0, 1, 2, 3].every(rank => ranks.includes(rank))) {
      return [3, 2, 1, 0, 0];
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

  static cardToText(cardNumber) {
    const suits = ["♥", "♦", "♣", "♠"];
    const ranks = ["2", "3", "4", "5", "6", "7",
                  "8", "9", "10", "J", "Q", "K", "A"];
    const suitIndex = Math.floor((cardNumber - 1) / 13); 
    const rankIndex = (cardNumber - 1) % 13;

    return ranks[rankIndex] + suits[suitIndex];
  }

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

    if ([12, 0, 1, 2, 3].every(rank => uniqueRanks.includes(rank))) {
      return true;
    }

    uniqueRanks.sort((a, b) => b - a);
    const checkRanks = [...uniqueRanks];

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
function getPlayerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("playerId");
    
    if (!id) {
        const keys = Array.from(urlParams.keys());
        if (keys.length > 0) {
            id = keys[0];
        }
    }
    
    return id ? decodeURIComponent(id.trim()) : "";
}

let currentPlayerId = getPlayerIdFromUrl();

function checkBlankName() {
    if (!currentPlayerId) {
        const name = prompt("Enter your Player ID to join the table:");
        if (name && name.trim()) {
            window.location.href = `tableDisplay.html?playerId=${encodeURIComponent(name.trim())}`;
            return false;
        } else {
            alert("A valid Player ID is required to play.");
            return checkBlankName();
        }
    }
    return true;
}

if (!checkBlankName()) {
    // halts execution until redirection
}

document.getElementById("header-player-name").textContent = currentPlayerId;
document.getElementById("display-player-id").textContent = currentPlayerId;

const betScale = document.getElementById("bet-scale");
const raiseAmount = document.getElementById("raise-amount");
const tableMessage = document.getElementById("table-message");
const leftSideContainer = document.getElementById("left-player-side");
const rightSideContainer = document.getElementById("right-player-side");
const totalPotElem = document.getElementById("total-pot");
const yourChipsElem = document.getElementById("your-chips");
const availableChipsElem = document.getElementById("available-chips");
const yourBetElem = document.getElementById("your-bet");
const currentBetElem = document.getElementById("current-bet");
const currentTurnPlayerElem = document.getElementById("current-turn-player");
const timerText = document.getElementById("turn-timer-text");
const timerCircle = document.getElementById("turn-timer-circle");
const actionButtons = document.querySelectorAll("[data-action]");

async function leaveTable(destination) {
    if (!confirm("Are you sure you want to leave the table?")) {
        return;
    }

    try {
        const response = await fetch("/api/table/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId })
        });

        if (!response.ok) {
            throw new Error("Failed to leave table.");
        }

        window.location.href = destination;
    } 
    catch (error) {
        console.error("Failed to leave table:", error);
        alert("Unable to leave the table. Please try again.");
    }
}

document.getElementById("leave-table-btn")
    .addEventListener("click", () => {
        leaveTable("lobby.html");
    });

document.getElementById("home-link")
    .addEventListener("click", (event) => {
        event.preventDefault();
        leaveTable("index.html");
    });

document.getElementById("lobby-link")
    .addEventListener("click", (event) => {
        event.preventDefault();
        leaveTable("lobby.html");
    });

let resetTimeout = null;
let currentTimerRemaining = 30;

function updateTimerDisplay(rem) {
    currentTimerRemaining = rem;
    if (timerText) timerText.textContent = rem + "s";
    if (timerCircle) {
        if (rem > 15) {
            timerCircle.style.backgroundColor = "#3c8d79";
            timerCircle.style.borderColor = "#2e6d5e";
        } else if (rem > 5) {
            timerCircle.style.backgroundColor = "#f1c40f";
            timerCircle.style.borderColor = "#d4ac0d";
        } else {
            timerCircle.style.backgroundColor = "#d42c25";
            timerCircle.style.borderColor = "#961e19";
        }
    }
}

async function fetchTableStatus() {
    try {
        const response = await fetch(`/api/table/status?playerId=${encodeURIComponent(currentPlayerId)}`);
        if (!response.ok) throw new Error("Failed to fetch table status.");
        return await response.json();
    } catch (error) {
        console.error("Error fetching table status:", error);
        return null;
    }
}

function renderActivePlayers(status) {
    if (!leftSideContainer || !rightSideContainer) return;
    leftSideContainer.innerHTML = "";
    rightSideContainer.innerHTML = "";

    const players = status.players || [];
    const half = Math.ceil(players.length / 2);

    players.forEach((p, index) => {
        const seat = document.createElement("div");

        let playerStatusClass = "";
        if (p.isFolded || p.status === "Folded") {
            playerStatusClass = "folded";
        } else if (p.isActive || p.isCurrent || p.status === "Active" || p.status === "Betting" || p.status === "Acted") {
            playerStatusClass = "active";
        } else if (p.isDisconnected || p.status === "Disconnected") {
            playerStatusClass = "disconnected";
        }

        seat.className = `player-seat ${playerStatusClass} ${p.isCurrent ? "current-player" : ""}`;
        seat.id = `seat-${p.id}`;

        const nameSpan = document.createElement("span");
        nameSpan.className = "player-name";
        nameSpan.textContent = p.id + (p.isCurrent ? " (You)" : "");

        if (p.isDealer) {
            const dealerBadge = document.createElement("span");
            dealerBadge.className = "dealer-badge";
            dealerBadge.textContent = "D";
            nameSpan.appendChild(dealerBadge);
        }

        const statusSpan = document.createElement("span");
        statusSpan.className = "player-status";
        statusSpan.textContent = p.status;

        const chipsSpan = document.createElement("span");
        chipsSpan.className = "player-chips";
        chipsSpan.textContent = `${p.chips.toLocaleString()} chips`;

        seat.append(nameSpan, statusSpan, chipsSpan);

        if (index < half) {
            leftSideContainer.appendChild(seat);
        } else {
            rightSideContainer.appendChild(seat);
        }
    });

    totalPotElem.textContent = status.pot || 0;
    yourChipsElem.textContent = (status.playerChips || 0).toLocaleString();
    availableChipsElem.textContent = (status.playerChips || 0).toLocaleString();
    yourBetElem.textContent = status.playerBet || 0;
    currentBetElem.textContent = status.currentHighestBet || 0;

    if (currentTurnPlayerElem) {
        currentTurnPlayerElem.textContent = status.currentTurnPlayer || "None";
    }

    if (status.turnTimeRemaining !== undefined) {
        updateTimerDisplay(status.turnTimeRemaining);
    }

    // Gate all action buttons (including Fold) when game is not in progress or not player's turn
    actionButtons.forEach(btn => {
        const action = btn.dataset.action;
        if (status.buttonsBlocked) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        } else {
            let isApplicable = true;
            if (action === "Check" && status.canCheck === false) {
                isApplicable = false;
            }
            if (action === "Call" && status.canCall === false) {
                isApplicable = false;
            }

            if (!isApplicable) {
                btn.disabled = true;
                btn.style.opacity = "0.3";
                btn.style.cursor = "not-allowed";
            } else {
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            }
        }
    });

    if (status.communityCards) {
        renderCards("community-cards", status.communityCards);
    }
    if (status.playerHand && status.playerHand.length > 0) {
        renderCards("player-cards", status.playerHand);
    }

    if (status.currentTurnPlayer) {
        tableMessage.textContent = `Current turn: ${status.currentTurnPlayer}`;
    }
}

async function joinTable() {
    try {
        const response = await fetch("/api/table/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId })
        });
        if (!response.ok) throw new Error("Failed to join table.");
        const data = await response.json();
        tableMessage.textContent = data.message;
        hideJoinPrompt();
        refreshUI();
    } catch (error) {
        console.error("Error joining table:", error);
        tableMessage.textContent = "Could not join table.";
    }
}

function showJoinPrompt(isSpectator = false) {
    let joinModalElem = document.getElementById("join-modal");
    if (!joinModalElem) {
        joinModalElem = document.createElement("div");
        joinModalElem.id = "join-modal";
        joinModalElem.className = "modal-overlay";
        joinModalElem.style.display = "flex";
        joinModalElem.innerHTML = `
            <div class="modal-content">
                <h2>Texas Hold'em Table</h2>
                <p>${isSpectator ? "Game in progress! You have joined as an inactive spectator and will be able to play when the next game starts." : "Welcome! Click below to join the table."}</p>
                <button type="button" id="join-table-btn">Join / Enter</button>
            </div>
        `;
        document.body.appendChild(joinModalElem);
        document.getElementById("join-table-btn").addEventListener("click", joinTable);
    } else {
        joinModalElem.style.display = "flex";
    }
}

function hideJoinPrompt() {
    const joinModalElem = document.getElementById("join-modal");
    if (joinModalElem) {
        joinModalElem.style.display = "none";
    }
}

function renderStartGameButton(status) {
    let startBtnContainer = document.getElementById("start-game-container");
    if (!status.gameStarted && status.isPlayer) {
        if (!startBtnContainer) {
            startBtnContainer = document.createElement("div");
            startBtnContainer.id = "start-game-container";
            startBtnContainer.style.textAlign = "center";
            startBtnContainer.style.margin = "10px 0";
            startBtnContainer.innerHTML = `
                <button type="button" id="start-game-btn" class="action-button raise" style="width: auto; height: auto; padding: 10px 20px; border-radius: 8px;">Start Game (Need 2+ Players)</button>
            `;
            const gameHeading = document.querySelector(".game-heading");
            if (gameHeading) gameHeading.appendChild(startBtnContainer);
            document.getElementById("start-game-btn").addEventListener("click", startGame);
        }
    } else if (startBtnContainer) {
        startBtnContainer.remove();
    }
}

async function startGame() {
    try {
        const response = await fetch("/api/table/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to start game.");
        }
        const data = await response.json();
        renderCards("community-cards", data.communityCards);
        if (data.playerHand) {
            renderCards("player-cards", data.playerHand);
        }
        if (currentTurnPlayerElem && data.currentTurnPlayer) {
            currentTurnPlayerElem.textContent = data.currentTurnPlayer;
        }
        if (data.turnTimeRemaining !== undefined) {
            updateTimerDisplay(data.turnTimeRemaining);
        }
        tableMessage.textContent = "Game started! Place your bets or check.";
        refreshUI();
    } catch (error) {
        alert(error.message);
    }
}

let isShowingShowdown = false;

async function handleSequencedShowdown(winnerData) {
    if (!winnerData || !winnerData.winners) return;

    isShowingShowdown = true; // Lock UI updates during showdown sequence

    const showdownHands = winnerData.showdownHands || {};
    const playerIds = Object.keys(showdownHands);
    const winnersList = winnerData.winners || [];

    tableMessage.textContent = "Showdown: Revealing active hands...";

    for (let i = 0; i < playerIds.length; i++) {
        const pid = playerIds[i];
        const cards = showdownHands[pid];
        
        tableMessage.textContent = `Revealing cards for ${pid}...`;
        
        const seatElem = document.getElementById(`seat-${pid}`);
        if (seatElem && cards && Array.isArray(cards)) {
            let revealBox = seatElem.querySelector(".revealed-cards");
            if (!revealBox) {
                revealBox = document.createElement("div");
                revealBox.className = "revealed-cards";
                revealBox.style.display = "flex";
                revealBox.style.gap = "3px";
                revealBox.style.justifyContent = "center";
                revealBox.style.marginTop = "6px";
                seatElem.appendChild(revealBox);
            }
            revealBox.innerHTML = "";
            cards.forEach(c => {
                const cDiv = document.createElement("div");
                cDiv.style.width = "24px";
                cDiv.style.height = "34px";
                cDiv.style.display = "flex";
                cDiv.style.alignItems = "center";
                cDiv.style.justifyContent = "center";
                cDiv.style.fontSize = "11px";
                cDiv.style.background = "#F4F7FC";
                cDiv.style.border = "1px solid #315CA8";
                cDiv.style.borderRadius = "4px";
                cDiv.style.color = (c.includes("♥") || c.includes("♦")) ? "#D42C25" : "#202B40";
                cDiv.style.fontWeight = "bold";
                cDiv.textContent = c;
                revealBox.appendChild(cDiv);
            });
        }

        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    winnersList.forEach(wId => {
        const winningSeat = document.getElementById(`seat-${wId}`);
        if (winningSeat) {
            winningSeat.classList.add("winner-seat");
        }
    });

    const winnersText = winnersList.join(", ");
    tableMessage.textContent = `Winner(s): ${winnersText} | Pot Won: ${winnerData.pot}`;

    setTimeout(() => {
        isShowingShowdown = false; // Unlock UI updates after showdown finishes
        refreshUI();
    }, 4000);
}

async function refreshUI() {
    if (isShowingShowdown) return; // Skip refreshing UI while showdown cards are being revealed

    const status = await fetchTableStatus();
    if (!status) return;

    if (!status.inTable) {
        showJoinPrompt(status.gameInProgress);
        return;
    }

    if (status.isSpectator) {
        tableMessage.textContent = "You are spectating. You will join active players when the next game starts.";
    }

    renderActivePlayers(status);
    renderStartGameButton(status);
}

const socket = io();
socket.on("connect", () => {
    console.log("Connected to server via Socket.io");
    socket.emit("join_table", "main");
    refreshUI();
});

socket.on("TABLE_UPDATED", () => {
    refreshUI();
});

socket.on("TURN_TIMER", (data) => {
    if (data && typeof data.turnTimeRemaining === "number") {
        updateTimerDisplay(data.turnTimeRemaining);
    }
});

socket.on("SHOWDOWN_REVEAL", async (winnerData) => {
    await handleSequencedShowdown(winnerData);
});

function renderCards(containerId, cards) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = "";

    cards.forEach((cardText) => {
        const card = document.createElement("div");
        card.className = "card";

        if (cardText.includes("♥") || cardText.includes("♦")) {
            card.classList.add("red-suit");
        }

        card.textContent = cardText;
        container.appendChild(card);
    });
}

betScale.addEventListener("input", () => {
    raiseAmount.value = betScale.value;
});

raiseAmount.addEventListener("input", () => {
    const amount = Number(raiseAmount.value);
    if (amount >= 20 && amount <= 1000) {
        betScale.value = amount;
    }
});

actionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        const action = button.dataset.action;
        let amount = 0;

        if (action === "Raise") {
            amount = Number(raiseAmount.value);
            if (!Number.isFinite(amount) || amount < 20) {
                tableMessage.textContent = "Enter a valid raise amount.";
                return;
            }
        }

        try {
            const res = await fetch("/api/table/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId: currentPlayerId, action, amount })
            });

            if (!res.ok) {
                const err = await res.json();
                tableMessage.textContent = err.error || "Action failed.";
                return;
            }

            const data = await res.json();

            if (data.winnerData && data.winnerData.winners) {
                await handleSequencedShowdown(data.winnerData);
                return;
            }

            tableMessage.textContent = `${action} successful. Turn updated.`;
            refreshUI();
        } catch (error) {
            console.error("Error executing action:", error);
        }
    });
});

document.getElementById("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";
    const sender = document.createElement("strong");
    sender.textContent = currentPlayerId + ": ";
    messageElement.append(sender, document.createTextNode(message));

    const chatMessages = document.getElementById("chat-messages");
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    input.value = "";
});
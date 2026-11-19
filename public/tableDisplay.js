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

const headerPlayerNameElem = document.getElementById("header-player-name");
const accountChipsElem = document.getElementById("account-chips");
const displayPlayerIdElem = document.getElementById("display-player-id");

if (headerPlayerNameElem) headerPlayerNameElem.textContent = currentPlayerId;
if (displayPlayerIdElem) displayPlayerIdElem.textContent = currentPlayerId;

const betScale = document.getElementById("bet-scale");
const raiseAmount = document.getElementById("raise-amount");
const tableMessage = document.getElementById("table-message");
const winnerModal = document.getElementById("winner-modal");
const winnerModalText = document.getElementById("winner-modal-text");
const modalCloseBtn = document.getElementById("modal-close-btn");
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

let lastRenderedChatCount = 0;

// Loads logged-in user points/username if available, without overriding URL playerId flow
async function syncAccountPoints() {
    try {
        const res = await fetch("/loggeduser");
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user || data;

        if (user && user.username) {
            // Use the real account username for table seats, actions, and chat messages
            currentPlayerId = user.username;
            if (headerPlayerNameElem) headerPlayerNameElem.textContent = user.username;
            if (displayPlayerIdElem) displayPlayerIdElem.textContent = user.username;
        }

        if (user && accountChipsElem) {
            const balance = user.points !== undefined
                ? user.points
                : (user.chips !== undefined ? user.chips : null);
            if (balance !== null) {
                accountChipsElem.textContent = Number(balance).toLocaleString();
            }
        }
    } catch (error) {
        console.error("Failed to sync account points:", error);
    }
}

function renderChatMessages(messages) {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages || !Array.isArray(messages)) return;

    if (messages.length === lastRenderedChatCount) return;

    chatMessages.innerHTML = "";
    messages.forEach((msg) => {
        const messageElement = document.createElement("div");
        messageElement.className = "chat-message";

        const sender = document.createElement("strong");
        sender.textContent = `${msg.sender}: `;

        messageElement.append(sender, document.createTextNode(msg.text));
        chatMessages.appendChild(messageElement);
    });

    lastRenderedChatCount = messages.length;
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Dynamic Leave Button Injection to guarantee it loads without manual page refresh
let leaveTableBtn = document.getElementById("leave-table-btn");
if (!leaveTableBtn) {
    const nav = document.querySelector(".navigation");
    if (nav) {
        leaveTableBtn = document.createElement("button");
        leaveTableBtn.id = "leave-table-btn";
        leaveTableBtn.textContent = "Leave Table";
        leaveTableBtn.style.background = "#d42c25";
        leaveTableBtn.style.borderColor = "#961e19";
        nav.insertBefore(leaveTableBtn, nav.firstChild);
    }
}

if (leaveTableBtn) {
    leaveTableBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to leave the table?")) {
            try {
                await fetch("/api/table/leave", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playerId: currentPlayerId })
                });
                window.location.href = "index.html";
            } catch (error) {
                console.error("Failed to leave table:", error);
            }
        }
    });
}

let modalTimeout = null;
let currentTimerRemaining = 30;

function updateTimerDisplay(rem) {
    currentTimerRemaining = rem;
    if (timerText) timerText.textContent = rem + "s";
    if (timerCircle) {
        if (rem > 15) {
            timerCircle.style.backgroundColor = "#3c8d79"; // green
            timerCircle.style.borderColor = "#2e6d5e";
        } else if (rem > 5) {
            timerCircle.style.backgroundColor = "#f1c40f"; // yellow
            timerCircle.style.borderColor = "#d4ac0d";
        } else {
            timerCircle.style.backgroundColor = "#d42c25"; // red
            timerCircle.style.borderColor = "#961e19";
        }
    }
}

setInterval(() => {
    if (currentTimerRemaining > 0) {
        currentTimerRemaining--;
        updateTimerDisplay(currentTimerRemaining);
    }
}, 1000);

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
        seat.className = `player-seat active ${p.isCurrent ? "current-player" : ""}`;

        const nameSpan = document.createElement("span");
        nameSpan.className = "player-name";
        nameSpan.textContent = p.id + (p.isDealer ? " (D)" : "") + (p.isCurrent ? " (You)" : "");

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

    if (accountChipsElem && accountChipsElem.textContent === "--") {
        accountChipsElem.textContent = (status.playerChips || 0).toLocaleString();
    }

    if (currentTurnPlayerElem) {
        currentTurnPlayerElem.textContent = status.currentTurnPlayer || "None";
    }

    if (status.turnTimeRemaining !== undefined) {
        updateTimerDisplay(status.turnTimeRemaining);
    }

    if (status.buttonsBlocked) {
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        });
    } else {
        actionButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        });
    }

    if (status.communityCards) {
        renderCards("community-cards", status.communityCards);
    }
    if (status.playerHand && status.playerHand.length > 0) {
        renderCards("player-cards", status.playerHand);
    }

    if (status.currentTurnPlayer) {
        tableMessage.textContent = `Current turn: ${status.currentTurnPlayer}`;
    }

    if (status.chatMessages) {
        renderChatMessages(status.chatMessages);
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

async function refreshUI() {
    const status = await fetchTableStatus();
    if (!status) return;

    if (status.chatMessages) {
        renderChatMessages(status.chatMessages);
    }

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

(async function initTablePage() {
    await syncAccountPoints();
    await refreshUI();
    setInterval(refreshUI, 2500);
})();

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
                const winnersText = data.winnerData.winners.join(", ");
                winnerModalText.innerHTML = `Winner(s):<br><strong>${winnersText}</strong><br>Pot Won: ${data.winnerData.pot}`;
                winnerModal.style.display = "flex";
                tableMessage.textContent = "Round complete. Showing winner...";

                if (modalTimeout) clearTimeout(modalTimeout);
                modalTimeout = setTimeout(() => {
                    winnerModal.style.display = "none";
                    refreshUI();
                }, 3500);
                return;
            }

            tableMessage.textContent = `${action} successful. Turn updated.`;
            refreshUI();
        } catch (error) {
            console.error("Error executing action:", error);
        }
    });
});

modalCloseBtn.addEventListener("click", () => {
    if (modalTimeout) clearTimeout(modalTimeout);
    winnerModal.style.display = "none";
    refreshUI();
});

document.getElementById("chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    try {
        const res = await fetch("/api/table/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayerId, message })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            tableMessage.textContent = err.error || "Could not send chat message.";
            return;
        }

        const data = await res.json();
        if (data.chatMessages) {
            renderChatMessages(data.chatMessages);
        }
    } catch (error) {
        console.error("Error sending chat message:", error);
    }
});
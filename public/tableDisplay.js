// ============================================================================
// File Name: tableDisplay.js
// Purpose: Frontend controller for tableDisplay.html. Manages identity, 
//          socket connections, UI rendering, timer display, and action handling.
// ============================================================================
let currentPlayerId = "";
let socket = null;

// Get the selected table from the URL
const urlParams = new URLSearchParams(window.location.search);
const currentTableId = urlParams.get("tableId")?.trim();

if (!currentTableId) {
    throw new Error(
        "Missing tableId in URL. Open a table through the dashboard or lobby."
    );
}

/*
function getPlayerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("playerId");
    return id && id !== "buyInAmount" && id !== "tableName" ? decodeURIComponent(id.trim()) : "";
}

// Robust initialization: URL > Logged-In User Session > Guest Storage > Fallback Guest
async function initializePlayerIdentity() {
    const identityMode = sessionStorage.getItem("identityMode");
    const savedGuestId = sessionStorage.getItem("guestPlayerId");

     // If this tab is already a guest, preserve that identity.
    if (identityMode === "guest" && savedGuestId) {
        currentPlayerId = savedGuestId;
    } else {
        currentPlayerId = getPlayerIdFromUrl();

        // If the URL explicitly has a Guest ID, lock it in immediately and stop session checks
        if (currentPlayerId && currentPlayerId.startsWith("Guest_")) {
            const headerName = document.getElementById("header-player-name");
            const displayName = document.getElementById("display-player-id");
            if (headerName) headerName.textContent = currentPlayerId;
            if (displayName) displayName.textContent = currentPlayerId;
            
            initializeSocketAndUI();
            return;
        } else if (!currentPlayerId) {

            // Otherwise, check server session for logged-in users
            try {
                const res = await fetch('/loggeduser');
                if (res.ok) {
                    const user = await res.json();
                    if (user && (user.username || user.email || user.id)) {
                        currentPlayerId = user.id || user.username || (user.email ? user.email.split("@")[0] : "");
                    }
                }
            } catch (e) {
                console.error("Failed to fetch user session:", e);
            }
        }
    }

    if (!currentPlayerId) {
        currentPlayerId = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
        sessionStorage.setItem("identityMode", "guest");
        sessionStorage.setItem("guestPlayerId", currentPlayerId);
    }

    const headerName = document.getElementById("header-player-name");
    const displayName = document.getElementById("display-player-id");
    if (headerName) headerName.textContent = currentPlayerId;
    if (displayName) displayName.textContent = currentPlayerId;

    await registerPlayerToTable(currentPlayerId);
}

//sends post requests to /api/table/join then initializes socket.io connection
async function registerPlayerToTable(playerId) {
    try {
        const modeParam = isSpectatorMode ? "spectator" : "player";
        await fetch(`/api/table/join?playerId=${encodeURIComponent(playerId)}&mode=${modeParam}`, {
            method: "POST"
        });
    } catch (error) {
        console.error("Error joining table:", error);
    }

    initializeSocketAndUI();
}

function initializeSocketAndUI() {
    if (socket) {
        return;
    }

    socket = io();
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

    refreshUI();
}

initializePlayerIdentity();

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
            body: JSON.stringify({ 
                tableId: currentTableId,
                playerId: currentPlayerId 
            })
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

const leaveBtn = document.getElementById("leave-table-btn");
if (leaveBtn) leaveBtn.addEventListener("click", () => leaveTable("lobby.html"));

const homeLink = document.getElementById("home-link");
if (homeLink) homeLink.addEventListener("click", (event) => {
    event.preventDefault();
    leaveTable("index.html");
});

const lobbyLink = document.getElementById("lobby-link");
if (lobbyLink) lobbyLink.addEventListener("click", (event) => {
    event.preventDefault();
    leaveTable("lobby.html");
});

// table link -> !defualt
document.getElementById("table-link")
    .addEventListener("click", (event) => {
        event.preventDefault();
    });


let modalTimeout = null;
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
        const params = new URLSearchParams({
            tableId: currentTableId,
            playerId: currentPlayerId
        });

        const response = await fetch(
            `/api/table/status?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error("Failed to fetch table status.");
        }

        return await response.json();

    } catch (error) {
        console.error("Error fetching table status:", error);
        return null;
    }
}

function renderTableDetails(status) {
    const elements = {
        "table-name": status.tableName,
        "small-blind": status.smallBlind,
        "big-blind": status.bigBlind,
        "table-buy-in": status.buyIn,
        "max-players": status.maxPlayers
    };

    Object.entries(elements).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);

        if (element && value !== undefined && value !== null) {
            element.textContent = value;
        }
    });
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

    if (totalPotElem) totalPotElem.textContent = status.pot || 0;
    if (yourChipsElem) yourChipsElem.textContent = (status.playerChips || 0).toLocaleString();
    if (availableChipsElem) availableChipsElem.textContent = (status.playerChips || 0).toLocaleString();
    if (yourBetElem) yourBetElem.textContent = status.playerBet || 0;
    if (currentBetElem) currentBetElem.textContent = status.currentHighestBet || 0;

    if (currentTurnPlayerElem) {
        currentTurnPlayerElem.textContent = status.currentTurnPlayer || "None";
    }

    if (status.turnTimeRemaining !== undefined) {
        updateTimerDisplay(status.turnTimeRemaining);
    }

    // Gate all action buttons properly based on status.buttonsBlocked and applicability
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

    if (status.currentTurnPlayer && tableMessage) {
        tableMessage.textContent = `Current turn: ${status.currentTurnPlayer}`;
    }
}

async function joinTable() {
    try {
        const response = await fetch("/api/table/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                tableId: currentTableId,
                playerId: currentPlayerId 
            })
        });
        if (!response.ok) throw new Error("Failed to join table.");
        const data = await response.json();
        if (tableMessage) tableMessage.textContent = data.message;
        hideJoinPrompt();
        refreshUI();
    } catch (error) {
        console.error("Error joining table:", error);
        if (tableMessage) tableMessage.textContent = "Could not join table.";
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
        if (tableMessage) tableMessage.textContent = "Game started! Place your bets or check.";
        refreshUI();
    } catch (error) {
        alert(error.message);
    }
}

let isShowingShowdown = false;

async function handleSequencedShowdown(winnerData) {
    if (!winnerData || !winnerData.winners) return;

    isShowingShowdown = true;

    const showdownHands = winnerData.showdownHands || {};
    const playerIds = Object.keys(showdownHands);
    const winnersList = winnerData.winners || [];

    if (tableMessage) tableMessage.textContent = "Showdown: Revealing active hands...";

    for (let i = 0; i < playerIds.length; i++) {
        const pid = playerIds[i];
        const cards = showdownHands[pid];
        
        if (tableMessage) tableMessage.textContent = `Revealing cards for ${pid}...`;
        
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
    if (tableMessage) tableMessage.textContent = `Winner(s): ${winnersText} | Pot Won: ${winnerData.pot}`;

    setTimeout(() => {
        isShowingShowdown = false;
        refreshUI();
    }, 4000);
}

async function refreshUI() {
    if (isShowingShowdown) return;

    const status = await fetchTableStatus();
    if (!status) return;

    // Update the selected table's displayed configuration
    renderTableDetails(status);

    if (!status.inTable) {
        showJoinPrompt(status.gameInProgress);
        return;
    }

    if (status.isSpectator) {
        if (tableMessage) tableMessage.textContent = "You are spectating. You will join active players when the next game starts.";
    }

    renderActivePlayers(status);
    renderStartGameButton(status);
}

const socket = io();
//When client connects, request the current table status to update the UI
socket.on("connect", () => {
    console.log("Connected to server via Socket.io");
    refreshUI();
});
//when any player acts, the server emits a TABLE_UPDATED event to all clients, prompting them to refresh their UI
socket.on("TABLE_UPDATED", (data) => {
    // Ignore updates explicitly belonging to another table
    if (data?.tableId && data.tableId !== currentTableId) {
        return;
    }

    refreshUI();
});

socket.on("TURN_TIMER", (data) => {
    // Only update the timer for the selected table
    if (data?.tableId !== currentTableId) {
        return;
    }

    if (typeof data.turnTimeRemaining === "number") {
        updateTimerDisplay(data.turnTimeRemaining);
    }
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

if (betScale) {
    betScale.addEventListener("input", () => {
        if (raiseAmount) raiseAmount.value = betScale.value;
    });
}

if (raiseAmount) {
    raiseAmount.addEventListener("input", () => {
        const amount = Number(raiseAmount.value);
        if (amount >= 20 && amount <= 1000) {
            betScale.value = amount;
        }
    });
}

actionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        const action = button.dataset.action;
        let amount = 0;
        const muckToggleElem = document.getElementById("muck-toggle");
        const muckPreference = muckToggleElem ? muckToggleElem.checked : false;

        if (action === "Raise") {
            amount = Number(raiseAmount.value);
            if (!Number.isFinite(amount) || amount < 20) {
                if (tableMessage) tableMessage.textContent = "Enter a valid raise amount.";
                return;
            }
        }

        try {
            const res = await fetch("/api/table/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tableId: currentTableId, playerId: currentPlayerId, action, amount, muckPreference })
            });

            if (!res.ok) {
                const err = await res.json();
                if (tableMessage) tableMessage.textContent = err.error || "Action failed.";
                return;
            }

            const data = await res.json();

            if (data.winnerData && data.winnerData.winners) {
                await handleSequencedShowdown(data.winnerData);
                return;
            }

            if (tableMessage) tableMessage.textContent = `${action} successful. Turn updated.`;
            refreshUI();
        } catch (error) {
            console.error("Error executing action:", error);
        }
    });
});

const chatForm = document.getElementById("chat-form");
if (chatForm) {
    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("chat-input");
        if (!input) return;
        const message = input.value.trim();
        if (!message) return;

        const messageElement = document.createElement("div");
        messageElement.className = "chat-message";
        const sender = document.createElement("strong");
        sender.textContent = currentPlayerId + ": ";
        messageElement.append(sender, document.createTextNode(message));

        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) {
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        input.value = "";
    });
}
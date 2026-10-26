<<<<<<< HEAD
let currentPlayerId = null;
const params = new URLSearchParams(window.location.search);
const tableId = params.get("tableId") || "table1";

/**
 * Temporary sample player data for the poker table frontend.
 * This data is for demonstration only and is not connected to the backend.
 */
const samplePlayers = [
    { name: "You", chips: 1980, current: true },
    { name: "Blossom", chips: 1250 },
    { name: "Bubbles", chips: 980 },
    { name: "Buttercup", chips: 2010 },
    { name: "Professor Utonium", chips: 1430 },
    { name: "Mojo Jojo", chips: 860 }
];

// Get the HTML elements used to display the players and table messages.
const playersContainer = document.getElementById("players");
//const tableMessage = document.getElementById("table-message");

/**
 * Displays the sample players and their information on the poker table.
 * Creates a seat for each player, including their name, cards, and chip count.
 * Highlights the local demo player.
 * 
 * @returns {void}
 */
function displayPlayers() {
    // Clear existing player seats before displaying the sample players.
    playersContainer.replaceChildren();

    // Create a seat for each player in the sample data.
    samplePlayers.forEach((player) => {
        const seat = document.createElement("div");
        seat.classList.add("player-seat");

        // Highlight the local demo player's seat.
        if (player.current) {
            seat.classList.add("current-player");
=======
function getPlayerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("playerId");
    
    if (!id) {
        const keys = Array.from(urlParams.keys());
        if (keys.length > 0) {
            id = keys[0];
>>>>>>> next_round_testing
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

<<<<<<< HEAD
/**
 * Displays and handles the dealer logic
 * @param {number} dealerIndex Used to determine where the dealer Marker is
 * @returns {void}
 */
function displayDealer(dealerIndex) {
    console.log("Dealer index received:", dealerIndex);
    // Remove the previous dealer marker.
    document.querySelectorAll(".dealer-marker").forEach((marker) => {
        marker.remove();
    });

    const seats = document.querySelectorAll(".player-seat");
    const dealerSeat = seats[dealerIndex];

    if (dealerSeat) {
        const marker = document.createElement("span");
        marker.classList.add("dealer-marker");
        marker.textContent = " (D)";
        dealerSeat.appendChild(marker);
    }
}

/**
 * Displays and handles the Blind
 * @param {number} smallBlindIndex Used to determine where the small blind marker is
 * @param {number} bigBlindIndex Used to determine where the big blind marker is
 * @returns {void}
 */
function displayBlinds(smallBlindIndex, bigBlindIndex) {
    // Remove the previous blind markers.
    document.querySelectorAll(".blind-marker").forEach((marker) => {
        marker.remove();
    });

    const seats = document.querySelectorAll(".player-seat");

    const smallBlindSeat = seats[smallBlindIndex];
    const bigBlindSeat = seats[bigBlindIndex];

    if (smallBlindSeat) {
        const marker = document.createElement("span");
        marker.classList.add("blind-marker");
        marker.textContent = " (SB)";
        smallBlindSeat.appendChild(marker);
    }

    if (bigBlindSeat) {
        const marker = document.createElement("span");
        marker.classList.add("blind-marker");
        marker.textContent = " (BB)";
        bigBlindSeat.appendChild(marker);
    }
}

/**
 * Displays and handles the chips
 * @param {string} players Players
 * @param {number} pot the current pot in game
 * @returns {void}
 */
function displayChips(players, pot) {
    const seats = document.querySelectorAll(".player-seat");

    players.forEach((player, index) => {
        const seat = seats[index];

        if (seat) {
            seat.querySelector(".player-name").textContent = player.id;
            seat.querySelector(".player-chips").textContent =`${player.chips.toLocaleString()} chips`;
        }
    });

    document.getElementById("total-pot").textContent = pot.toLocaleString();
}

function displayYourChips(players) {
    // Temporarily treat demo1 as the local player.
    const player = players.find(player => player.id === currentPlayerId);

    if (!player) {
        return;
    }

    document.getElementById("your-chips").textContent =
        player.chips.toLocaleString();

    document.getElementById("your-bet").textContent =
        player.bet.toLocaleString();

    document.getElementById("available-chips").textContent =
        player.chips.toLocaleString();
}

/**
 * Handles clicks on the Fold, Check, Call, and Raise buttons.
 * Displays a demo message for the selected action.
 * No actual poker rules, betting, or backend requests are performed.
 *
 * @param {Event} event - The click event triggered by the button.
 * @returns {void}
 */
async function handlePokerAction(event) {
    const playerId = currentPlayerId;

    if (!playerId) {
        tableMessage.textContent = "No player currently has the turn.";
        return;
    }

    // Get the selected action from the clicked button.
    const action = event.currentTarget.dataset.action;

    if (action === "Fold"){ 
        try {
            const response = await fetch(`/api/tables/${tableId}/fold`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    playerId: playerId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error);
            }

            tableMessage.textContent = result.message;

            // Mark demo1's seat as folded.
            const seat = document.querySelectorAll(".player-seat")[0];
            seat.querySelector(".player-status").textContent = "Folded";
        } 

        catch (error) {
            tableMessage.textContent = error.message;
        }

        return;
    }

    if (action === "Check") {
        try {
            const response = await fetch(`/api/tables/${tableId}/check`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playerId: playerId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error);
            }

            tableMessage.textContent = result.message;
            await updateTurnStatus();
        } catch (error) {
            tableMessage.textContent = error.message;
        }

        return;
    }

    if (action === "Call") {
        try {
            const response = await fetch(`/api/tables/${tableId}/call`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    playerId: playerId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error);
            }

            tableMessage.textContent = result.message;
            displayChips(result.players, result.pot);
            displayYourChips(result.players);
        } 
        
        catch (error) {
            tableMessage.textContent = error.message;
        }
        return;
    }

    // Handle the Raise action separately to validate its amount.
    if (action === "Raise") {
    const raiseTo = Number(document.getElementById("raise-amount").value);

    if (!Number.isInteger(raiseTo) || raiseTo <= 0) {
        tableMessage.textContent =
            "Enter a positive whole-number raise amount.";
        return;
    }

    try {
        const response = await fetch(`/api/tables/${tableId}/raise`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                playerId,
                raiseTo
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        tableMessage.textContent = result.message;

        displayChips(result.players, result.pot);
        displayYourChips(result.players);

        document.getElementById("current-bet").textContent =
            result.currentBet.toLocaleString();

        await updateTurnStatus();

    } catch (error) {
        tableMessage.textContent = error.message;
    }

    return;
}

    // Display the selected action without changing the game state.
    tableMessage.textContent = `${action} selected (demo only).`;
}

// Attach the action handler to each poker action button.
document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handlePokerAction);
});

/**
 * Displays the users who folded
 * @param players - current players
 * @param {number} foldedPlayers - folded players
 * @returns {void}
 */
function displayFoldedPlayers(players, foldedPlayers) {
    const seats = document.querySelectorAll(".player-seat");

    players.forEach((playerId, index) => {
        const seat = seats[index];

        if (!seat) {
            return;
        }

        const folded = foldedPlayers.includes(playerId);

        seat.querySelector(".player-status").textContent =
            folded ? "Folded" : "Active";

        seat.classList.toggle("folded", folded);
        seat.classList.toggle("active", !folded);
    });
}

/**
 * Handles chat form submissions on the poker table page.
 * Adds a non-empty message to the local chat panel without reloading the page.
 * Messages are not sent to other players or saved to a server.
 *
 * @param {SubmitEvent} event - The chat form submission event.
 * @returns {void}
 */
function handleChatSubmit(event) {
    // Prevent the form from reloading the page.
    event.preventDefault();

    // Get the message and remove surrounding whitespace.
    const input = document.getElementById("chat-input");
    const message = input.value.trim();

    // Ignore empty messages.
    if (!message) {
        return;
=======
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
>>>>>>> next_round_testing
    }
}, 1000);

<<<<<<< HEAD
    // Create the chat message using text content to avoid interpreting
    // user-entered text as HTML.
    const messageElement = document.createElement("p");
    const sender = document.createElement("strong");

    sender.textContent = "Player123: ";
    messageElement.append(sender, document.createTextNode(message));

    // Add the message to the chat panel.
    document.getElementById("chat-messages").appendChild(messageElement);

    // Clear the input after adding the message.
    input.value = "";
}

// Attach the chat handler to the chat form.
document.getElementById("chat-form").addEventListener(
    "submit",
    handleChatSubmit
);


async function updateTurnStatus() {
    try {
        const response = await fetch(`/api/tables/${tableId}/state`);

        if (!response.ok) {
            throw new Error("Failed to load table state.");
        }

        const table = await response.json();
        currentPlayerId = table.currentPlayer;
        displayFoldedPlayers(table.players, table.foldedPlayers);
        

        const playerDisplay = document.getElementById("current-player");
        const timerDisplay = document.getElementById("turn-timer");
        const timerRing = document.getElementById("timer-ring");
        playerDisplay.textContent = table.currentPlayer || "Waiting...";
        const seconds = table.timeRemaining;
        timerDisplay.textContent = seconds;
        const timeLimit = table.timeLimit || 30;
        const percentage = Math.max(0, Math.min(100, (seconds / timeLimit) * 100));

        timerRing.style.setProperty("--timer-progress", `${percentage}%`);
        timerRing.classList.toggle("urgent", seconds <= 10);

    } catch (error) {
        console.error("Error updating turn status:", error);
    }
}

updateTurnStatus();
setInterval(updateTurnStatus, 1000);


async function loadTestCards() {
    try {
        const response = await fetch(`/api/tables/${tableId}/test-cards`);

        if (!response.ok) {
            throw new Error("Failed to load cards");
        }

        const game = await response.json();

        document.getElementById("current-bet").textContent =game.currentBet;

        renderCards("player-cards", game.playerHands[0]);
        renderCards("community-cards", game.communityCards);
        
        displayDealer(game.dealerIndex);
        displayBlinds(game.smallBlindIndex, game.bigBlindIndex);
        displayChips(game.players, game.pot);
        displayYourChips(game.players);

        

=======
async function fetchTableStatus() {
    try {
        const response = await fetch(`/api/table/status?playerId=${encodeURIComponent(currentPlayerId)}`);
        if (!response.ok) throw new Error("Failed to fetch table status.");
        return await response.json();
>>>>>>> next_round_testing
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

refreshUI();
setInterval(refreshUI, 2500);

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

<<<<<<< HEAD
loadTestCards();



async function updatePlayerSeats() {
    try {
        const response = await fetch(`/api/tables/${tableId}/state`);

        if (!response.ok) {
            throw new Error("Failed to fetch table state");
        }

        const data = await response.json();
        console.log("Players:", data.players);

        const playerSeats = document.querySelectorAll(".player-seat");

        playerSeats.forEach((seat, index) => {
            const nameElement = seat.querySelector(".player-name");
            const statusElement = seat.querySelector(".player-status");
            const chipsElement = seat.querySelector(".player-chips");

            // Check that the HTML elements exist
            if (!nameElement || !statusElement || !chipsElement) {
                console.warn("Player seat HTML is missing an expected element:", seat);
                return;
            }

            const player = data.players[index];

            if (player) {
                // Support either a player object or a player name string
                nameElement.textContent =
                    typeof player === "string" ? player : player.name;

                seat.classList.add("active");
                seat.classList.remove("inactive", "disconnected");
            } else {
                nameElement.textContent = "Empty Seat";
                statusElement.textContent = "Inactive";
                chipsElement.textContent = "";

                seat.classList.remove("active");
                seat.classList.add("inactive");
                seat.classList.remove("disconnected");
            }
        });
    } catch (error) {
        console.error("Error updating player seats:", error);
    }
}

updatePlayerSeats();



=======
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
>>>>>>> next_round_testing

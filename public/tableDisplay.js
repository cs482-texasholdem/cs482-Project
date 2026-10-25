/**
 * Temporary sample player data for the poker table frontend.
 * This data is for demonstration only and is not connected to the backend.
 */
const samplePlayers = [
    { name: "Blossom", chips: 1250 },
    { name: "Bubbles", chips: 980 },
    { name: "Buttercup", chips: 2010 },
    { name: "Professor Utonium", chips: 1430 },
    { name: "Mojo Jojo", chips: 860 },
    { name: "You", chips: 1980, current: true }
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
        }

        // Display the player's name.
        const name = document.createElement("p");
        name.textContent = player.name;

        // Display sample cards for the local player and face-down cards for others.
        const cards = document.createElement("p");
        cards.classList.add("player-cards");
        cards.textContent = player.current ? "A♠ K♥" : "🂠 🂠";

        // Display the player's chip count.
        const chips = document.createElement("p");
        chips.textContent = `${player.chips.toLocaleString()} chips`;

        // Add the player's information to the seat.
        seat.append(name, cards, chips);

        // Add the completed seat to the poker table.
        playersContainer.appendChild(seat);
    });
}

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

/**
 * Handles clicks on the Fold, Check, Call, and Raise buttons.
 * Displays a demo message for the selected action.
 * No actual poker rules, betting, or backend requests are performed.
 *
 * @param {Event} event - The click event triggered by the button.
 * @returns {void}
 */
async function handlePokerAction(event) {
    // Get the selected action from the clicked button.
    const action = event.currentTarget.dataset.action;

    if (action === "Fold"){ 
        try {
            const response = await fetch("/api/tables/table1/fold", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    playerId: "demo1"
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

    // Handle the Raise action separately to validate its amount.
    if (action === "Raise") {
        const amount = Number(
            document.getElementById("raise-amount").value
        );

        // Reject invalid raise amounts in the demo.
        if (!Number.isFinite(amount) || amount < 20) {
            tableMessage.textContent =
                "Enter a raise amount of at least 20.";
            return;
        }

        // Display the selected raise amount without placing a real bet.
        tableMessage.textContent =
            `Raise selected: ${amount} chips (demo only).`;
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
    }

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
        const response = await fetch("/api/tables/table1/state");

        if (!response.ok) {
            throw new Error("Failed to load table state.");
        }

        const table = await response.json();
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
        const response = await fetch("/api/tables/table1/test-cards");

        if (!response.ok) {
            throw new Error("Failed to load cards");
        }

        const game = await response.json();

        renderCards("player-cards", game.playerHands[0]);
        renderCards("community-cards", game.communityCards);
        
        displayDealer(game.dealerIndex);
        displayBlinds(game.smallBlindIndex, game.bigBlindIndex);
        displayChips(game.players, game.pot);

    } catch (error) {
        console.error("Error loading cards:", error);
    }
}

function renderCards(containerId, cards) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    cards.forEach(cardText => {
        const card = document.createElement("div");
        card.className = "card";

        if (cardText.includes("♥") || cardText.includes("♦")) {
            card.classList.add("red-suit");
        }

        card.textContent = cardText;
        container.appendChild(card);
    });
}

loadTestCards();



async function updatePlayerSeats() {
    try {
        const response = await fetch("/api/tables/table1/state");

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

                statusElement.textContent = "Active";
                chipsElement.textContent = "1,500 chips";

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




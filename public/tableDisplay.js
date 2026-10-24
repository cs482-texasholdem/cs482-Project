/**
 * Temporary sample player data for the poker table frontend.
 * This data is for demonstration only and is not connected to the backend.
 */
const samplePlayers = [
    { name: "PokerPro", chips: 1250 },
    { name: "LuckyAce", chips: 980 },
    { name: "CardShark", chips: 2010 },
    { name: "BlueMoon", chips: 1430 },
    { name: "RiverRat", chips: 860 },
    { name: "Player123", chips: 1980, current: true }
];

// Get the HTML elements used to display the players and table messages.
const playersContainer = document.getElementById("players");
const tableMessage = document.getElementById("table-message");

/**
 * Displays the sample players and their information on the poker table.
 * Creates a seat for each player, including their name, cards, and chip count.
 * Highlights the local demo player.
 * 
 * @returns {void}
 */
function displayPlayers() {
    // Clear existing player seats before displaying the sample players.
    if (playersContainer) {
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
}

// Display the sample players when the page loads.
displayPlayers();

/**
 * Handles clicks on the Fold, Check, Call, and Raise buttons.
 * Displays a demo message for the selected action and advances the round.
 * 
 * @param {Event} event The click event triggered by the button.
 * @returns {void}
 */
async function handlePokerAction(event) {
    // Get the selected action from the clicked button.
    const action = event.currentTarget.dataset.action;
    
    try {
        const response = await fetch("/api/next-round");
        if (!response.ok) {
            throw new Error("Failed to advance round.");
        }
        loadTestCards();
    } catch (error) {
        console.error("Error advancing round:", error);
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
 * 
 * @param {SubmitEvent} event The chat form submission event.
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
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Clear the input after adding the message.
    input.value = "";
}

// Attach the chat handler to the chat form.
const chatForm = document.getElementById("chat-form");
if (chatForm) {
    chatForm.addEventListener("submit", handleChatSubmit);
}

/**
 * Loads test cards from the backend for the current player.
 */
async function loadTestCards() {
    try {
        const playerId = "Player123";
        const response = await fetch(`/api/test-cards?playerId=${encodeURIComponent(playerId)}`);

        if (!response.ok) {
            throw new Error("Failed to load cards");
        }

        const game = await response.json();

        renderCards("player-cards", game.playerHand);
        renderCards("community-cards", game.communityCards);
    } catch (error) {
        console.error("Error loading cards:", error);
        if (tableMessage) {
            tableMessage.textContent = "Could not load cards.";
        }
    }
}

/**
 * Displays the cards inside an HTML container.
 * 
 * @param {string} containerId ID of the container element.
 * @param {Array<string>} cards Array of card text representations.
 */
function renderCards(containerId, cards) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
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

// Initial load of test cards when the script runs.
loadTestCards();
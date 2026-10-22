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
    { name: "You", chips: 1980, current: true }
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

// Display the sample players when the page loads.
displayPlayers();

/**
 * Handles clicks on the Fold, Check, Call, and Raise buttons.
 * Displays a demo message for the selected action.
 * No actual poker rules, betting, or backend requests are performed.
 *
 * @param {Event} event - The click event triggered by the button.
 * @returns {void}
 */
function handlePokerAction(event) {
    // Get the selected action from the clicked button.
    const action = event.currentTarget.dataset.action;

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

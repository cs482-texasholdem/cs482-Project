/**
 * ============================================================================
 * File Name: reviewGame.js
 * Purpose: Frontend controller for reviewGame.html. Fetches reconstructed 
 *          game data from the server endpoint and dynamically renders player 
 *          hands, community card streets, and action logs.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get("id");

    if (!gameId) {
        alert("No Game ID provided for review.");
        window.location.href = "admin.html";
        return;
    }

    await loadGameReconstruction(gameId);
});

function createCardElement(cardText) {
    const cardDiv = document.createElement("div");
    cardDiv.className = "playing-card";
    if (cardText.includes("♥") || cardText.includes("♦")) {
        cardDiv.classList.add("red-suit");
    }
    cardDiv.textContent = cardText;
    return cardDiv;
}

async function loadGameReconstruction(gameId) {
    try {
        const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/reconstruct`);
        if (!response.ok) {
            throw new Error("Failed to fetch server-reconstructed game data.");
        }

        const game = await response.json();

        // Populate summary metadata
        document.getElementById("review-game-id").textContent = game._id;
        document.getElementById("review-timestamp").textContent = game.timestamp ? new Date(game.timestamp).toLocaleString() : 'N/A';
        document.getElementById("review-seed").textContent = `${game.tableId || 'main'} (Seed: ${game.shuffleSeed || 'N/A'})`;
        
        const winnersText = game.winners && game.winners.length > 0 ? game.winners.join(', ') : 'None / Folded';
        document.getElementById("review-outcome").textContent = `${winnersText} won ${game.potFinal || 0} chips`;

        // Render Community Cards (Flop, Turn, River)
        const flopContainer = document.getElementById("review-flop");
        const turnContainer = document.getElementById("review-turn");
        const riverContainer = document.getElementById("review-river");

        flopContainer.innerHTML = "";
        turnContainer.innerHTML = "";
        riverContainer.innerHTML = "";

        if (game.communityCards) {
            // Flop (3 cards)
            if (game.communityCards.flop && Array.isArray(game.communityCards.flop)) {
                game.communityCards.flop.forEach(c => flopContainer.appendChild(createCardElement(c)));
            }
            // Turn (1 card)
            if (game.communityCards.turn) {
                turnContainer.appendChild(createCardElement(game.communityCards.turn));
            }
            // River (1 card)
            if (game.communityCards.river) {
                riverContainer.appendChild(createCardElement(game.communityCards.river));
            }
        }

        // Render Player Hole Cards Table
        const handsTbody = document.getElementById("player-hands-tbody");
        handsTbody.innerHTML = "";

        if (game.playerHands && Object.keys(game.playerHands).length > 0) {
            for (const [playerId, cards] of Object.entries(game.playerHands)) {
                const tr = document.createElement("tr");
                
                const tdName = document.createElement("td");
                tdName.className = "ps-3 fw-bold text-warning";
                tdName.textContent = playerId;

                const tdCards = document.createElement("td");
                const cardBox = document.createElement("div");
                cardBox.className = "card-box justify-content-start";
                
                if (Array.isArray(cards)) {
                    cards.forEach(c => cardBox.appendChild(createCardElement(c)));
                }
                tdCards.appendChild(cardBox);

                tr.append(tdName, tdCards);
                handsTbody.appendChild(tr);
            }
        } else {
            handsTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-3">No player hands available.</td></tr>`;
        }

        // Populate chronological action log
        const logContainer = document.getElementById("action-log-container");
        logContainer.innerHTML = "";

        if (!game.actions || game.actions.length === 0) {
            logContainer.innerHTML = `<div class="text-muted text-center py-3">No actions recorded for this game.</div>`;
            return;
        }

        const initialPlayersDiv = document.createElement("div");
        initialPlayersDiv.className = "action-item text-info fw-bold mb-2";
        initialPlayersDiv.textContent = `[Seating] Initial Players: ${game.initialPlayers ? game.initialPlayers.join(', ') : 'N/A'}`;
        logContainer.appendChild(initialPlayersDiv);

        game.actions.forEach((act, index) => {
            const item = document.createElement("div");
            item.className = "action-item";
            
            let actionDescription = `${act.action}`;
            if (act.action === "Raise") {
                actionDescription += ` to ${act.amount} chips`;
            }

            item.innerHTML = `
                <span class="text-secondary">[#${index + 1} - ${act.round || 'Playing'}]</span> 
                <strong class="text-warning">${act.playerId}</strong> executed 
                <span class="text-white">${actionDescription}</span>
            `;
            logContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading game review reconstruction:", error);
        document.getElementById("action-log-container").innerHTML = `
            <div class="text-danger text-center py-3">Error loading reconstruction data. Game ID may be invalid.</div>
        `;
    }
}
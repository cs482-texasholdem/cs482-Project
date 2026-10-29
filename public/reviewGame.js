/**
 * ============================================================================
 * File Name: reviewGame.js
 * Purpose: Frontend controller for reviewGame.html. Extracts the game ID from 
 *          URL query parameters, fetches game reconstruction metadata from the 
 *          server API, and renders session details and action logs.
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

    await loadGameDetails(gameId);
});

async function loadGameDetails(gameId) {
    try {
        const response = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
        if (!response.ok) {
            throw new Error("Failed to fetch game details from database.");
        }

        const game = await response.json();

        // Populate summary metadata
        document.getElementById("review-game-id").textContent = game._id;
        document.getElementById("review-timestamp").textContent = game.timestamp ? new Date(game.timestamp).toLocaleString() : 'N/A';
        document.getElementById("review-seed").textContent = `${game.tableId || 'main'} (Seed: ${game.shuffleSeed || 'N/A'})`;
        
        const winnersText = game.winners && game.winners.length > 0 ? game.winners.join(', ') : 'None / Folded';
        document.getElementById("review-outcome").textContent = `${winnersText} won ${game.potFinal || 0} chips`;

        // Populate chronological action log
        const logContainer = document.getElementById("action-log-container");
        logContainer.innerHTML = "";

        if (!game.actions || game.actions.length === 0) {
            logContainer.innerHTML = `<div class="text-muted text-center py-3">No actions recorded for this game.</div>`;
            return;
        }

        // Render initial seating overview
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
        console.error("Error loading game review data:", error);
        document.getElementById("action-log-container").innerHTML = `
            <div class="text-danger text-center py-3">Error loading reconstruction data. Game ID may be invalid.</div>
        `;
    }
}
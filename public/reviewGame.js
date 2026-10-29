/**
 * ============================================================================
 * File Name: reviewGame.js
 * Purpose: Frontend controller for reviewGame.html. Fetches reconstructed 
 *          game data and dynamically renders seating order, positional badges 
 *          (Dealer, SB, BB), hole cards, hand scores, and action logs.
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

        // Render Community Cards
        const flopContainer = document.getElementById("review-flop");
        const turnContainer = document.getElementById("review-turn");
        const riverContainer = document.getElementById("review-river");

        flopContainer.innerHTML = "";
        turnContainer.innerHTML = "";
        riverContainer.innerHTML = "";

        if (game.communityCards) {
            if (game.communityCards.flop && Array.isArray(game.communityCards.flop)) {
                game.communityCards.flop.forEach(c => flopContainer.appendChild(createCardElement(c)));
            }
            if (game.communityCards.turn) {
                turnContainer.appendChild(createCardElement(game.communityCards.turn));
            }
            if (game.communityCards.river) {
                riverContainer.appendChild(createCardElement(game.communityCards.river));
            }
        }

        // Render Player Seating Table with Hole Cards & Scores
        const handsTbody = document.getElementById("player-hands-tbody");
        handsTbody.innerHTML = "";

        if (game.initialPlayers && game.initialPlayers.length > 0) {
            game.initialPlayers.forEach((playerId, index) => {
                const tr = document.createElement("tr");

                // Seat number
                const tdSeat = document.createElement("td");
                tdSeat.className = "ps-3 text-secondary font-monospace";
                tdSeat.textContent = `#${index + 1}`;

                // Player ID
                const tdName = document.createElement("td");
                tdName.className = "fw-bold text-warning";
                tdName.textContent = playerId;

                // Position badge
                const tdPos = document.createElement("td");
                let badgeHtml = '<span class="badge bg-secondary">Active</span>';
                if (index === game.dealerIndex) {
                    badgeHtml = '<span class="badge bg-warning text-dark">Dealer (D)</span>';
                } else if (index === game.smallBlindIndex) {
                    badgeHtml = '<span class="badge bg-info text-dark">Small Blind (SB)</span>';
                } else if (index === game.bigBlindIndex) {
                    badgeHtml = '<span class="badge bg-primary">Big Blind (BB)</span>';
                }
                tdPos.innerHTML = badgeHtml;

                // Hole Cards
                const tdCards = document.createElement("td");
                const cardBox = document.createElement("div");
                cardBox.className = "card-box justify-content-start";
                const cards = game.playerHands && game.playerHands[playerId] ? game.playerHands[playerId] : [];
                cards.forEach(c => cardBox.appendChild(createCardElement(c)));
                tdCards.appendChild(cardBox);

                // Hand Score
                const tdScore = document.createElement("td");
                tdScore.className = "text-end pe-3 font-monospace text-info";
                const scoreValue = game.playerScores && game.playerScores[playerId] !== undefined ? game.playerScores[playerId] : 0;
                tdScore.textContent = scoreValue.toLocaleString();

                tr.append(tdSeat, tdName, tdPos, tdCards, tdScore);
                handsTbody.appendChild(tr);
            });
        } else {
            handsTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No player seating data available.</td></tr>`;
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
        initialPlayersDiv.textContent = `[Seating Order] ${game.initialPlayers.join(' → ')}`;
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
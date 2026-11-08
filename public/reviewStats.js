/**
 * ============================================================================
 * File Name: reviewStats.js
 * Purpose: Frontend controller for reviewStats.html. Retrieves player ID from 
 *          URL query strings, computes 7 statistical metrics, and renders 
 *          a public summary of the player's last 5 games without leaking 
 *          unrevealed hole cards.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async function() {
    const targetPlayerId = await getTargetPlayerId();
    document.getElementById("stats-player-id").textContent = targetPlayerId;

    await loadPlayerStatistics(targetPlayerId);
});

/**
 * Extracts player ID from URL parameters or falls back to storage/session identity.
 */
async function getTargetPlayerId() {
    const urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get("playerId") || urlParams.get("id");

    if (id && id.trim()) {
        return decodeURIComponent(id.trim());
    }

    try {
        const res = await fetch('/loggeduser');
        if (res.ok) {
            const user = await res.json();
            if (user && (user.username || user.email)) {
                return user.username || user.email.split('@')[0];
            }
        }
    } catch (e) {
        console.error("Session fetch failed:", e);
    }

    return localStorage.getItem("guestPlayerId") || sessionStorage.getItem("guestPlayerId") || "Guest_Player";
}

/**
 * Fetches game records and computes 7 player performance metrics.
 */
async function loadPlayerStatistics(playerId) {
    try {
        const response = await fetch('/api/games');
        if (!response.ok) throw new Error("Failed to load games history.");

        const games = await response.json();

        // Filter games involving this player
        const playerGames = games.filter(g => g.initialPlayers && g.initialPlayers.includes(playerId));

        if (playerGames.length === 0) {
            renderEmptyStats();
            return;
        }

        // --- STATISTICAL CALCULATIONS ---
        const totalGames = playerGames.length;
        
        let gamesWon = 0;
        let totalChipsWon = 0;
        let aggressionActions = 0;
        let foldActions = 0;
        let totalActions = 0;
        let dealerGames = 0;
        let dealerWins = 0;

        playerGames.forEach(g => {
            const isWinner = g.winners && g.winners.includes(playerId);
            if (isWinner) {
                gamesWon++;
                totalChipsWon += (g.potFinal || 0);
            }

            const pIndex = g.initialPlayers.indexOf(playerId);
            if (pIndex === g.dealerIndex) {
                dealerGames++;
                if (isWinner) dealerWins++;
            }

            if (g.actions && Array.isArray(g.actions)) {
                g.actions.forEach(act => {
                    if (act.playerId === playerId) {
                        totalActions++;
                        if (act.action === "Raise" || act.action === "Bet") aggressionActions++;
                        if (act.action === "Fold") foldActions++;
                    }
                });
            }
        });

        const winRate = ((gamesWon / totalGames) * 100).toFixed(1);
        const avgPot = gamesWon > 0 ? Math.round(totalChipsWon / gamesWon) : 0;
        const aggressionRate = totalActions > 0 ? ((aggressionActions / totalActions) * 100).toFixed(1) : "0.0";
        const foldRate = totalActions > 0 ? ((foldActions / totalActions) * 100).toFixed(1) : "0.0";
        const dealerWinRate = dealerGames > 0 ? ((dealerWins / dealerGames) * 100).toFixed(1) : "0.0";

        // Render calculated 7 stats
        document.getElementById("stat-total-games").textContent = totalGames;
        document.getElementById("stat-win-rate").textContent = `${winRate}%`;
        document.getElementById("stat-chips-won").textContent = totalChipsWon.toLocaleString();
        document.getElementById("stat-avg-pot").textContent = avgPot.toLocaleString();
        document.getElementById("stat-aggression").textContent = `${aggressionRate}%`;
        document.getElementById("stat-fold-rate").textContent = `${foldRate}%`;
        document.getElementById("stat-dealer-win-rate").textContent = `${dealerWinRate}% (${dealerWins}/${dealerGames} Dealer Hands)`;

        // --- RENDER LAST 5 GAMES SUMMARY ---
        const last5Games = playerGames.slice(0, 5);
        renderLast5Games(last5Games, playerId);

    } catch (error) {
        console.error("Error computing player statistics:", error);
        document.getElementById("last-games-tbody").innerHTML = `
            <tr><td colspan="5" class="text-center text-danger py-3">Failed to load statistics.</td></tr>
        `;
    }
}

function renderLast5Games(games, playerId) {
    const tbody = document.getElementById("last-games-tbody");
    tbody.innerHTML = "";

    games.forEach(g => {
        const isWinner = g.winners && g.winners.includes(playerId);
        const outcomeBadge = isWinner 
            ? '<span class="badge bg-success">WON</span>' 
            : '<span class="badge bg-secondary">LOST / FOLDED</span>';

        const dateStr = g.timestamp ? new Date(g.timestamp).toLocaleString() : 'N/A';
        const actionCount = g.actions ? g.actions.filter(a => a.playerId === playerId).length : 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="ps-3 text-white font-monospace small">${g._id}</td>
            <td class="small text-white opacity-75">${dateStr}</td>
            <td>${outcomeBadge}</td>
            <td class="text-warning fw-bold">${g.potFinal || 0} Chips</td>
            <td class="text-end pe-3 text-info">${actionCount} Player Actions</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderEmptyStats() {
    document.getElementById("stat-total-games").textContent = "0";
    document.getElementById("stat-win-rate").textContent = "0.0%";
    document.getElementById("stat-chips-won").textContent = "0";
    document.getElementById("stat-avg-pot").textContent = "0";
    document.getElementById("stat-aggression").textContent = "0.0%";
    document.getElementById("stat-fold-rate").textContent = "0.0%";
    document.getElementById("stat-dealer-win-rate").textContent = "N/A";

    document.getElementById("last-games-tbody").innerHTML = `
        <tr><td colspan="5" class="text-center text-muted py-3">No game history found for this player.</td></tr>
    `;
}
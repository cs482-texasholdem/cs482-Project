/**
 * ============================================================================
 * File Name: reviewStats.js
 * Purpose: Frontend controller for reviewStats.html. Retrieves player ID from 
 *          URL query strings, computes 7 statistical metrics, displays earned
 *          badges/achievements, and renders a summary of the last 5 games.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async function() {
    const targetPlayerId = await getTargetPlayerId();
    document.getElementById("stats-player-id").textContent = targetPlayerId;

    await Promise.all([
        loadPlayerStatistics(targetPlayerId),
        loadEarnedAchievements(targetPlayerId)
    ]);
});

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

async function loadEarnedAchievements(playerId) {
    const badgesContainer = document.getElementById("stats-earned-badges");
    const listContainer = document.getElementById("stats-earned-achievements-list");
    const countBadge = document.getElementById("stats-earned-count");
    if (!badgesContainer || !listContainer) return;

    try {
        const res = await fetch(`/api/achievements/${encodeURIComponent(playerId)}`);
        if (!res.ok) throw new Error("Failed to load player achievements.");
        const data = await res.json();
        const earned = data.completedAchievements || [];

        if (countBadge) {
            countBadge.textContent = `${earned.length} / ${data.totalCount || 20} Earned`;
        }

        if (earned.length === 0) {
            badgesContainer.innerHTML = `<span class="text-secondary small fst-italic">No badges or achievements earned yet.</span>`;
            listContainer.innerHTML = "";
            return;
        }

        badgesContainer.innerHTML = "";
        listContainer.innerHTML = "";

        earned.forEach(ach => {
            const pill = document.createElement("div");
            pill.className = "earned-badge-pill";
            pill.innerHTML = `
                <div class="achievement-badge-graphic ${ach.theme || "badge-gold"}">
                    <i class="bi ${ach.icon || "bi-award-fill"}"></i>
                </div>
                <div>
                    <div class="fw-bold small text-white">${ach.name}</div>
                    <div class="text-success" style="font-size: 0.72rem;">Earned</div>
                </div>
            `;
            badgesContainer.appendChild(pill);

            const col = document.createElement("div");
            col.className = "col-md-6";
            col.innerHTML = `
                <div class="achievement-card achievement-completed d-flex align-items-center gap-3">
                    <div class="achievement-badge-graphic ${ach.theme || "badge-gold"}">
                        <i class="bi ${ach.icon || "bi-award-fill"}"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-white">${ach.name}</div>
                        <div class="small text-white opacity-75">${ach.shortDesc}</div>
                        <div class="small text-warning mt-1">${ach.progressText || "Unlocked"}</div>
                    </div>
                </div>
            `;
            listContainer.appendChild(col);
        });
    } catch (err) {
        console.error("Error loading earned achievements:", err);
        badgesContainer.innerHTML = `<span class="text-danger small">Failed to load achievements.</span>`;
    }
}

async function loadPlayerStatistics(playerId) {
    try {
        const response = await fetch('/api/games');
        if (!response.ok) throw new Error("Failed to load games history.");

        const games = await response.json();
        const playerGames = games.filter(g => g.initialPlayers && g.initialPlayers.includes(playerId));

        if (playerGames.length === 0) {
            renderEmptyStats();
            return;
        }

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

        document.getElementById("stat-total-games").textContent = totalGames;
        document.getElementById("stat-win-rate").textContent = `${winRate}%`;
        document.getElementById("stat-chips-won").textContent = totalChipsWon.toLocaleString();
        document.getElementById("stat-avg-pot").textContent = avgPot.toLocaleString();
        document.getElementById("stat-aggression").textContent = `${aggressionRate}%`;
        document.getElementById("stat-fold-rate").textContent = `${foldRate}%`;
        document.getElementById("stat-dealer-win-rate").textContent = `${dealerWinRate}% (${dealerWins}/${dealerGames} Dealer Hands)`;

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
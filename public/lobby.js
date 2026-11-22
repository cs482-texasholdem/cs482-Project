/*
  ============================================================================
  File Name: lobby.js
  Author: Gigi Li
  Purpose: Lobby interface for the Texas Hold'em web application. 
           Allows users to view public tables, join games, view monthly public
           table leaderboards, and view all achievements with completion status
           and info modals when logged in.
  ============================================================================
*/
let joinSidebar;
let lobbyAchievementsCache = [];
let publicLeaderboardIntervalId = null;

document.addEventListener("DOMContentLoaded", async function () {
    const sidebarElement = document.getElementById("joinGameSidebar");
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
    }

    // Load monthly public table leaderboards immediately on page load
    loadPublicTableLeaderboards();
    if (!publicLeaderboardIntervalId) {
        publicLeaderboardIntervalId = setInterval(loadPublicTableLeaderboards, 15000);
    }

    const urlParams = new URLSearchParams(window.location.search);
    let playerId = urlParams.get("playerId");

    if (playerId && playerId.startsWith("Guest_")) {
        sessionStorage.setItem("guestPlayerId", playerId);
        sessionStorage.setItem("identityMode", "guest");
    } else {
        playerId = sessionStorage.getItem("guestPlayerId");
    }

    if (playerId && playerId.startsWith("Guest_")) {
        setupGuestLobbyView(playerId);
        setupCommonLobbyListeners(playerId);
        return;
    }

    if (sessionStorage.getItem("identityMode") !== "guest") {
        try {
            const res = await fetch("/loggeduser");
            const user = await res.json();
            const isLoggedIn = user && (user.username || user.email || user.id);

            if (!isLoggedIn) {
                localStorage.removeItem("guestPlayerId");
                sessionStorage.removeItem("guestPlayerId");
                setupGuestLobbyView(playerId);
            } else {
                const resolvedUserId = user.username || (user.email ? user.email.split("@")[0] : user.id);
                setUpLoggedInLobbyView(user);
                await loadLobbyAchievements(resolvedUserId);
            }
        } catch (e) {
            console.error("Session verification failed:", e);
        }
    }

    setupCommonLobbyListeners(playerId);
});

async function loadLobbyAchievements(playerId) {
    const section = document.getElementById("lobbyAchievementsSection");
    const grid = document.getElementById("lobbyAchievementsGrid");
    const summaryBadge = document.getElementById("lobbyAchievementSummary");
    if (!section || !grid) return;

    section.classList.remove("d-none");

    try {
        const res = await fetch(`/api/achievements/${encodeURIComponent(playerId)}`);
        if (!res.ok) throw new Error("Failed to fetch achievements.");
        const data = await res.json();

        lobbyAchievementsCache = data.achievements || [];
        if (summaryBadge) {
            summaryBadge.textContent = `${data.completedCount || 0} / ${data.totalCount || lobbyAchievementsCache.length} Completed`;
        }

        grid.innerHTML = "";
        lobbyAchievementsCache.forEach((ach) => {
            const col = document.createElement("div");
            col.className = "col-md-6 col-lg-4";

            const statusClass = ach.completed ? "achievement-completed" : "achievement-locked";
            const badgeLockClass = ach.completed ? "" : "locked-badge";
            const statusBadge = ach.completed
                ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Completed</span>`
                : `<span class="badge bg-secondary">In Progress</span>`;

            col.innerHTML = `
                <div class="achievement-card ${statusClass} d-flex flex-column justify-content-between">
                    <div class="d-flex align-items-start gap-3">
                        <div class="achievement-badge-graphic ${ach.theme || "badge-gold"} ${badgeLockClass}">
                            <i class="bi ${ach.icon || "bi-award-fill"}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
                                <h6 class="fw-bold text-white mb-0">${ach.name}</h6>
                                ${statusBadge}
                            </div>
                            <p class="small text-white opacity-75 mb-2">${ach.shortDesc}</p>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center pt-2 mt-2 border-top border-secondary">
                        <span class="small text-info">${ach.progressText || ""}</span>
                        <button type="button" class="btn btn-sm btn-outline-warning fw-semibold" onclick="openAchievementInfo('${ach.id}')">
                            <i class="bi bi-info-circle me-1"></i>More Info
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(col);
        });
    } catch (err) {
        console.error("Error loading lobby achievements:", err);
        grid.innerHTML = `<div class="col-12"><p class="text-danger small mb-0">Unable to load achievements.</p></div>`;
    }
}

function openAchievementInfo(achievementId) {
    const ach = lobbyAchievementsCache.find((item) => item.id === achievementId);
    if (!ach) return;

    const badgeEl = document.getElementById("modalAchievementBadge");
    const iconEl = document.getElementById("modalAchievementIcon");
    const nameEl = document.getElementById("modalAchievementName");
    const statusEl = document.getElementById("modalAchievementStatus");
    const descEl = document.getElementById("modalAchievementDesc");
    const criteriaEl = document.getElementById("modalAchievementCriteria");
    const progressEl = document.getElementById("modalAchievementProgress");

    if (badgeEl) {
        badgeEl.className = `achievement-badge-graphic ${ach.theme || "badge-gold"} ${ach.completed ? "" : "locked-badge"}`;
    }
    if (iconEl) {
        iconEl.className = `bi ${ach.icon || "bi-award-fill"}`;
    }
    if (nameEl) nameEl.textContent = ach.name;
    if (statusEl) {
        statusEl.className = ach.completed ? "badge bg-success" : "badge bg-secondary";
        statusEl.textContent = ach.completed ? "Completed" : "Not Yet Completed";
    }
    if (descEl) descEl.textContent = ach.shortDesc;
    if (criteriaEl) criteriaEl.textContent = ach.criteria;
    if (progressEl) progressEl.textContent = `Current Progress: ${ach.progressText || "N/A"}`;

    const modalEl = document.getElementById("achievementInfoModal");
    if (modalEl && typeof bootstrap !== "undefined") {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function setupGuestLobbyView(playerId) {
    const dashboardNavItem = document.getElementById("dashboard-nav-item");
    const saveContainer = document.getElementById("lobby-save-container");
    const lobbyContainer = document.querySelector(".container.my-5");
    const achievementsSection = document.getElementById("lobbyAchievementsSection");

    if (achievementsSection) achievementsSection.classList.add("d-none");

    if (dashboardNavItem) {
        dashboardNavItem.innerHTML = `
            <span class="nav-link text-muted" style="cursor: not-allowed;" title="Create an account to unlock your dashboard">
                <span class="bi-lock-fill me-1 text-warning"></span> Dashboard (Locked)
            </span>
        `;
    }
    if (saveContainer) saveContainer.style.display = "none";

    if (lobbyContainer) {
        const safeGuestId = playerId || "Guest";
        const pokerBanner = document.createElement("div");
        pokerBanner.className = "alert alert-dismissible fade show mb-4 text-white shadow-lg border-0";
        pokerBanner.style.background = "linear-gradient(135deg, #1b2a47 0%, #315CA8 100%)";
        pokerBanner.style.borderLeft = "5px solid #f1c40f";
        pokerBanner.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="fs-2 me-3 text-warning">
                    <i class="bi bi-suit-spade-fill"></i><i class="bi bi-suit-heart-fill text-danger ms-n2"></i>
                </div>
                <div>
                    <h5 class="fw-bold mb-1 text-warning">Playing as Guest (${encodeURIComponent(safeGuestId)})</h5>
                    <p class="mb-0 text-white opacity-90 small">
                        Your chip stack is currently temporary! <strong>Create an account</strong> to save your points.
                    </p>
                </div>
                <div class="ms-auto">
                    <a href="signup.html?playerId=${encodeURIComponent(safeGuestId)}" class="btn btn-save-points fw-bold text-dark px-3 py-2 text-nowrap">
                        <i class="bi bi-person-plus-fill me-1"></i> Save Points & Sign Up
                    </a>
                </div>
            </div>
        `;
        lobbyContainer.prepend(pokerBanner);
    }
}

function setUpLoggedInLobbyView(user) {
    const dashboardNavItem = document.getElementById("dashboard-nav-item");
    const saveContainer = document.getElementById("lobby-save-container");
    if (dashboardNavItem) {
        dashboardNavItem.innerHTML = `
            <a class="nav-link fw-semibold text-white" href="index.html">
                <span class="bi-house-fill me-1"></span> Dashboard
            </a>
        `;
    }
    if (saveContainer) saveContainer.style.display = "none";
}

function setupCommonLobbyListeners(playerId) {
    const lobbySaveBtn = document.getElementById("lobby-save-btn");
    if (lobbySaveBtn) {
        lobbySaveBtn.addEventListener("click", () => {
            const currentId = playerId || "Guest";
            window.location.href = `signup.html?playerId=${encodeURIComponent(currentId)}`;
        });
    }

    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/logout";
        });
    }
}

function openJoinSidebar(tableId, tableName, blinds, minBuyin) {
    const rankedTables = [
        "ranked-beginner",
        "ranked-intermediate",
        "ranked-advanced"
    ];

    if (!rankedTables.includes(tableId)) {
        console.error("Invalid ranked table:", tableId);
        return;
    }

    document.getElementById("sidebarTableName").textContent = tableName;
    document.getElementById("sidebarTableBlinds").textContent = blinds;
    document.getElementById("sidebarTableMinBuyin").textContent = minBuyin;

    const numericBuyin = parseInt(minBuyin.replace(/[^0-9]/g, ""), 10) || 1000;

    const buyInInput = document.getElementById("buyInAmount");
    buyInInput.value = numericBuyin;
    buyInInput.min = numericBuyin;

    const form = document.getElementById("joinTableForm");
    let hiddenInput = form.querySelector('input[name="tableId"]');

    if (!hiddenInput) {
        hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "tableId";
        form.appendChild(hiddenInput);
    }

    hiddenInput.value = tableId;

    if (joinSidebar) joinSidebar.show();
}

function togglePublicLobbies() {
    const section = document.getElementById("publicLobbiesSection");
    if (!section) return;

    section.classList.toggle("d-none");
    if (!section.classList.contains("d-none")) {
        loadPublicTableLeaderboards();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

const joinTableForm = document.getElementById("joinTableForm");

if (joinTableForm) {
    joinTableForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        let resolvedPlayerId = "";

        if (sessionStorage.getItem("identityMode") === "guest") {
            resolvedPlayerId = sessionStorage.getItem("guestPlayerId");
        } else {
            try {
                const res = await fetch("/loggeduser");
                const user = await res.json();

                if (user && (user.username || user.email || user.id)) {
                    resolvedPlayerId = user.username ||
                        (user.email ? user.email.split("@")[0] : user.id);
                }
            } catch (error) {
                console.error("Session check during table join failed:", error);
            }
        }

        if (!resolvedPlayerId) {
            const urlParams = new URLSearchParams(window.location.search);
            const urlPlayerId = urlParams.get("playerId");

            if (urlPlayerId && urlPlayerId.startsWith("Guest_")) {
                resolvedPlayerId = urlPlayerId;
                sessionStorage.setItem("guestPlayerId", resolvedPlayerId);
                sessionStorage.setItem("identityMode", "guest");
            } else {
                resolvedPlayerId = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
                sessionStorage.setItem("guestPlayerId", resolvedPlayerId);
                sessionStorage.setItem("identityMode", "guest");
            }
        }

        const existingInput = this.querySelector('input[name="playerId"]');
        if (existingInput) {
            existingInput.remove();
        }

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "playerId";
        input.value = resolvedPlayerId;
        this.appendChild(input);

        HTMLFormElement.prototype.submit.call(this);
    });
}

async function loadPublicTableLeaderboards() {
    const grid = document.getElementById("publicTableLeaderboardsGrid");
    const monthBadge = document.getElementById("leaderboardMonthBadge");
    if (!grid) return;

    try {
        const res = await fetch("/api/tables/public/leaderboards", { cache: "no-store" });
        if (!res.ok) {
            throw new Error("Failed to load public table leaderboards.");
        }

        const data = await res.json();
        const tables = Array.isArray(data.tables) ? data.tables : [];

        if (monthBadge && data.month) {
            monthBadge.textContent = `Month: ${data.month} (Monthly Reset)`;
        }

        grid.textContent = "";

        if (tables.length === 0) {
            const emptyCol = document.createElement("div");
            emptyCol.className = "col-12";

            const emptyMsg = document.createElement("p");
            emptyMsg.className = "text-white opacity-75 small fst-italic mb-0";
            emptyMsg.textContent = "No public tables or monthly points recorded yet.";

            emptyCol.appendChild(emptyMsg);
            grid.appendChild(emptyCol);
            return;
        }

        tables.forEach((table) => {
            const col = document.createElement("div");
            col.className = "col-md-6 col-lg-4";

            const card = document.createElement("div");
            card.className = "achievement-card d-flex flex-column justify-content-between";

            const header = document.createElement("div");
            header.className = "d-flex justify-content-between align-items-start gap-2 mb-2 pb-2 border-bottom border-secondary";

            const titleWrap = document.createElement("div");
            const titleEl = document.createElement("h6");
            titleEl.className = "fw-bold text-white mb-0";
            titleEl.textContent = table.tableName || table.tableId;

            const stakesEl = document.createElement("small");
            stakesEl.className = "text-info";
            if (table.smallBlind && table.bigBlind) {
                stakesEl.textContent = `Blinds: $${table.smallBlind} / $${table.bigBlind}`;
            } else {
                stakesEl.textContent = `Table ID: ${table.tableId}`;
            }

            titleWrap.append(titleEl, stakesEl);

            const monthPill = document.createElement("span");
            monthPill.className = "badge bg-primary";
            monthPill.textContent = data.month || "Monthly";

            header.append(titleWrap, monthPill);
            card.appendChild(header);

            const entries = Array.isArray(table.leaderboard) ? table.leaderboard : [];
            if (entries.length === 0) {
                const noPlayers = document.createElement("p");
                noPlayers.className = "small text-white opacity-75 fst-italic my-3 text-center";
                noPlayers.textContent = "No points gained at this table this month.";
                card.appendChild(noPlayers);
            } else {
                const list = document.createElement("ol");
                list.className = "list-group list-group-flush small";

                entries.slice(0, 5).forEach((entry) => {
                    const item = document.createElement("li");
                    item.className = "list-group-item bg-transparent text-white border-secondary d-flex justify-content-between align-items-center px-0 py-2";

                    const left = document.createElement("div");
                    const rankBadge = document.createElement("span");
                    rankBadge.className = entry.rank === 1
                        ? "badge bg-warning text-dark me-2"
                        : entry.rank === 2
                            ? "badge bg-secondary me-2"
                            : entry.rank === 3
                                ? "badge bg-info text-dark me-2"
                                : "badge bg-dark border border-secondary me-2";
                    rankBadge.textContent = `#${entry.rank}`;

                    const nameText = document.createElement("span");
                    nameText.className = "fw-semibold";
                    nameText.textContent = entry.playerId;

                    const handsMeta = document.createElement("small");
                    handsMeta.className = "d-block text-white opacity-75 ms-4";
                    handsMeta.textContent = `${entry.handsWon}W / ${entry.handsPlayed}H`;

                    left.append(rankBadge, nameText, handsMeta);

                    const pointsEl = document.createElement("span");
                    const isPositive = Number(entry.pointsGained) >= 0;
                    pointsEl.className = isPositive ? "fw-bold text-success" : "fw-bold text-danger";
                    const formattedPts = Math.abs(Number(entry.pointsGained) || 0).toLocaleString();
                    pointsEl.textContent = `${isPositive ? "+" : "-"}${formattedPts} pts`;

                    item.append(left, pointsEl);
                    list.appendChild(item);
                });

                card.appendChild(list);
            }

            col.appendChild(card);
            grid.appendChild(col);
        });
    } catch (err) {
        console.error("Error loading public table leaderboards:", err);
        grid.textContent = "";
        const errCol = document.createElement("div");
        errCol.className = "col-12";
        const errMsg = document.createElement("p");
        errMsg.className = "text-danger small mb-0";
        errMsg.textContent = "Unable to load monthly leaderboards right now.";
        errCol.appendChild(errMsg);
        grid.appendChild(errCol);
    }
}
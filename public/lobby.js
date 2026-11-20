/*
  ============================================================================
  File Name: lobby.js
  Author: Gigi Li
  Purpose: Lobby interface for the Texas Hold'em web application. 
           Allows users to view public tables, join games, and view all
           achievements with completion status and info modals when logged in.
  ============================================================================
*/
let joinSidebar;
let lobbyAchievementsCache = [];

document.addEventListener("DOMContentLoaded", async function() {
    const sidebarElement = document.getElementById('joinGameSidebar');
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
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
            const res = await fetch('/loggeduser');
            const user = await res.json();
            const isLoggedIn = user && (user.username || user.email || user.id);

            if (!isLoggedIn) {
                localStorage.removeItem("guestPlayerId");
                sessionStorage.removeItem("guestPlayerId");
                setupGuestLobbyView(playerId);
            } else {
                const resolvedUserId = user.username || (user.email ? user.email.split('@')[0] : user.id);
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
        lobbyAchievementsCache.forEach(ach => {
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
    const ach = lobbyAchievementsCache.find(item => item.id === achievementId);
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
    const dashboardNavItem = document.getElementById('dashboard-nav-item');
    const saveContainer = document.getElementById('lobby-save-container');
    const lobbyContainer = document.querySelector('.container.my-5');
    const achievementsSection = document.getElementById('lobbyAchievementsSection');

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
        const pokerBanner = document.createElement('div');
        pokerBanner.className = 'alert alert-dismissible fade show mb-4 text-white shadow-lg border-0';
        pokerBanner.style.background = 'linear-gradient(135deg, #1b2a47 0%, #315CA8 100%)';
        pokerBanner.style.borderLeft = '5px solid #f1c40f';
        pokerBanner.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="fs-2 me-3 text-warning">
                    <i class="bi bi-suit-spade-fill"></i><i class="bi bi-suit-heart-fill text-danger ms-n2"></i>
                </div>
                <div>
                    <h5 class="fw-bold mb-1 text-warning">Playing as Guest (${encodeURIComponent(playerId)})</h5>
                    <p class="mb-0 text-white opacity-90 small">
                        Your chip stack is currently temporary! <strong>Create an account</strong> to save your points.
                    </p>
                </div>
                <div class="ms-auto">
                    <a href="signup.html?playerId=${encodeURIComponent(playerId)}" class="btn btn-save-points fw-bold text-dark px-3 py-2 text-nowrap">
                        <i class="bi bi-person-plus-fill me-1"></i> Save Points & Sign Up
                    </a>
                </div>
            </div>
        `;
        lobbyContainer.prepend(pokerBanner);
    }
}

function setUpLoggedInLobbyView(user) {
    const dashboardNavItem = document.getElementById('dashboard-nav-item');
    const saveContainer = document.getElementById('lobby-save-container');
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
    
    document.getElementById('sidebarTableName').textContent = tableName;
    document.getElementById('sidebarTableBlinds').textContent = blinds;
    document.getElementById('sidebarTableMinBuyin').textContent = minBuyin;
    
    let numericBuyin = parseInt(minBuyin.replace(/[^0-9]/g, '')) || 1000;
    
    const buyInInput = document.getElementById('buyInAmount');
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
    const section = document.getElementById('publicLobbiesSection');
    section.classList.toggle('d-none');
    if (!section.classList.contains('d-none')) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

const joinTableForm = document.getElementById("joinTableForm");

if (joinTableForm) {
    joinTableForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        let resolvedPlayerId = "";

        if (sessionStorage.getItem("identityMode") === "guest") {
            resolvedPlayerId = sessionStorage.getItem("guestPlayerId");
        } else {
            try {
                const res = await fetch('/loggeduser');
                const user = await res.json();

                if (user && (user.username || user.email || user.id)) {
                    resolvedPlayerId = user.username || 
                        (user.email ? user.email.split('@')[0] : user.id);
                }
            } catch (error) {
                console.error('Session check during table join failed:', error);
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
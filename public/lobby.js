/*
  ============================================================================
  File Name: lobby.js
  Author: Gigi Li
  Purpose: Lobby interface for the Texas Hold'em web application. 
           Allows users to view public tables and join games.
  ============================================================================
*/
let joinSidebar;

document.addEventListener("DOMContentLoaded", async function() {
    // 1. Initialize Bootstrap Offcanvas Sidebar for Joining Tables
    const sidebarElement = document.getElementById('joinGameSidebar');
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
    }

    // 2. Guest Session Checks & Navigation Restrictions
    const urlParams = new URLSearchParams(window.location.search);
    let playerId = urlParams.get("playerId");

    // Fallback: check localStorage/sessionStorage if missing from URL query
    if (!playerId) {
        playerId = localStorage.getItem("guestPlayerId") || sessionStorage.getItem("guestPlayerId");
    } else {
        localStorage.setItem("guestPlayerId", playerId);
    }

    try {
        const res = await fetch('/loggeduser');
        const user = await res.json();
        const dashboardNavItem = document.getElementById('dashboard-nav-item');
        const saveContainer = document.getElementById('lobby-save-container');
        const lobbyContainer = document.querySelector('.container.my-5');
        const isLoggedIn = user && (user.username || user.email || user.id);

        // If no active server session user, but we have a guest playerId
        if (!isLoggedIn && playerId) {
            //guest view: disable dashboard link and show a banner
            if (dashboardNavItem) {
                dashboardNavItem.innerHTML = `
                    <span class="nav-link text-muted" style="cursor: not-allowed;" title="Create an account to unlock your dashboard">
                        <span class="bi-lock-fill me-1 text-warning"></span> Dashboard (Locked)
                    </span>
                `;
            }
            if (saveContainer) saveContainer.style.display = "none";

            // Poker themed banner for signing up
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
                                Your chip stack is currently temporary! <strong>Create an account</strong> to save your points, lock in your stats, and unlock your personal player dashboard.
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
        } else {
            //logged-in user: clear any guest playerId from storage to avoid confusion
            localStorage.removeItem("guestPlayerId");
            sessionStorage.removeItem("guestPlayerId");

            // LOGGED-IN USER VIEW: Keep normal Dashboard link and hide guest save elements
            if (dashboardNavItem) {
                dashboardNavItem.innerHTML = `
                    <a class="nav-link fw-semibold text-white" href="index.html">
                        <span class="bi-house-fill me-1"></span> Dashboard
                    </a>
                `;
            }
            if (saveContainer) saveContainer.style.display = "none";
        }
    } catch (e) {
        console.error("Session verification failed:", e);
    }

    // Handle Save Points button click in the lobby header
    const lobbySaveBtn = document.getElementById("lobby-save-btn");
    if (lobbySaveBtn) {
        lobbySaveBtn.addEventListener("click", () => {
            const currentId = playerId || "Guest";
            window.location.href = `signup.html?playerId=${encodeURIComponent(currentId)}`;
        });
    }

    //clear guest player storage immediately when user clicks logout
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear();
            if (typeof socket !== 'undefined' && socket) {
                socket.disconnect();
            }
            window.location.href = "/logout";
        });
    }
});

// Open the table seating sidebar and populate values
function openJoinSidebar(tableName, blinds, minBuyin) {
    document.getElementById('sidebarTableName').value = tableName;
    document.getElementById('sidebarTableBlinds').value = blinds;
    document.getElementById('sidebarTableMinBuyin').value = minBuyin;
    let numericBuyin = parseInt(minBuyin.replace(/[^0-9]/g, '')) || 1000;
    document.getElementById('buyInAmount').value = numericBuyin;
    document.getElementById('buyInAmount').min = numericBuyin;
    if (joinSidebar) joinSidebar.show();
}

// Toggle public lobbies section visibility
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

// Ensure table seating form appends the correct guest playerId when submitting
const joinTableForm = document.getElementById("joinTableForm");
if (joinTableForm) {
    joinTableForm.addEventListener("submit", async function(event) {
        // Double check if there is an active user session before appending guest playerId
        try {
            const res = await fetch('/loggeduser');
            const user = await res.json();

            if (user && (user.username || user.email || user.id)) {
                // Logged-in user: no need to append guest playerId
                const existingGuestInput = this.querySelector('input[name="playerId"]');
                if (existingGuestInput) {
                    existingGuestInput.remove();
                }
                return;
        }
        } catch (error) {
            console.error('Session check during table join failed:', error);
        }

        const urlParams = new URLSearchParams(window.location.search);
        let playerId = urlParams.get("playerId") || localStorage.getItem("guestPlayerId");
        
        if (playerId && !this.querySelector('input[name="playerId"]')) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "playerId";
            input.value = playerId;
            this.appendChild(input);
        }
    });
}
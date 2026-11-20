/**
 * ============================================================================
 * File Name: index.js
 * Author: Bonita Rodrigues, Gigi Li
 * Purpose: Frontend controller script for the User Dashboard homepage. Manages 
 *          dynamic user profile/points loading, earned achievement badges at
 *          the top, progress bars for all achievements at the bottom, user
 *          search, and asynchronous friend list/request rendering.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async function() {

    const modalEl = document.getElementById("friendChatModal");
    if (modalEl) {
        modalEl.addEventListener("hidden.bs.modal", () => {
            activeChatFriend = null;
        });
    }
    
    // Clear local storage and disconnect socket on logout to prevent session persistence
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
        logoutLink.addEventListener("click", () => {
            localStorage.clear();
            sessionStorage.clear();
            if (typeof socket !== 'undefined' && socket) {
                socket.disconnect();
            }
        });
    }
    
    let activeUsername = "";

    // ------------------------------------------------------------------------
    // 1. Fetch & Populate Logged-In User Profile & Points
    // ------------------------------------------------------------------------
    try {
        // Request the active session user from '/loggeduser' without stale browser caching
        const response = await fetch('/loggeduser', { cache: 'no-store' });
        if (response.ok) {
            const user = await response.json();
            if (user) {
                // Clear leftover guest identifiers once a real account session is active
                sessionStorage.removeItem('identityMode');
                sessionStorage.removeItem('guestPlayerId');
                localStorage.removeItem('guestPlayerId');

                const resolvedName = user.username || (user.email ? user.email.split('@')[0] : '');
                currentLoggedInUser = resolvedName || null;

                const usernameDisplay = document.getElementById('dashboardUsername');
                const pointsDisplay = document.getElementById('dashboardPoints');

                if (usernameDisplay) {
                    // Show the logged-in user's username on the dashboard banner
                    usernameDisplay.textContent = resolvedName || 'Player';
                }
                if (pointsDisplay) {
                    // Render the user's latest saved points balance
                    pointsDisplay.innerHTML = `<i class="bi bi-coin"></i> ${(user.points !== undefined ? user.points : 1000).toLocaleString()}`;
                }

                // Make the dashboard visible only after session user and points are populated
                document.body.style.visibility = 'visible';
            } else {
                // Redirect immediately to login if no authenticated user is found
                window.location.replace('login.html');
                return;
            }
        } else {
            window.location.replace('login.html');
            return;
        }
    } catch (err) {
        console.error("Failed to load user session info:", err);
        window.location.replace('login.html');
        return;
    }

    // ------------------------------------------------------------------------
    // 1b. Load Earned Badges (Top) & All Achievement Progress Bars (Bottom)
    // ------------------------------------------------------------------------
    if (activeUsername) {
        await loadDashboardAchievements(activeUsername);
    }

    // ------------------------------------------------------------------------
    // 1b. Load Earned Badges (Top) & All Achievement Progress Bars (Bottom)
    // ------------------------------------------------------------------------
    if (activeUsername) {
        await loadDashboardAchievements(activeUsername);
    }

    // ------------------------------------------------------------------------
    // 2. Automatically Load Friends & Requests Feed on Page Load
    // ------------------------------------------------------------------------
    loadFriendsData();

    // ------------------------------------------------------------------------
    // 3. Friend Search & Social Lookup Functionality
    // ------------------------------------------------------------------------
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("userSearchInput");
    const searchResults = document.getElementById("searchResults");

    if (searchBtn && searchInput && searchResults) {
        searchBtn.addEventListener("click", async () => {
            const query = searchInput.value.trim();
            if (!query) return;

            try {
                const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const users = await response.json();

                searchResults.innerHTML = "";
                
                if (!users || users.length === 0) {
                    searchResults.innerHTML = `<div class="p-2 text-muted small">No users found.</div>`;
                    return;
                }

                users.forEach(user => {
                    const displayIdentifier = user.username || (user.email ? user.email.split('@')[0] : user.login);
                    searchResults.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center border-secondary py-2 px-3 rounded mb-1" style="background-color: #1f6ab6 !important;">
                            <span class="fw-semibold text-white">
                                <i class="bi bi-person-fill text-white me-2"></i>${displayIdentifier}
                            </span>
                            <form action="/friends/request" method="POST" class="m-0">
                                <input type="hidden" name="targetUser" value="${displayIdentifier}">
                                <button type="submit" class="btn btn-sm btn-outline-light fw-semibold shadow-none">Request Friend</button>
                            </form>
                        </div>
                    `;
                });
            } catch (err) {
                console.error("User search failed:", err);
            }
        });
    }
});

async function loadDashboardAchievements(playerId) {
    const badgesContainer = document.getElementById("dashboardEarnedBadges");
    const countBadge = document.getElementById("dashboardBadgeCount");
    const progressGrid = document.getElementById("dashboardAchievementsProgressGrid");
    const overallBadge = document.getElementById("dashboardAchievementOverall");

    try {
        const res = await fetch(`/api/achievements/${encodeURIComponent(playerId)}`);
        if (!res.ok) throw new Error("Failed to load achievements.");
        const data = await res.json();

        const allAchievements = data.achievements || [];
        const earned = data.completedAchievements || [];

        if (countBadge) {
            countBadge.textContent = `${earned.length} Badge${earned.length === 1 ? "" : "s"} Earned`;
        }
        if (overallBadge) {
            overallBadge.textContent = `${data.completedCount || earned.length} / ${data.totalCount || allAchievements.length} Completed`;
        }

        // Top Earned Badges Showcase
        if (badgesContainer) {
            if (earned.length === 0) {
                badgesContainer.innerHTML = `
                    <span class="small text-white opacity-75 fst-italic">
                        No badges earned yet. Play hands in the Poker Lobby to unlock achievements!
                    </span>
                `;
            } else {
                badgesContainer.innerHTML = "";
                earned.forEach(ach => {
                    const pill = document.createElement("div");
                    pill.className = "earned-badge-pill";
                    pill.title = `${ach.name}: ${ach.shortDesc}`;
                    pill.innerHTML = `
                        <div class="achievement-badge-graphic ${ach.theme || "badge-gold"}">
                            <i class="bi ${ach.icon || "bi-award-fill"}"></i>
                        </div>
                        <div>
                            <div class="fw-bold small text-white">${ach.name}</div>
                            <div class="text-warning" style="font-size: 0.72rem;">${ach.shortDesc}</div>
                        </div>
                    `;
                    badgesContainer.appendChild(pill);
                });
            }
        }

        // Bottom All-Achievements Progress Bars Grid
        if (progressGrid) {
            progressGrid.innerHTML = "";
            allAchievements.forEach(ach => {
                const pct = Math.max(0, Math.min(100, Number(ach.percent) || (ach.completed ? 100 : 0)));
                const barClass = ach.completed ? "bg-success" : "bg-info";
                const cardClass = ach.completed ? "achievement-completed" : "achievement-locked";
                const badgeLockClass = ach.completed ? "" : "locked-badge";
                const statusPill = ach.completed
                    ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Completed</span>`
                    : `<span class="badge bg-secondary">${pct}%</span>`;

                const col = document.createElement("div");
                col.className = "col-md-6 col-lg-4";
                col.innerHTML = `
                    <div class="achievement-card ${cardClass} d-flex flex-column justify-content-between">
                        <div class="d-flex align-items-start gap-3 mb-2">
                            <div class="achievement-badge-graphic ${ach.theme || "badge-gold"} ${badgeLockClass}">
                                <i class="bi ${ach.icon || "bi-award-fill"}"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
                                    <h6 class="fw-bold text-white mb-0">${ach.name}</h6>
                                    ${statusPill}
                                </div>
                                <p class="small text-white opacity-75 mb-1">${ach.shortDesc}</p>
                                <div class="small text-secondary">${ach.criteria || ""}</div>
                            </div>
                        </div>
                        <div class="pt-2">
                            <div class="d-flex justify-content-between align-items-center small mb-1">
                                <span class="text-warning fw-semibold">${ach.progressText || ""}</span>
                                <span class="text-info fw-semibold">${pct}%</span>
                            </div>
                            <div class="progress achievement-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar ${barClass}" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    </div>
                `;
                progressGrid.appendChild(col);
            });
        }
    } catch (err) {
        console.error("Error loading dashboard achievements:", err);
        if (badgesContainer) {
            badgesContainer.innerHTML = `<span class="small text-danger">Unable to load badges right now.</span>`;
        }
        if (progressGrid) {
            progressGrid.innerHTML = `<div class="col-12"><p class="text-danger small mb-0">Unable to load achievement progress bars.</p></div>`;
        }
    }
}

async function loadFriendsData() {
    const pendingContainer = document.getElementById("pendingRequestsList");
    const friendsContainer = document.getElementById("friendListContainer");

    try {
        const response = await fetch('/api/friends/data');
        if (!response.ok) return;
        const data = await response.json();
        const unreadCounts = data.unreadCounts || {};

        if (pendingContainer) {
            pendingContainer.innerHTML = "";
            if (!data.friendRequests || data.friendRequests.length === 0) {
                pendingContainer.innerHTML = `<div class="p-2 small text-white opacity-75 fst-italic">No pending requests.</div>`;
            } else {
                data.friendRequests.forEach(requester => {
                    pendingContainer.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3" style="background-color: #165da3 !important;">
                            <span class="fw-semibold text-white">
                                <i class="bi bi-person-fill text-white me-2"></i>${requester}
                            </span>
                            <div class="btn-group">
                                <form action="/friends/accept" method="POST" class="m-0 me-1">
                                    <input type="hidden" name="requester" value="${requester}">
                                    <button type="submit" class="btn btn-sm btn-outline-success shadow-none" title="Accept"><i class="bi bi-check-lg"></i></button>
                                </form>
                                <form action="/friends/decline" method="POST" class="m-0">
                                    <input type="hidden" name="requester" value="${requester}">
                                    <button type="submit" class="btn btn-sm btn-outline-danger shadow-none" title="Decline"><i class="bi bi-x-lg"></i></button>
                                </form>
                            </div>
                        </div>
                    `;
                });
            }
        }

        if (friendsContainer) {
            friendsContainer.innerHTML = "";
            if (!data.friends || data.friends.length === 0) {
                friendsContainer.innerHTML = `<div class="p-2 small text-white opacity-75 fst-italic">No friends added yet.</div>`;
            } else {
                data.friends.forEach(friend => {
                    const friendName = typeof friend === "string"
                        ? friend
                        : (friend.username || friend.name || String(friend));
                    const unreadCount = Number(unreadCounts[friendName] || 0);

                    const row = document.createElement("div");
                    row.className = "list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3";
                    row.style.cssText = "background-color: #165da3 !important;";

                    const nameSpan = document.createElement("span");
                    nameSpan.className = "fw-semibold text-white";
                    nameSpan.innerHTML = `<i class="bi bi-circle-fill text-success small me-2"></i>`;
                    nameSpan.appendChild(document.createTextNode(friendName));

                    const rightGroup = document.createElement("div");
                    rightGroup.className = "d-flex align-items-center gap-2";

                    const badge = document.createElement("span");
                    badge.className = "badge bg-success text-white";
                    badge.textContent = "Online";

                    const chatBtn = document.createElement("button");
                    chatBtn.type = "button";
                    chatBtn.className = "btn btn-sm btn-outline-light py-0 px-2 shadow-none position-relative";
                    chatBtn.title = unreadCount > 0
                        ? `Chat with ${friendName} (${unreadCount} unread)`
                        : `Chat with ${friendName}`;
                    chatBtn.setAttribute("aria-label", chatBtn.title);
                    chatBtn.innerHTML = `<i class="bi bi-chat-dots-fill"></i>`;

                    if (unreadCount > 0) {
                        const unreadBadge = document.createElement("span");
                        unreadBadge.className = "position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger";
                        unreadBadge.style.fontSize = "0.65rem";
                        unreadBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
                        chatBtn.appendChild(unreadBadge);
                    }

                    chatBtn.addEventListener("click", () => openFriendChatModal(friendName));

                    rightGroup.append(badge, chatBtn);
                    row.append(nameSpan, rightGroup);
                    friendsContainer.appendChild(row);
                });
            }
        }
    } catch (err) {
        console.error("Failed to load friends data:", err);
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const reportInput = document.getElementById("reportedUsername");
    const suggestionsBox = document.getElementById("reportUserSuggestions");
    const reportForm = document.getElementById("reportUserForm");

    if (reportInput && suggestionsBox) {
        reportInput.addEventListener("input", async function() {
            const query = this.value.trim();
            if (query.length < 1) {
                suggestionsBox.innerHTML = "";
                return;
            }

            try {
                const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const users = await response.json();

                suggestionsBox.innerHTML = "";
                if (users && users.length > 0) {
                    users.forEach(user => {
                        const name = user.username || user.email.split('@')[0];
                        const item = document.createElement("button");
                        item.type = "button";
                        item.className = "list-group-item list-group-item-action py-1 px-2 text-white border-secondary";
                        item.style.backgroundColor = "#131b2e";
                        item.innerHTML = `<i class="bi bi-person me-2"></i>${name}`;
                        
                        item.addEventListener("click", function() {
                            reportInput.value = name;
                            suggestionsBox.innerHTML = "";
                        });

                        suggestionsBox.appendChild(item);
                    });
                }
            } catch (err) {
                console.error("Autocomplete search failed:", err);
            }
        });

        document.addEventListener("click", function(e) {
            if (!reportInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.innerHTML = "";
            }
        });
    }

    if (reportForm) {
        reportForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const reportedUsername = document.getElementById("reportedUsername").value;
            const reason = document.getElementById("reportReason").value;
            const details = document.getElementById("reportDetails").value;

            try {
                const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportedUsername, reason, details })
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Report successfully submitted to administration.");
                    reportForm.reset();
                    const modalEl = document.getElementById('reportModal');
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                } else {
                    alert(result.error || "Failed to submit report.");
                }
            } catch (err) {
                console.error("Error submitting report:", err);
                alert("Network error. Please try again.");
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", async function() {
    await loadUserMessages();
});

async function loadUserMessages() {
    try {
        const response = await fetch('/api/user/messages');
        if (!response.ok) return;

        const messages = await response.json();
        const badge = document.getElementById('msgBadge');
        const modalBody = document.getElementById('messagesModalBody');

        if (messages.length > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = messages.length;

            modalBody.innerHTML = "";
            let accordionHtml = `<div class="accordion accordion-flush" id="messagesAccordion">`;
            
            messages.reverse().forEach((msg, index) => {
                const dateStr = new Date(msg.date).toLocaleString();
                const collapseId = `collapseMsg${index}`;
                const headingId = `headingMsg${index}`;

                accordionHtml += `
                    <div class="accordion-item bg-dark border border-secondary mb-2 rounded overflow-hidden">
                        <h2 class="accordion-header" id="${headingId}">
                            <button class="accordion-button collapsed bg-dark text-white shadow-none d-flex justify-content-between align-items-center" 
                                type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                                <span>
                                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i> 
                                    <strong>${msg.sender}</strong>
                                </span>
                                <small class="text-white opacity-75 ms-auto me-3">${dateStr}</small>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#messagesAccordion">
                            <div class="accordion-body bg-dark text-white border-top border-secondary p-3">
                                <p class="mb-3">${msg.text}</p>
                                <div class="text-end">
                                    <button class="btn btn-outline-danger btn-sm shadow-none" onclick="deleteMessage('${msg._id}')">
                                        <i class="bi bi-trash-fill me-1"></i> Delete Message
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            accordionHtml += `</div>`;
            modalBody.innerHTML = accordionHtml;
        } else {
            badge.style.display = 'none';
            modalBody.innerHTML = `<p class="text-white opacity-75 text-center fst-italic my-3">You have no new messages or warnings.</p>`;
        }
    } catch (err) {
        console.error("Error loading user messages:", err);
    }
}

async function deleteMessage(msgId) {
    try {
        const response = await fetch(`/api/user/messages/${msgId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadUserMessages();
        } else {
            console.error("Failed to delete message");
        }
    } catch (err) {
        console.error("Error deleting message:", err);
    }
}


// ============================================================================
// Create Custom Poker Table
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    const createTableForm = document.getElementById("createTableForm");
document.addEventListener("DOMContentLoaded", function() {
    const createTableForm = document.getElementById("createTableForm");

    if (createTableForm) {
        createTableForm.addEventListener("submit", async function(e) {
            e.preventDefault();
    if (createTableForm) {
        createTableForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const tableName = document.getElementById("newTableName").value.trim();
            const blinds = document.getElementById("newTableBlinds").value.trim();
            const buyIn = document.getElementById("newTableMinBuyin").value;
            const maxPlayers = document.getElementById("newTableMaxPlayers").value;
            const visibility = document.getElementById("newTableVisibility").value;

            const blindValues = blinds.split("/").map(value =>
                Number(value.trim().replace("$", ""))
            );

            if (
                blindValues.length !== 2 ||
                blindValues.some(value => !Number.isFinite(value) || value <= 0)
            ) {
                alert("Please enter blinds in the format $2 / $4.");
                return;
            }
            if (
                blindValues.length !== 2 ||
                blindValues.some(value => !Number.isFinite(value) || value <= 0)
            ) {
                alert("Please enter blinds in the format $2 / $4.");
                return;
            }

            const tableData = {
                tableName,
                maxPlayers,
                buyIn,
                smallBlind: blindValues[0],
                bigBlind: blindValues[1],
                visibility
            };
            const tableData = {
                tableName,
                maxPlayers,
                buyIn,
                smallBlind: blindValues[0],
                bigBlind: blindValues[1],
                visibility
            };

            try {
                const response = await fetch("/api/tables/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(tableData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Table created successfully!");
                    createTableForm.reset();
                    window.location.href =
                        `tableDisplay.html?tableId=${encodeURIComponent(result.tableId)}`;
                } else {
                    alert(result.error || "Failed to create table.");
                }

            } catch (err) {
                console.error("Error creating table:", err);
                alert("Network error. Please try again.");
            }
        });
    }
});
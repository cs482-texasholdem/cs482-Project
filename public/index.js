/**
 * ============================================================================
 * File Name: index.js
 * Purpose: Frontend controller script for the User Dashboard homepage. Manages
 *          dynamic user profile/points loading, earned achievement badges at
 *          the top, progress bars for all achievements at the bottom, user
 *          search, friend list/request rendering, real-time presence, direct
 *          friend chat, player reports, user notifications, and custom poker
 *          table creation.
 * ============================================================================
 */

let activeChatFriend = null;
let currentLoggedInUser = null;
let friendChatModalInstance = null;
let presenceSocket = null;
// Avatar selection state
let currentAvatar = "default";
let selectedAvatar = "default";
let availableAvatars = [];

// Poker avatar icons
const avatarIcons = {
    default: "bi-person-fill",
    ace: "bi-suit-spade-fill",
    queen: "bi-suit-heart-fill",
    king: "bi-suit-diamond-fill",
    jack: "bi-suit-club-fill",
    joker: "bi-dice-5-fill"
};

function initializePresence() {
    if (presenceSocket || typeof io !== "function") return;

    presenceSocket = io({
        withCredentials: true
    });

    // Refresh statuses after connecting or reconnecting
    presenceSocket.on("connect", () => {
        loadFriendsData();
    });

    // Update friends' statuses when they connect/disconnect
    presenceSocket.on("PRESENCE_UPDATED", ({ username, online }) => {
        updateFriendStatus(username, online);
    });
}

function updateFriendStatus(username, online) {
    const friendsContainer = document.getElementById("friendListContainer");
    if (!friendsContainer) return;

    const friendRows = friendsContainer.querySelectorAll("[data-friend-username]");

    friendRows.forEach((row) => {
        if (row.dataset.friendUsername !== username) return;

        const indicator = row.querySelector(".friend-indicator");
        const badge = row.querySelector(".friend-status");

        if (indicator) {
            indicator.className = online
                ? "bi bi-circle-fill text-success small me-2 friend-indicator"
                : "bi bi-circle-fill text-secondary small me-2 friend-indicator";
        }

        if (badge) {
            badge.className = online
                ? "badge bg-success text-white friend-status"
                : "badge bg-secondary text-white friend-status";

            badge.textContent = online ? "Online" : "Offline";
        }
    });
}

document.addEventListener("DOMContentLoaded", async function () {
    setupLogoutHandler();

    const activeUsername = await initializeDashboardSession();
    if (!activeUsername) {
        return;
    }

    currentLoggedInUser = activeUsername;

    initializePresence();

    await Promise.all([
        loadDashboardAchievements(activeUsername),
        loadFriendsData(),
        loadUserMessages()
    ]);

    setupFriendSearchHandler();
    setupReportPlayerHandlers();
    setupCreateTableHandler();
    setupFriendChatHandlers();
    setupAvatarHandler();
});

// ============================================================================
// Session & Logout
// ============================================================================

function setupLogoutHandler() {
    const logoutLink = document.getElementById("logout-link");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", () => {
        localStorage.clear();
        sessionStorage.clear();
        if (presenceSocket) {
            presenceSocket.disconnect();
        }
        if (typeof socket !== "undefined" && socket && typeof socket.disconnect === "function") {
            socket.disconnect();
        }
    });
}

async function initializeDashboardSession() {
    try {
        const response = await fetch("/loggeduser", { cache: "no-store" });
        if (!response.ok) {
            window.location.replace("login.html");
            return null;
        }

        const user = await response.json();
        if (!user) {
            window.location.replace("login.html");
            return null;
        }

        sessionStorage.removeItem("identityMode");
        sessionStorage.removeItem("guestPlayerId");
        localStorage.removeItem("guestPlayerId");

        const resolvedName = user.username || (user.email ? user.email.split("@")[0] : "");
        if (!resolvedName) {
            window.location.replace("login.html");
            return null;
        }

        const usernameDisplay = document.getElementById("dashboardUsername");
        const pointsDisplay = document.getElementById("dashboardPoints");

        if (usernameDisplay) {
            usernameDisplay.textContent = resolvedName;
        }
        if (pointsDisplay) {
            const pointsValue = user.points !== undefined ? user.points : 1000;
            renderPointsBalance(pointsDisplay, pointsValue);
        }

        // Load saved avatar from session
        currentAvatar = user.avatar || "default";
        selectedAvatar = currentAvatar;

        updateDashboardAvatar();

        document.body.style.visibility = "visible";
        return resolvedName;
    } catch (err) {
        console.error("Failed to load user session info:", err);
        window.location.replace("login.html");
        return null;
    }
}

function renderPointsBalance(container, pointsValue) {
    container.textContent = "";
    const icon = document.createElement("i");
    icon.className = "bi bi-coin me-1";
    container.append(icon, document.createTextNode(Number(pointsValue).toLocaleString()));
}

// ============================================================================
// Achievements & Badges
// ============================================================================

async function loadDashboardAchievements(playerId) {
    const badgesContainer = document.getElementById("dashboardEarnedBadges");
    const countBadge = document.getElementById("dashboardBadgeCount");
    const progressGrid = document.getElementById("dashboardAchievementsProgressGrid");
    const overallBadge = document.getElementById("dashboardAchievementOverall");

    try {
        const res = await fetch(`/api/achievements/${encodeURIComponent(playerId)}`);
        if (!res.ok) {
            throw new Error("Failed to load achievements.");
        }

        const data = await res.json();
        const allAchievements = Array.isArray(data.achievements) ? data.achievements : [];
        const earned = Array.isArray(data.completedAchievements) ? data.completedAchievements : [];

        if (countBadge) {
            countBadge.textContent = `${earned.length} Badge${earned.length === 1 ? "" : "s"} Earned`;
        }
        if (overallBadge) {
            const total = data.totalCount || allAchievements.length;
            const completed = data.completedCount !== undefined ? data.completedCount : earned.length;
            overallBadge.textContent = `${completed} / ${total} Completed`;
        }

        renderEarnedBadges(badgesContainer, earned);
        renderAchievementProgressGrid(progressGrid, allAchievements);
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

function createBadgeGraphic(theme, iconClass, extraClasses = "") {
    const badge = document.createElement("div");
    badge.className = `achievement-badge-graphic ${theme || "badge-gold"} ${extraClasses}`.trim();

    const icon = document.createElement("i");
    icon.className = `bi ${iconClass || "bi-award-fill"}`;
    badge.appendChild(icon);

    return badge;
}

function renderEarnedBadges(container, earned) {
    if (!container) return;
    container.textContent = "";

    if (earned.length === 0) {
        const emptyMsg = document.createElement("span");
        emptyMsg.className = "small text-white opacity-75 fst-italic";
        emptyMsg.textContent = "No badges earned yet. Play hands in the Poker Lobby to unlock achievements!";
        container.appendChild(emptyMsg);
        return;
    }

    earned.forEach((ach) => {
        const pill = document.createElement("div");
        pill.className = "earned-badge-pill";
        pill.title = `${ach.name}: ${ach.shortDesc}`;

        const textWrap = document.createElement("div");

        const titleEl = document.createElement("div");
        titleEl.className = "fw-bold small text-white";
        titleEl.textContent = ach.name;

        const descEl = document.createElement("div");
        descEl.className = "text-warning";
        descEl.style.fontSize = "0.72rem";
        descEl.textContent = ach.shortDesc;

        textWrap.append(titleEl, descEl);
        pill.append(createBadgeGraphic(ach.theme, ach.icon), textWrap);
        container.appendChild(pill);
    });
}

function renderAchievementProgressGrid(container, achievements) {
    if (!container) return;
    container.textContent = "";

    achievements.forEach((ach) => {
        const pct = Math.max(0, Math.min(100, Number(ach.percent) || (ach.completed ? 100 : 0)));
        const barClass = ach.completed ? "bg-success" : "bg-info";
        const cardClass = ach.completed ? "achievement-completed" : "achievement-locked";
        const badgeLockClass = ach.completed ? "" : "locked-badge";

        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4";

        const card = document.createElement("div");
        card.className = `achievement-card ${cardClass} d-flex flex-column justify-content-between`;

        const topRow = document.createElement("div");
        topRow.className = "d-flex align-items-start gap-3 mb-2";

        const body = document.createElement("div");
        body.className = "flex-grow-1";

        const headerRow = document.createElement("div");
        headerRow.className = "d-flex justify-content-between align-items-center gap-2 mb-1";

        const nameEl = document.createElement("h6");
        nameEl.className = "fw-bold text-white mb-0";
        nameEl.textContent = ach.name;

        const statusPill = document.createElement("span");
        if (ach.completed) {
            statusPill.className = "badge bg-success";
            statusPill.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>`;
            statusPill.appendChild(document.createTextNode("Completed"));
        } else {
            statusPill.className = "badge bg-secondary";
            statusPill.textContent = `${pct}%`;
        }

        headerRow.append(nameEl, statusPill);

        const descEl = document.createElement("p");
        descEl.className = "small text-white opacity-75 mb-1";
        descEl.textContent = ach.shortDesc;

        const criteriaEl = document.createElement("div");
        criteriaEl.className = "small text-secondary";
        criteriaEl.textContent = ach.criteria || "";

        body.append(headerRow, descEl, criteriaEl);
        topRow.append(createBadgeGraphic(ach.theme, ach.icon, badgeLockClass), body);

        const progressWrap = document.createElement("div");
        progressWrap.className = "pt-2";

        const progressMeta = document.createElement("div");
        progressMeta.className = "d-flex justify-content-between align-items-center small mb-1";

        const progressLabel = document.createElement("span");
        progressLabel.className = "text-warning fw-semibold";
        progressLabel.textContent = ach.progressText || "";

        const pctLabel = document.createElement("span");
        pctLabel.className = "text-info fw-semibold";
        pctLabel.textContent = `${pct}%`;

        progressMeta.append(progressLabel, pctLabel);

        const progressBarOuter = document.createElement("div");
        progressBarOuter.className = "progress achievement-progress-bar";
        progressBarOuter.setAttribute("role", "progressbar");
        progressBarOuter.setAttribute("aria-valuenow", String(pct));
        progressBarOuter.setAttribute("aria-valuemin", "0");
        progressBarOuter.setAttribute("aria-valuemax", "100");

        const progressBarInner = document.createElement("div");
        progressBarInner.className = `progress-bar ${barClass}`;
        progressBarInner.style.width = `${pct}%`;

        progressBarOuter.appendChild(progressBarInner);
        progressWrap.append(progressMeta, progressBarOuter);
        card.append(topRow, progressWrap);
        col.appendChild(card);
        container.appendChild(col);
    });
}

// ============================================================================
// Friends & Friend Requests
// ============================================================================

async function loadFriendsData() {
    const pendingContainer = document.getElementById("pendingRequestsList");
    const friendsContainer = document.getElementById("friendListContainer");

    try {
        const response = await fetch("/api/friends/data", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        const unreadCounts = data.unreadCounts || {};
        const onlineStatus = data.onlineStatus || {};

        renderPendingRequests(pendingContainer, data.friendRequests || []);
        renderFriendsList(friendsContainer, data.friends || [], unreadCounts, onlineStatus);
    } catch (err) {
        console.error("Failed to load friends data:", err);
    }
}

function renderPendingRequests(container, requests) {
    if (!container) return;
    container.textContent = "";

    if (!requests.length) {
        const empty = document.createElement("div");
        empty.className = "p-2 small text-white opacity-75 fst-italic";
        empty.textContent = "No pending requests.";
        container.appendChild(empty);
        return;
    }

    requests.forEach((requester) => {
        const row = document.createElement("div");
        row.className = "list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3";
        row.style.cssText = "background-color: #165da3 !important;";

        const nameSpan = document.createElement("span");
        nameSpan.className = "fw-semibold text-white";
        nameSpan.innerHTML = `<i class="bi bi-person-fill text-white me-2"></i>`;
        nameSpan.appendChild(document.createTextNode(requester));

        const btnGroup = document.createElement("div");
        btnGroup.className = "btn-group";

        btnGroup.append(
            createFriendRequestActionForm("/friends/accept", "requester", requester, "btn-outline-success", "bi-check-lg", "Accept"),
            createFriendRequestActionForm("/friends/decline", "requester", requester, "btn-outline-danger", "bi-x-lg", "Decline")
        );

        row.append(nameSpan, btnGroup);
        container.appendChild(row);
    });
}

function createFriendRequestActionForm(actionUrl, fieldName, value, btnClass, iconClass, title) {
    const form = document.createElement("form");
    form.action = actionUrl;
    form.method = "POST";
    form.className = "m-0";
    if (actionUrl === "/friends/accept") {
        form.classList.add("me-1");
    }

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = fieldName;
    hidden.value = value;

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = `btn btn-sm ${btnClass} shadow-none`;
    btn.title = title;
    btn.innerHTML = `<i class="bi ${iconClass}"></i>`;

    form.append(hidden, btn);
    return form;
}

function renderFriendsList(container, friends, unreadCounts, onlineStatus = {}) {
    if (!container) return;
    container.textContent = "";

    if (!friends.length) {
        const empty = document.createElement("div");
        empty.className = "p-2 small text-white opacity-75 fst-italic";
        empty.textContent = "No friends added yet.";
        container.appendChild(empty);
        return;
    }

    friends.forEach((friend) => {
        const friendName = typeof friend === "string"
            ? friend
            : (friend.username || friend.name || String(friend));
        const unreadCount = Number(unreadCounts[friendName] || 0);
        const isOnline = onlineStatus[friendName] === true;

        const row = document.createElement("div");
        row.className = "list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3";
        row.style.cssText = "background-color: #165da3 !important;";
        row.dataset.friendUsername = friendName;

        const nameSpan = document.createElement("span");
        nameSpan.className = "fw-semibold text-white";
        nameSpan.innerHTML = `<i class="bi bi-circle-fill ${isOnline ? "text-success" : "text-secondary"} small me-2 friend-indicator"></i>`;
        nameSpan.appendChild(document.createTextNode(friendName));

        const rightGroup = document.createElement("div");
        rightGroup.className = "d-flex align-items-center gap-2";

        const statusBadge = document.createElement("span");
        statusBadge.className = isOnline
            ? "badge bg-success text-white friend-status"
            : "badge bg-secondary text-white friend-status";
        statusBadge.textContent = isOnline ? "Online" : "Offline";

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

        rightGroup.append(statusBadge, chatBtn);
        row.append(nameSpan, rightGroup);
        container.appendChild(row);
    });
}

function setupFriendSearchHandler() {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("userSearchInput");
    const searchResults = document.getElementById("searchResults");

    if (!searchBtn || !searchInput || !searchResults) return;

    searchBtn.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            const users = await response.json();

            searchResults.textContent = "";

            if (!Array.isArray(users) || users.length === 0) {
                const empty = document.createElement("div");
                empty.className = "p-2 text-muted small";
                empty.textContent = "No users found.";
                searchResults.appendChild(empty);
                return;
            }

            users.forEach((user) => {
                const displayIdentifier = user.username || (user.email ? user.email.split("@")[0] : user.login);
                if (!displayIdentifier) return;

                const item = document.createElement("div");
                item.className = "list-group-item d-flex justify-content-between align-items-center border-secondary py-2 px-3 rounded mb-1";
                item.style.cssText = "background-color: #1f6ab6 !important;";

                const label = document.createElement("span");
                label.className = "fw-semibold text-white";
                label.innerHTML = `<i class="bi bi-person-fill text-white me-2"></i>`;
                label.appendChild(document.createTextNode(displayIdentifier));

                const form = createFriendRequestActionForm(
                    "/friends/request",
                    "targetUser",
                    displayIdentifier,
                    "btn-outline-light fw-semibold",
                    "",
                    `Send friend request to ${displayIdentifier}`
                );
                form.classList.remove("me-1");
                form.innerHTML = "";

                const hidden = document.createElement("input");
                hidden.type = "hidden";
                hidden.name = "targetUser";
                hidden.value = displayIdentifier;

                const submitBtn = document.createElement("button");
                submitBtn.type = "submit";
                submitBtn.className = "btn btn-sm btn-outline-light fw-semibold shadow-none";
                submitBtn.textContent = "Request Friend";

                form.append(hidden, submitBtn);
                item.append(label, form);
                searchResults.appendChild(item);
            });
        } catch (err) {
            console.error("User search failed:", err);
        }
    });
}

// ============================================================================
// Player Reports
// ============================================================================

function setupReportPlayerHandlers() {
    const reportInput = document.getElementById("reportedUsername");
    const suggestionsBox = document.getElementById("reportUserSuggestions");
    const reportForm = document.getElementById("reportUserForm");

    if (reportInput && suggestionsBox) {
        reportInput.addEventListener("input", async function () {
            const query = this.value.trim();
            suggestionsBox.textContent = "";
            if (query.length < 1) return;

            try {
                const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const users = await response.json();

                if (!Array.isArray(users) || users.length === 0) return;

                users.forEach((user) => {
                    const name = user.username || (user.email ? user.email.split("@")[0] : "");
                    if (!name) return;

                    const item = document.createElement("button");
                    item.type = "button";
                    item.className = "list-group-item list-group-item-action py-1 px-2 text-white border-secondary";
                    item.style.backgroundColor = "#131b2e";
                    item.innerHTML = `<i class="bi bi-person me-2"></i>`;
                    item.appendChild(document.createTextNode(name));

                    item.addEventListener("click", function () {
                        reportInput.value = name;
                        suggestionsBox.textContent = "";
                    });

                    suggestionsBox.appendChild(item);
                });
            } catch (err) {
                console.error("Autocomplete search failed:", err);
            }
        });

        document.addEventListener("click", function (e) {
            if (!reportInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.textContent = "";
            }
        });
    }

    if (reportForm) {
        reportForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const reportedUsername = document.getElementById("reportedUsername")?.value.trim() || "";
            const reason = document.getElementById("reportReason")?.value || "";
            const details = document.getElementById("reportDetails")?.value || "";

            try {
                const response = await fetch("/api/reports", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reportedUsername, reason, details })
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Report successfully submitted to administration.");
                    reportForm.reset();
                    const modalEl = document.getElementById("reportModal");
                    const modalInstance = modalEl && typeof bootstrap !== "undefined"
                        ? bootstrap.Modal.getInstance(modalEl)
                        : null;
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
}

// ============================================================================
// User Notifications / Warnings
// ============================================================================

async function loadUserMessages() {
    const badge = document.getElementById("msgBadge");
    const modalBody = document.getElementById("messagesModalBody");
    if (!badge || !modalBody) return;

    try {
        const response = await fetch("/api/user/messages", { cache: "no-store" });
        if (!response.ok) return;

        const messages = await response.json();
        modalBody.textContent = "";

        if (!Array.isArray(messages) || messages.length === 0) {
            badge.style.display = "none";
            const empty = document.createElement("p");
            empty.className = "text-white opacity-75 text-center fst-italic my-3";
            empty.textContent = "You have no new messages or warnings.";
            modalBody.appendChild(empty);
            return;
        }

        badge.style.display = "inline-block";
        badge.textContent = String(messages.length);

        const accordion = document.createElement("div");
        accordion.className = "accordion accordion-flush";
        accordion.id = "messagesAccordion";

        [...messages].reverse().forEach((msg, index) => {
            const dateStr = msg.date ? new Date(msg.date).toLocaleString() : "";
            const collapseId = `collapseMsg${index}`;
            const headingId = `headingMsg${index}`;

            const item = document.createElement("div");
            item.className = "accordion-item bg-dark border border-secondary mb-2 rounded overflow-hidden";

            const header = document.createElement("h2");
            header.className = "accordion-header";
            header.id = headingId;

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = "accordion-button collapsed bg-dark text-white shadow-none d-flex justify-content-between align-items-center";
            toggleBtn.setAttribute("data-bs-toggle", "collapse");
            toggleBtn.setAttribute("data-bs-target", `#${collapseId}`);
            toggleBtn.setAttribute("aria-expanded", "false");
            toggleBtn.setAttribute("aria-controls", collapseId);

            const senderWrap = document.createElement("span");
            senderWrap.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>`;
            const senderStrong = document.createElement("strong");
            senderStrong.textContent = msg.sender || "Administrator";
            senderWrap.appendChild(senderStrong);

            const dateSmall = document.createElement("small");
            dateSmall.className = "text-white opacity-75 ms-auto me-3";
            dateSmall.textContent = dateStr;

            toggleBtn.append(senderWrap, dateSmall);
            header.appendChild(toggleBtn);

            const collapseDiv = document.createElement("div");
            collapseDiv.id = collapseId;
            collapseDiv.className = "accordion-collapse collapse";
            collapseDiv.setAttribute("aria-labelledby", headingId);
            collapseDiv.setAttribute("data-bs-parent", "#messagesAccordion");

            const bodyDiv = document.createElement("div");
            bodyDiv.className = "accordion-body bg-dark text-white border-top border-secondary p-3";

            const textP = document.createElement("p");
            textP.className = "mb-3";
            textP.textContent = msg.text || "";

            const actionWrap = document.createElement("div");
            actionWrap.className = "text-end";

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "btn btn-outline-danger btn-sm shadow-none";
            delBtn.innerHTML = `<i class="bi bi-trash-fill me-1"></i>`;
            delBtn.appendChild(document.createTextNode("Delete Message"));
            delBtn.addEventListener("click", () => deleteMessage(msg._id));

            actionWrap.appendChild(delBtn);
            bodyDiv.append(textP, actionWrap);
            collapseDiv.appendChild(bodyDiv);
            item.append(header, collapseDiv);
            accordion.appendChild(item);
        });

        modalBody.appendChild(accordion);
    } catch (err) {
        console.error("Error loading user messages:", err);
    }
}

async function deleteMessage(msgId) {
    if (!msgId) return;
    try {
        const response = await fetch(`/api/user/messages/${encodeURIComponent(msgId)}`, {
            method: "DELETE"
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

function parseBlindsInput(blindsString) {
    const parts = blindsString.split("/").map((value) =>
        Number(value.trim().replace("$", ""))
    );
    if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value) || value <= 0)) {
        return null;
    }
    return { smallBlind: parts[0], bigBlind: parts[1] };
}

function setupCreateTableHandler() {
    const createTableForm = document.getElementById("createTableForm");
    if (!createTableForm) return;

    createTableForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const tableName = document.getElementById("newTableName")?.value.trim() || "";
        const blindsRaw = document.getElementById("newTableBlinds")?.value.trim() || "";
        const buyIn = document.getElementById("newTableMinBuyin")?.value;
        const maxPlayers = document.getElementById("newTableMaxPlayers")?.value;
        const visibility = document.getElementById("newTableVisibility")?.value;

        const parsedBlinds = parseBlindsInput(blindsRaw);
        if (!parsedBlinds) {
            alert("Please enter blinds in the format $2 / $4.");
            return;
        }

        const tableData = {
            tableName,
            maxPlayers,
            buyIn,
            smallBlind: parsedBlinds.smallBlind,
            bigBlind: parsedBlinds.bigBlind,
            visibility
        };

        try {
            const response = await fetch("/api/tables/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tableData)
            });

            const result = await response.json();

            if (response.ok) {
                alert("Table created successfully!");
                createTableForm.reset();
                window.location.href = `tableDisplay.html?tableId=${encodeURIComponent(result.tableId)}`;
            } else {
                alert(result.error || "Failed to create table.");
            }
        } catch (err) {
            console.error("Error creating table:", err);
            alert("Network error. Please try again.");
        }
    });
}

// ============================================================================
// Friend Direct Chat
// ============================================================================

function getCurrentUsername() {
    if (currentLoggedInUser) return currentLoggedInUser;
    const domName = document.getElementById("dashboardUsername")?.textContent?.trim();
    return domName && domName !== "Player" ? domName : "";
}

async function fetchFriendMessages(friendUsername) {
    try {
        const res = await fetch(`/api/friends/chat/${encodeURIComponent(friendUsername)}`, {
            cache: "no-store"
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.messages) ? data.messages : [];
    } catch (err) {
        console.error("Failed to fetch friend chat:", err);
        return [];
    }
}

function renderFriendChatMessages(messages) {
    const container = document.getElementById("friendChatMessages");
    if (!container) return;

    const me = getCurrentUsername();
    container.textContent = "";

    if (!messages.length) {
        const empty = document.createElement("p");
        empty.className = "text-white opacity-75 text-center small fst-italic my-auto";
        empty.textContent = "No messages yet. Say hello!";
        container.appendChild(empty);
        return;
    }

    messages.forEach((msg) => {
        const messageId = msg._id || msg.id;
        const isMine = msg.sender === me;
        const isDeleted = Boolean(msg.deleted);

        const bubble = document.createElement("div");
        bubble.className = `p-2 rounded border border-secondary ${isMine ? "ms-auto" : "me-auto"}`;
        bubble.style.maxWidth = "85%";
        bubble.style.backgroundColor = isMine ? "#1d3557" : "#0b132b";

        const header = document.createElement("div");
        header.className = "d-flex justify-content-between align-items-center gap-2 mb-1";

        const senderLabel = document.createElement("strong");
        senderLabel.className = "small text-info";
        senderLabel.textContent = isMine ? `${msg.sender} (You)` : msg.sender;
        header.appendChild(senderLabel);

        const textEl = document.createElement("div");
        textEl.style.wordBreak = "break-word";

        if (isDeleted) {
            textEl.className = "small text-light opacity-50 fst-italic";
            textEl.textContent = "This message was deleted";
            bubble.append(header, textEl);
        } else {
            textEl.className = "small text-white";
            textEl.textContent = msg.text;

            if (isMine && messageId) {
                const controls = document.createElement("div");
                controls.className = "d-flex gap-1";

                const editBtn = document.createElement("button");
                editBtn.type = "button";
                editBtn.className = "btn btn-link btn-sm text-warning p-0 text-decoration-none";
                editBtn.title = "Edit message";
                editBtn.innerHTML = `<i class="bi bi-pencil-square small"></i>`;
                editBtn.addEventListener("click", () => startEditingMessage(messageId, msg.text, bubble, textEl));

                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "btn btn-link btn-sm text-danger p-0 text-decoration-none";
                deleteBtn.title = "Delete message";
                deleteBtn.innerHTML = `<i class="bi bi-trash small"></i>`;
                deleteBtn.addEventListener("click", () => handleDeleteFriendMessage(messageId));

                controls.append(editBtn, deleteBtn);
                header.appendChild(controls);
            }

            bubble.append(header, textEl);

            if (msg.edited) {
                const editedTag = document.createElement("span");
                editedTag.className = "d-block text-light opacity-50 fst-italic";
                editedTag.style.fontSize = "0.7rem";
                editedTag.textContent = "(edited)";
                bubble.appendChild(editedTag);
            }
        }

        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

function startEditingMessage(messageId, currentText, bubble, textEl) {
    if (bubble.querySelector(".edit-message-box")) return;

    const editBox = document.createElement("div");
    editBox.className = "edit-message-box mt-1 d-flex flex-column gap-1";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control form-control-sm midnight-input text-grey border-secondary shadow-none";
    input.value = currentText;
    input.maxLength = 500;

    const actions = document.createElement("div");
    actions.className = "d-flex justify-content-end gap-1";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-outline-light btn-sm py-0 px-2";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
        editBox.remove();
        textEl.style.display = "";
    });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-success btn-sm py-0 px-2";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
        const updatedText = input.value.trim();
        if (!updatedText || updatedText === currentText) {
            editBox.remove();
            textEl.style.display = "";
            return;
        }
        await handleEditFriendMessage(messageId, updatedText);
    });

    actions.append(cancelBtn, saveBtn);
    editBox.append(input, actions);
    textEl.style.display = "none";
    bubble.appendChild(editBox);
    input.focus();
}

async function handleEditFriendMessage(messageId, newText) {
    if (!activeChatFriend) return;
    try {
        const res = await fetch(
            `/api/friends/chat/${encodeURIComponent(activeChatFriend)}/${encodeURIComponent(messageId)}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: newText })
            }
        );
        if (res.ok) {
            const fresh = await fetchFriendMessages(activeChatFriend);
            renderFriendChatMessages(fresh);
        }
    } catch (err) {
        console.error("Failed to edit message:", err);
    }
}

async function handleDeleteFriendMessage(messageId) {
    if (!activeChatFriend) return;
    try {
        const res = await fetch(
            `/api/friends/chat/${encodeURIComponent(activeChatFriend)}/${encodeURIComponent(messageId)}`,
            { method: "DELETE" }
        );
        if (res.ok) {
            const fresh = await fetchFriendMessages(activeChatFriend);
            renderFriendChatMessages(fresh);
        }
    } catch (err) {
        console.error("Failed to delete message:", err);
    }
}

async function openFriendChatModal(friendUsername) {
    activeChatFriend = friendUsername;

    const nameEl = document.getElementById("chatFriendName");
    if (nameEl) nameEl.textContent = friendUsername;

    const modalEl = document.getElementById("friendChatModal");
    if (modalEl && typeof bootstrap !== "undefined") {
        if (!friendChatModalInstance) {
            friendChatModalInstance = new bootstrap.Modal(modalEl);
        }
        friendChatModalInstance.show();
    }

    const messages = await fetchFriendMessages(friendUsername);
    renderFriendChatMessages(messages);
    await loadFriendsData();

    setTimeout(() => {
        const container = document.getElementById("friendChatMessages");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
        document.getElementById("friendChatInput")?.focus();
    }, 150);
}

function setupFriendChatHandlers() {
    const modalEl = document.getElementById("friendChatModal");
    if (modalEl) {
        modalEl.addEventListener("hidden.bs.modal", () => {
            activeChatFriend = null;
        });
    }

    const chatForm = document.getElementById("friendChatForm");
    if (chatForm) {
        chatForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!activeChatFriend) return;

            const input = document.getElementById("friendChatInput");
            const text = input?.value.trim();
            if (!text) return;

            input.value = "";

            try {
                const res = await fetch(`/api/friends/chat/${encodeURIComponent(activeChatFriend)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text })
                });
                if (res.ok) {
                    const fresh = await fetchFriendMessages(activeChatFriend);
                    renderFriendChatMessages(fresh);
                }
            } catch (err) {
                console.error("Failed to send message:", err);
            }
        });
    }

    setInterval(async () => {
        const isEditing = Boolean(document.querySelector("#friendChatMessages .edit-message-box"));

        if (activeChatFriend && !isEditing) {
            const messages = await fetchFriendMessages(activeChatFriend);
            renderFriendChatMessages(messages);
        }

        if (!activeChatFriend) {
            await loadFriendsData();
        }
    }, 3000);
}


// ============================================================================
// Avatar Selection
// ============================================================================

// Display the selected avatar on the dashboard
function updateDashboardAvatar() {
    const avatarDisplay = document.getElementById("dashboardAvatar");
    
    if (!avatarDisplay) return;

    const iconClass = avatarIcons[currentAvatar] || avatarIcons.default;

    avatarDisplay.innerHTML = "";

    const icon = document.createElement("i");
    icon.className = `bi ${iconClass}`;

    avatarDisplay.appendChild(icon);
}


// Retrieve the available presets from the backend
async function loadAvatarPresets() {
    const response = await fetch("/api/avatars");

    if (!response.ok) {
        throw new Error("Could not load avatar presets.");
    }

    const data = await response.json();

    if (!Array.isArray(data.avatars)) {
        throw new Error("Invalid avatar data.");
    }

    availableAvatars = data.avatars;

    updateDashboardAvatar();
    renderAvatarPresets();
}


// Create the avatar selection cards
function renderAvatarPresets() {
    const grid = document.getElementById("avatarPresetGrid");

    if (!grid) return;

    grid.textContent = "";

    availableAvatars.forEach(avatar => {
        const card = document.createElement("button");

        card.type = "button";
        card.className = "avatar-option";

        if (avatar.id === selectedAvatar) {
            card.classList.add("selected");
        }

        card.setAttribute(
            "aria-pressed",
            String(avatar.id === selectedAvatar)
        );

        const icon = document.createElement("i");
        icon.className = `bi ${avatarIcons[avatar.id] || avatarIcons.default}`;

        const name = document.createElement("span");
        name.textContent = avatar.name;

        card.append(icon, name);

        card.addEventListener("click", () => {
            selectedAvatar = avatar.id;
            renderAvatarPresets();

            const message = document.getElementById("avatarMessage");
            if (message) message.textContent = "";
        });

        grid.appendChild(card);
    });
}


// Save the avatar selection to MongoDB
async function saveSelectedAvatar() {
    const saveButton = document.getElementById("saveAvatarBtn");
    const message = document.getElementById("avatarMessage");

    if (saveButton) saveButton.disabled = true;

    try {
        const response = await fetch("/api/user/avatar", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                avatar: selectedAvatar
            })
        });

        if (!response.ok) {
            throw new Error("Failed to save avatar.");
        }

        const data = await response.json();

        currentAvatar = data.avatar;
        selectedAvatar = currentAvatar;

        updateDashboardAvatar();

        if (message) {
            message.className = "small text-success mt-3 mb-0";
            message.textContent = "Avatar updated successfully!";
        }

        const modalElement = document.getElementById("avatarModal");

        if (modalElement) {
            bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        }

    } catch (error) {
        console.error("Avatar update failed:", error);

        if (message) {
            message.className = "small text-danger mt-3 mb-0";
            message.textContent = "Could not save avatar. Please try again.";
        }
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}


// Initialize avatar selection events
function setupAvatarHandler() {
    const modal = document.getElementById("avatarModal");
    const saveButton = document.getElementById("saveAvatarBtn");

    if (!modal || !saveButton) return;

    modal.addEventListener("show.bs.modal", async () => {
        selectedAvatar = currentAvatar;

        const message = document.getElementById("avatarMessage");
        if (message) message.textContent = "";

        const grid = document.getElementById("avatarPresetGrid");

        try {
            if (!availableAvatars.length) {
                await loadAvatarPresets();
            } else {
                renderAvatarPresets();
            }
        } catch (error) {
            console.error("Failed to load avatars:", error);

            if (grid) {
                grid.textContent = "Unable to load avatar presets.";
            }
        }
    });

    saveButton.addEventListener("click", saveSelectedAvatar);
}

/**
 * ============================================================================
 * File Name: index.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend controller script for the User Dashboard homepage. Manages 
 *          dynamic user profile/points loading, user search capabilities, and 
 *          asynchronous friend list/request rendering directly on the dashboard.
 * ============================================================================
 */

// ============================================================================
// DOM Content Loaded Initialization
// ============================================================================
document.addEventListener("DOMContentLoaded", async function() {
    
    // ------------------------------------------------------------------------
    // 1. Fetch & Populate Logged-In User Profile & Points
    // ------------------------------------------------------------------------
    try {
        const response = await fetch('/loggedUser');
        if (response.ok) {
            const user = await response.json();
            if (user) {
                const usernameDisplay = document.getElementById('dashboardUsername');
                const pointsDisplay = document.getElementById('dashboardPoints');

                if (usernameDisplay) {
                    usernameDisplay.textContent = user.username || user.email.split('@')[0];
                }
                if (pointsDisplay) {
                    pointsDisplay.innerHTML = `<i class="bi bi-coin"></i> ${(user.points !== undefined ? user.points : 1000).toLocaleString()}`;
                }
            } else {
                // If no active session, redirect to login
                window.location.href = 'login.html';
            }
        }
    } catch (err) {
        console.error("Failed to load user session info:", err);
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
                // Fetch matching users asynchronously from the backend API
                const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const users = await response.json();

                // Clear out any old search results before rendering new ones
                searchResults.innerHTML = "";
                
                if (!users || users.length === 0) {
                    searchResults.innerHTML = `<div class="p-2 text-muted small">No users found.</div>`;
                    return;
                }

                // Dynamically build and render list items for each matching user
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


// ============================================================================
// Social & Friends List Data Loader
// ============================================================================

/**
 * Asynchronously fetches and renders the user's current friends list and 
 * pending incoming friend requests directly inside the dashboard panels.
 */
async function loadFriendsData() {
    const pendingContainer = document.getElementById("pendingRequestsList");
    const friendsContainer = document.getElementById("friendListContainer");

    try {
        const response = await fetch('/api/friends/data');
        if (!response.ok) return;
        const data = await response.json();

        // 1. Render Pending Friend Requests
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
                                <!-- Accept Request Form -->
                                <form action="/friends/accept" method="POST" class="m-0 me-1">
                                    <input type="hidden" name="requester" value="${requester}">
                                    <button type="submit" class="btn btn-sm btn-outline-success shadow-none" title="Accept"><i class="bi bi-check-lg"></i></button>
                                </form>
                                <!-- Decline Request Form -->
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

        // 2. Render Active Friends List
        if (friendsContainer) {
            friendsContainer.innerHTML = "";
            if (!data.friends || data.friends.length === 0) {
                friendsContainer.innerHTML = `<div class="p-2 small text-white opacity-75 fst-italic">No friends added yet.</div>`;
            } else {
                data.friends.forEach(friend => {
                    friendsContainer.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3" style="background-color: #165da3 !important;">
                            <span class="fw-semibold text-white">
                                <i class="bi bi-circle-fill text-success small me-2"></i>${friend}
                            </span>
                            <span class="badge bg-success text-white">Online</span>
                        </div>
                    `;
                });
            }
        }
    } catch (err) {
        console.error("Failed to load friends data:", err);
    }
}


// ============================================================================
// Report Player Modal & Autocomplete Logic
// ============================================================================
document.addEventListener("DOMContentLoaded", function() {
    const reportInput = document.getElementById("reportedUsername");
    const suggestionsBox = document.getElementById("reportUserSuggestions");
    const reportForm = document.getElementById("reportUserForm");

    // 1. Live Username Autocomplete Lookup
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

        // Hide suggestions when clicking outside
        document.addEventListener("click", function(e) {
            if (!reportInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.innerHTML = "";
            }
        });
    }

    // 2. Asynchronous Form Submission
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


// ============================================================================
// User Dashboard - Administrative Messages & Warning Notifications
// ============================================================================

/**
 * Initializes message fetching when the DOM loads.
 */
document.addEventListener("DOMContentLoaded", async function() {
    await loadUserMessages();
});

/**
 * Asynchronously fetches user messages/warnings from the server API 
 * and populates the notification badge and expandable message items.
 */
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
            // Use Bootstrap Accordion for collapsible behavior
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

/**
 * Sends a request to delete a specific message by ID and refreshes the inbox.
 * @param {string} msgId The unique ID of the message
 */
async function deleteMessage(msgId) {
    try {
        const response = await fetch(`/api/user/messages/${msgId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadUserMessages(); // Refresh list & badge count
        } else {
            console.error("Failed to delete message");
        }
    } catch (err) {
        console.error("Error deleting message:", err);
    }
}
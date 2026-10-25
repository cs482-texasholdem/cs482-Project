/**
 * ============================================================================
 * File Name: index.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend controller script for the Poker Lobby homepage. Manages 
 *          Bootstrap offcanvas sidebar components and dynamic table join 
 *          interactions, user search capabilities, and asynchronous social 
 *          friend list/request rendering.
 * ============================================================================
 */

let joinSidebar;

// ============================================================================
// DOM Content Loaded Initialization
// ============================================================================
document.addEventListener("DOMContentLoaded", function() {
    
    // ------------------------------------------------------------------------
    // 1. Table Seating & Lobby Offcanvas Initialization
    // ------------------------------------------------------------------------
    const sidebarElement = document.getElementById('joinGameSidebar');
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
    }

    // ------------------------------------------------------------------------
    // 2. Friends Sidebar Auto-Load Event Listener
    // ------------------------------------------------------------------------
    const friendsSidebarEl = document.getElementById('friendsSidebar');
    if (friendsSidebarEl) {
        // Automatically fetch and render friends data when the sidebar slides open
        friendsSidebarEl.addEventListener('show.bs.offcanvas', loadFriendsData);
    }

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
                    // Fallback to login if username is unpopulated
                    const displayIdentifier = user.username || user.login;
                    searchResults.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center border-secondary py-2 px-3 rounded" style="background-color: #1f6ab6 !important;">
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
// Table Seating Sidebar Controller
// ============================================================================

/**
 * Populates and opens the slide-out table join sidebar when a user clicks 
 * "Join Table" on any lobby card. Parses numeric buy-in thresholds.
 * 
 * @param {string} tableName - The name or identifier of the poker table
 * @param {string} blinds - The small/big blind stakes string (e.g., "$10/$20")
 * @param {string} minBuyin - The minimum chip buy-in requirement string
 */
function openJoinSidebar(tableName, blinds, minBuyin) {
    document.getElementById('sidebarTableName').value = tableName;
    document.getElementById('sidebarTableBlinds').value = blinds;
    document.getElementById('sidebarTableMinBuyin').value = minBuyin;
    
    // Extract numeric value from minBuyin string (e.g., "$2,500" -> 2500) for the input default
    let numericBuyin = parseInt(minBuyin.replace(/[^0-9]/g, '')) || 1000;
    document.getElementById('buyInAmount').value = numericBuyin;
    document.getElementById('buyInAmount').min = numericBuyin;

    // Slide open the sidebar popup from the right
    if (joinSidebar) {
        joinSidebar.show();
    }
}


// ============================================================================
// Social & Friends List Data Loader
// ============================================================================

/**
 * Asynchronously fetches and renders the user's current friends list and 
 * pending incoming friend requests inside the friends pop-up sidebar with 
 * theme-consistent styling.
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
                pendingContainer.innerHTML = `<div class="p-2 small text-light">No pending friend requests.</div>`;
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
                friendsContainer.innerHTML = `<div class="p-2 small text-light">No friends added yet.</div>`;
            } else {
                data.friends.forEach(friend => {
                    friendsContainer.innerHTML += `
                        <div class="list-group-item d-flex justify-content-between align-items-center border-secondary mb-1 rounded py-2 px-3" style="background-color: #165da3 !important;">
                            <span class="fw-semibold text-white">
                                <i class="bi bi-circle-fill text-success small me-2"></i>${friend}
                            </span>
                            <span class="badge bg-success text-light">Online</span>
                        </div>
                    `;
                });
            }
        }
    } catch (err) {
        console.error("Failed to load friends data:", err);
    }
}
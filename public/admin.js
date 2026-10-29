/**
 * ============================================================================
 * File Name: admin.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend controller script for the Admin Dashboard. Manages secure 
 *          user record fetching, role-based access control validation, 
 *          dynamic table rendering, user modification interactions via 
 *          Bootstrap modals, and game history loading.
 * ============================================================================
 */
let editModal;

// Initialize the dashboard components once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async function() {
    // Instantiate the Bootstrap modal used for editing user accounts
    editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    // Fetch and render the initial list of users and game history
    await loadUsers();
    await loadGameHistory();
});


/**
 * Asynchronously fetches all system user records from the server API 
 * and populates the management table. Enforces security checks and handles 
 * unauthorized (403 Forbidden) access attempts.
 */
async function loadUsers() {
    try {
        const response = await fetch('/user');
        
        // Validate response status and handle administrative security constraints
        if (!response.ok) {
            if (response.status === 403) {
                alert("Access Denied: You must be an administrator to view this page.");
                window.location.href = 'index.html';
                return;
            }
            throw new Error("Failed to fetch user records.");
        }

        const users = await response.json();
        const tableBody = document.getElementById("userTableBody");
        tableBody.innerHTML = "";

        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No users found.</td></tr>`;
            return;
        }

        users.forEach(user => {
            let roleBadge = user.permission === 1 
                ? '<span class="badge bg-danger">ADMIN</span>' 
                : '<span class="badge bg-secondary">PLAYER</span>';

            let usernameDisplay = user.username || (user.login && !user.login.includes('@') ? user.login : 'N/A');
            let emailDisplay = user.email || (user.login && user.login.includes('@') ? user.login : 'N/A');

            let row = `
                <tr>
                    <td class="ps-4 fw-semibold">${usernameDisplay}</td>
                    <td>${emailDisplay}</td>
                    <td>${roleBadge}</td>
                    <td>${user.points}</td>
                    <td><span class="badge bg-success">Active</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1" title="Edit Info" onclick='openEditModal(${JSON.stringify(user)})'><i class="bi bi-pencil"></i></button>
                        <a href="/deluser/${user._id}" class="btn btn-sm btn-outline-danger" title="Disable Account" onclick="return confirm('Are you sure you want to delete this user?');"><i class="bi bi-ban"></i></a>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading admin dashboard user data:", error);
    }
}


/**
 * Asynchronously fetches completed game session records and populates 
 * the read-only game history table.
 */
async function loadGameHistory() {
    try {
        const response = await fetch('/api/games');
        if (!response.ok) {
            throw new Error("Failed to fetch game history records.");
        }

        const games = await response.json();
        const tableBody = document.getElementById("gameTableBody");
        tableBody.innerHTML = "";

        if (!games || games.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No recorded game history found.</td></tr>`;
            return;
        }

        games.forEach(game => {
            const dateStr = game.timestamp ? new Date(game.timestamp).toLocaleString() : 'N/A';
            const playerCount = game.initialPlayers ? game.initialPlayers.length : 0;
            const winnersList = game.winners && game.winners.length > 0 ? game.winners.join(', ') : 'None / Folded';
            const actionCount = game.actions ? game.actions.length : 0;

            let row = `
                <tr>
                    <td class="ps-4 text-muted small">${game._id}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge bg-info text-dark">${game.tableId || 'main'}</span></td>
                    <td>${playerCount} Players</td>
                    <td><strong>${winnersList}</strong> (${game.potFinal || 0} Chips)</td>
                    <td class="text-end pe-4">
                        <span class="text-muted small me-2">${actionCount} Actions</span>
                        <a href="reviewGame.html?id=${game._id}" class="btn btn-sm btn-outline-warning" title="Review Game Reconstruction">
                            <i class="bi bi-eye"></i> Review
                        </a>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading admin dashboard game history:", error);
        const tableBody = document.getElementById("gameTableBody");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load game history.</td></tr>`;
        }
    }
}


/**
 * Populates the edit modal form fields with the selected user's account data 
 * and displays the modal dialog to the administrator.
 * 
 * @param {Object} user The target user object containing metadata
 */
function openEditModal(user) {
    document.getElementById('txt_id').value = user._id;
    document.getElementById('txt_login').value = user.username || (user.login && !user.login.includes('@') ? user.login : '');
    document.getElementById('txt_email').value = user.email || (user.login && user.login.includes('@') ? user.login : '');
    document.getElementById('txt_perm').value = user.permission || 2;
    document.getElementById('txt_points').value = user.points || user.chips || 1000;
    document.getElementById('txt_pass').value = ''; // Reset password field
    editModal.show();
}
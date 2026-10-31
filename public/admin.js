/**
 * ============================================================================
 * File Name: admin.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend controller script for the Admin Dashboard. Manages secure 
 *          user record fetching, role-based access control validation, 
 *          dynamic table rendering, user modification interactions via 
 *          Bootstrap modals, player reports moderation, warning management, 
 *          and game history loading.
 * ============================================================================
 */
let editModal;
let viewReportModal;
let currentReportData = null;

// Initialize the dashboard components once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async function() {
    // Instantiate Bootstrap modals
    editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    viewReportModal = new bootstrap.Modal(document.getElementById('viewReportModal'));
    
    // Fetch and render users, player reports, and game history concurrently
    await Promise.all([
        loadUsers(),
        loadReports(),
        loadGameHistory()
    ]);
});


/**
 * Asynchronously fetches all system user records from the server API 
 * and populates the management table. Enforces security checks and handles 
 * unauthorized (403 Forbidden) access attempts.
 */
async function loadUsers() {
    try {
        const response = await fetch('/user');
        
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
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-white opacity-75">No users found.</td></tr>`;
            return;
        }

        users.forEach(user => {
            let roleBadge = user.permission === 1 
                ? '<span class="badge bg-danger">ADMIN</span>' 
                : '<span class="badge bg-secondary">PLAYER</span>';

            const warningCount = user.warnings || 0;
            let warningBadge = warningCount > 0 
                ? `<span class="badge bg-warning text-dark fw-bold">${warningCount} Warning(s)</span>` 
                : `<span class="text-white opacity-50">0</span>`;

            let usernameDisplay = user.username || (user.login && !user.login.includes('@') ? user.login : 'N/A');
            let emailDisplay = user.email || (user.login && user.login.includes('@') ? user.login : 'N/A');

            let row = `
                <tr>
                    <td class="ps-4 fw-semibold text-white">${usernameDisplay}</td>
                    <td class="text-white opacity-90">${emailDisplay}</td>
                    <td>${roleBadge}</td>
                    <td class="text-white">${user.points || user.chips || 0}</td>
                    <td>${warningBadge}</td>
                    <td><span class="badge bg-success">Active</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1 shadow-none" title="Edit Info" onclick='openEditModal(${JSON.stringify(user)})'><i class="bi bi-pencil"></i></button>
                        <a href="/deluser/${user._id}" class="btn btn-sm btn-outline-danger shadow-none" title="Disable Account" onclick="return confirm('Are you sure you want to delete this user?');"><i class="bi bi-ban"></i></a>
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
 * Asynchronously fetches player infraction reports and populates the report table,
 * sorting unresolved reports to the top and resolved reports to the bottom.
 */
async function loadReports() {
    try {
        const response = await fetch('/api/reports');
        if (!response.ok) {
            throw new Error("Failed to fetch player reports.");
        }

        const reports = await response.json();
        const tableBody = document.getElementById("reportTableBody");
        tableBody.innerHTML = "";

        if (!reports || reports.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-white opacity-75 fst-italic">No player reports recorded yet.</td></tr>`;
            return;
        }

        reports.forEach(report => {
            const dateStr = report.createdAt ? new Date(report.createdAt).toLocaleString() : 'N/A';
            const isResolved = report.resolved;

            let statusBadge = isResolved 
                ? '<span class="badge bg-secondary">Resolved</span>' 
                : '<span class="badge bg-danger">Pending</span>';

            let rowStyle = isResolved ? 'opacity: 0.55;' : '';

            let row = `
                <tr style="${rowStyle}">
                    <td class="ps-4 fw-semibold text-white">${report.reporterUsername}</td>
                    <td class="text-warning fw-semibold">${report.reportedUsername}</td>
                    <td><span class="badge bg-dark text-capitalize border border-secondary">${report.reason}</span></td>
                    <td>${statusBadge}</td>
                    <td class="small text-white opacity-75">${dateStr}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-warning shadow-none" title="View Report Details" onclick='openViewReportModal(${JSON.stringify(report)})'>
                            <i class="bi bi-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error loading player reports:", error);
        const tableBody = document.getElementById("reportTableBody");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load reports.</td></tr>`;
        }
    }
}


/**
 * Opens the view report modal and populates fields with report metadata.
 */
function openViewReportModal(report) {
    currentReportData = report;
    document.getElementById('modalReportId').value = report._id;
    document.getElementById('modalReporter').value = report.reporterUsername;
    document.getElementById('modalOffendingUser').value = report.reportedUsername;
    document.getElementById('modalReason').value = report.reason;
    document.getElementById('modalDetails').value = report.details || "No additional details provided.";
    document.getElementById('adminWarningMsg').value = "";
    viewReportModal.show();
}


/**
 * Marks a report as resolved via backend API and refreshes the table.
 */
async function markReportResolvedFromModal() {
    if (!currentReportData) return;
    try {
        const response = await fetch(`/api/reports/${currentReportData._id}/resolve`, { method: 'PATCH' });
        if (response.ok) {
            viewReportModal.hide();
            await loadReports();
        } else {
            alert("Failed to resolve report.");
        }
    } catch (err) {
        console.error("Error resolving report:", err);
        alert("Network error while resolving report.");
    }
}


/**
 * Issues a warning to the offending user, resolves the report, and prompts 
 * the admin for account deletion if warnings reach 3 or more.
 */
async function sendWarningFromModal() {
    if (!currentReportData) return;
    const warningMessage = document.getElementById('adminWarningMsg').value;

    try {
        const response = await fetch('/api/reports/warn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reportId: currentReportData._id,
                username: currentReportData.reportedUsername,
                warningMessage: warningMessage
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            viewReportModal.hide();
            await loadReports();
            await loadUsers(); // Refresh user table to update warning badges

            // If user has 3 or more warnings, prompt admin to delete account
            if (result.warnings >= 3) {
                if (confirm(`Player '${currentReportData.reportedUsername}' has accumulated ${result.warnings} warnings (>= 3). Would you like to delete their account now?`)) {
                    const userResponse = await fetch('/user');
                    const users = await userResponse.json();
                    const targetUser = users.find(u => u.username === currentReportData.reportedUsername || u.email?.startsWith(currentReportData.reportedUsername));
                    if (targetUser) {
                        window.location.href = `/deluser/${targetUser._id}`;
                    } else {
                        alert("Could not locate user ID for automatic deletion.");
                    }
                }
            }
        } else {
            alert(result.error || "Failed to issue warning.");
        }
    } catch (err) {
        console.error("Error issuing warning:", err);
        alert("Network error while issuing warning.");
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
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-white opacity-75 fst-italic">No recorded game history found.</td></tr>`;
            return;
        }

        games.forEach(game => {
            const dateStr = game.timestamp ? new Date(game.timestamp).toLocaleString() : 'N/A';
            const playerCount = game.initialPlayers ? game.initialPlayers.length : 0;
            const winnersList = game.winners && game.winners.length > 0 ? game.winners.join(', ') : 'None / Folded';
            const actionCount = game.actions ? game.actions.length : 0;

            let row = `
                <tr>
                    <td class="ps-4 text-white opacity-50 small">${game._id}</td>
                    <td class="text-white opacity-90">${dateStr}</td>
                    <td><span class="badge bg-info text-dark">${game.tableId || 'main'}</span></td>
                    <td class="text-white">${playerCount} Players</td>
                    <td class="text-white"><strong class="text-warning">${winnersList}</strong> (${game.potFinal || 0} Chips)</td>
                    <td class="text-end pe-4">
                        <span class="text-white opacity-75 small me-2">${actionCount} Actions</span>
                        <a href="reviewGame.html?id=${game._id}" class="btn btn-sm btn-outline-warning shadow-none" title="Review Game Reconstruction">
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
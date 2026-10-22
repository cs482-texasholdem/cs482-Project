// ==========================================
// Admin Dashboard Script (admin.js)
// ==========================================

let editModal;

document.addEventListener("DOMContentLoaded", async function() {
    editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    await loadUsers();
});

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
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No users found.</td></tr>`;
            return;
        }

        users.forEach(user => {
            let roleBadge = user.permission === 1 
                ? '<span class="badge bg-danger">ADMIN</span>' 
                : '<span class="badge bg-secondary">PLAYER</span>';

            let row = `
                <tr>
                    <td class="ps-4 fw-semibold">${user.login || user.txt_login || 'N/A'}</td>
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
        console.error("Error loading admin dashboard data:", error);
    }
}

function openEditModal(user) {
    document.getElementById('txt_id').value = user._id;
    document.getElementById('txt_login').value = user.login || user.txt_login || '';
    document.getElementById('txt_perm').value = user.permission || 2;
    document.getElementById('txt_points').value = user.points || user.chips || 10000;
    document.getElementById('txt_pass').value = ''; // Reset password field
    editModal.show();
}
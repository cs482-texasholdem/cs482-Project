/**
 * ============================================================================
 * File Name: signup.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend validation script for the User Registration page. Intercepts 
 *          form submissions to ensure password and password confirmation fields 
 *          match, dynamically displaying Bootstrap warning alerts if a mismatch 
 *          occurs.
 * ============================================================================
 */

// Execute once the DOM is fully loaded to bind form validation event listeners
document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('signupForm');
    const pass = document.getElementById('txt_pass');
    const confirmPass = document.getElementById('txt_pass_confirm');
    const msgDisplay = document.getElementById('msg-display');
    const pointsInput = document.getElementById('txt_points');
    const params = new URLSearchParams(window.location.search);
    const guestPlayerId = params.get('playerId') || sessionStorage.getItem('guestPlayerId');
    const tableId = params.get('tableId') || 'main';
    const urlPoints = Number(params.get('points'));

    // Keep a fallback copy of the guest's points in sessionStorage in case the page refreshes
    if (params.has('points') && Number.isFinite(urlPoints) && urlPoints >= 0) {
        sessionStorage.setItem('pendingGuestPoints', String(Math.floor(urlPoints)));
    }
    const storedPoints = Number(sessionStorage.getItem('pendingGuestPoints'));

    // Helper to display a confirmation banner showing how many guest points will be saved
    const applyGuestPoints = (pts) => {
        if (pointsInput && Number.isFinite(pts) && pts >= 0) {
            pointsInput.value = Math.floor(pts);
        }
        if (guestPlayerId && msgDisplay) {
            msgDisplay.innerHTML = `
                <div class="alert alert-info mt-3 mb-0">
                    <i class="bi bi-coin me-1"></i>
                    Creating an account will save <strong>${Number(pointsInput.value).toLocaleString()} points</strong> from your guest session (${guestPlayerId}).
                </div>
            `;
        }
    };

    // Use points passed in the URL if valid, or query the server for the guest's live table chips
    if (Number.isFinite(urlPoints) && urlPoints >= 0 && params.has('points')) {
        applyGuestPoints(urlPoints);
    } else if (guestPlayerId) {
        fetch(`/api/guest/points?playerId=${encodeURIComponent(guestPlayerId)}&tableId=${encodeURIComponent(tableId)}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && typeof data.points === 'number') {
                    applyGuestPoints(data.points);
                }
            })
            .catch(err => console.error('Failed to fetch guest points:', err));
    }

    // Attach submit event listener if the registration form exists on the page
    if (form) {
        // Verify that password and confirmation fields match prior to submission
        form.addEventListener('submit', function(e) {
            if (pass.value !== confirmPass.value) {
                e.preventDefault(); // Stop form submission
                // Render a dismissible Bootstrap warning alert for the user
                msgDisplay.innerHTML = `
                    <div class="alert alert-warning alert-dismissible fade show mt-3 mb-0">
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        <strong>Notice!</strong> Passwords do not match.
                    </div>
                `;
            } else {
                // Ensure txt_points has the latest guest balance right before form submission
                if (pointsInput && (!pointsInput.value || pointsInput.value === "1000") && Number.isFinite(storedPoints)) {
                    pointsInput.value = Math.floor(storedPoints);
                }

                // Clear guest session markers so the newly registered user enters their unlocked dashboard
                sessionStorage.removeItem('identityMode');
                sessionStorage.removeItem('guestPlayerId');
                sessionStorage.removeItem('pendingGuestPoints');
                localStorage.removeItem('guestPlayerId');
            }
        });
    }
});
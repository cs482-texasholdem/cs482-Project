/**
 * ============================================================================
 * File Name: login.js
 * Author: Bonita Rodrigues, Gigi Li
 * Purpose: Frontend controller script for the Login page. Handles URL query 
 *          parameter parsing to detect authentication failures and dynamically 
 *          renders Bootstrap error alert notifications for the user.
 * ============================================================================
 */

// Execute once the DOM is fully loaded to check for authentication redirect errors
document.addEventListener("DOMContentLoaded", function() {
    // Parse query parameters from the window location URL
    const params = new URLSearchParams(window.location.search);    
    let error = params.get('error');
    
    // If error flag equals '1', render an informative Bootstrap dismissible alert
    if (error === '1') {
        let msg = `
            <div class="alert alert-danger alert-dismissible fade show mt-3 mb-0">
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                <strong>Error!</strong> Incorrect Username or Password.
            </div>
        `;
        document.getElementById("msg-display").innerHTML = msg;
    }
});

function playAsGuest() {
    const randomNum = Math.floor(Math.random() * 10000); // Generate a random number between 0 and 9999
    const guestName = `Guest_${randomNum}`; // Generate a random guest name
    window.location.href = `lobby.html?playerId=${encodeURIComponent(guestName)}`;
}
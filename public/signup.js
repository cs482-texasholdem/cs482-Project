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
            }
        });
    }
});
// ==========================================
// Signup Page Script (signup.js)
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById('signupForm');
    const pass = document.getElementById('txt_pass');
    const confirmPass = document.getElementById('txt_pass_confirm');
    const msgDisplay = document.getElementById('msg-display');

    if (form) {
        form.addEventListener('submit', function(e) {
            if (pass.value !== confirmPass.value) {
                e.preventDefault(); // Stop form submission
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
/**
 * ============================================================================
 * File Name: login.js
 * Author: Bonita Rodrigues, Gigi Li
 * Purpose: Frontend controller script for the Login page. Handles URL query 
 *          parameter parsing to detect authentication failures, guest login,
 *          and the 6-digit password reset code + new password modal flow.
 * ============================================================================
 */

// Execute once the DOM is fully loaded to check for authentication redirect errors
// and initialize the Forgot Password modal interactions.
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
        const msgDisplay = document.getElementById("msg-display");
        if (msgDisplay) {
            msgDisplay.innerHTML = msg;
        }
    }

    const forgotLink = document.getElementById("forgotPasswordLink");
    const modalEl = document.getElementById("forgotPasswordModal");
    const loginEmailInput = document.getElementById("txt_email");

    const stepRequest = document.getElementById("resetStepRequest");
    const resetForm = document.getElementById("resetPasswordForm");
    const feedbackEl = document.getElementById("resetFeedback");

    const resetEmailInput = document.getElementById("resetEmailInput");
    const resetTargetEmail = document.getElementById("resetTargetEmail");
    const sendCodeBtn = document.getElementById("sendResetCodeBtn");
    const backToEmailBtn = document.getElementById("backToEmailBtn");
    const resetCodeInput = document.getElementById("resetCodeInput");
    const newPasswordInput = document.getElementById("newPasswordInput");
    const confirmPasswordInput = document.getElementById("confirmPasswordInput");

    let resetModalInstance = null;
    let activeResetEmail = "";

    function showResetFeedback(message, type = "info") {
        if (!feedbackEl) return;
        feedbackEl.className = `alert alert-${type} small py-2 px-3`;
        feedbackEl.textContent = message;
        feedbackEl.classList.remove("d-none");
    }

    function clearResetFeedback() {
        if (!feedbackEl) return;
        feedbackEl.className = "alert d-none small py-2 px-3";
        feedbackEl.textContent = "";
    }

    function resetModalState(prefillEmail = "") {
        clearResetFeedback();
        activeResetEmail = prefillEmail;
        if (resetEmailInput) resetEmailInput.value = prefillEmail;
        if (resetCodeInput) resetCodeInput.value = "";
        if (newPasswordInput) newPasswordInput.value = "";
        if (confirmPasswordInput) confirmPasswordInput.value = "";
        stepRequest?.classList.remove("d-none");
        resetForm?.classList.add("d-none");
    }

    if (forgotLink && modalEl && typeof bootstrap !== "undefined") {
        forgotLink.addEventListener("click", function(e) {
            e.preventDefault();
            const currentEmail = loginEmailInput?.value.trim() || "";
            resetModalState(currentEmail);
            if (!resetModalInstance) {
                resetModalInstance = new bootstrap.Modal(modalEl);
            }
            resetModalInstance.show();
        });
    }

    sendCodeBtn?.addEventListener("click", async function() {
        const email = resetEmailInput?.value.trim() || "";
        if (!email) {
            showResetFeedback("Please enter your email address first.", "warning");
            resetEmailInput?.focus();
            return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = "Sending...";
        clearResetFeedback();

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (!res.ok) {
                showResetFeedback(data.error || "Could not send reset code.", "danger");
                return;
            }

            activeResetEmail = email;
            if (resetTargetEmail) resetTargetEmail.textContent = email;
            stepRequest?.classList.add("d-none");
            resetForm?.classList.remove("d-none");
            showResetFeedback(data.message || "Reset code sent.", "success");
            resetCodeInput?.focus();
        } catch (err) {
            console.error("Forgot password error:", err);
            showResetFeedback("Network error while requesting reset code.", "danger");
        } finally {
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Send Reset Code";
        }
    });

    backToEmailBtn?.addEventListener("click", function() {
        clearResetFeedback();
        resetForm?.classList.add("d-none");
        stepRequest?.classList.remove("d-none");
        resetEmailInput?.focus();
    });

    resetForm?.addEventListener("submit", async function(e) {
        e.preventDefault();
        clearResetFeedback();

        const code = resetCodeInput?.value.trim() || "";
        const newPassword = newPasswordInput?.value || "";
        const confirmPassword = confirmPasswordInput?.value || "";

        if (!/^\d{6}$/.test(code)) {
            showResetFeedback("Please enter a valid 6-digit code.", "warning");
            return;
        }
        if (newPassword.length < 6) {
            showResetFeedback("New password must be at least 6 characters.", "warning");
            return;
        }
        if (newPassword !== confirmPassword) {
            showResetFeedback("Passwords do not match.", "warning");
            return;
        }

        const submitBtn = document.getElementById("submitNewPasswordBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";
        }

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: activeResetEmail || resetEmailInput?.value.trim(),
                    code,
                    newPassword
                })
            });
            const data = await res.json();

            if (!res.ok) {
                showResetFeedback(data.error || "Could not reset password.", "danger");
                return;
            }

            showResetFeedback(data.message || "Password updated!", "success");
            if (loginEmailInput && activeResetEmail) {
                loginEmailInput.value = activeResetEmail;
            }

            setTimeout(() => {
                resetModalInstance?.hide();
            }, 1400);
        } catch (err) {
            console.error("Reset password error:", err);
            showResetFeedback("Network error while saving new password.", "danger");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save New Password";
            }
        }
    });
});

function playAsGuest() {
    // Clear old guest storage so a fresh guest session starts
    sessionStorage.removeItem("guestPlayerId");

    const randomNum = Math.floor(Math.random() * 10000); // Generate a random number between 0 and 9999
    const guestName = `Guest_${randomNum}`; // Generate a random guest name

    sessionStorage.setItem("guestPlayerId", guestName);
    sessionStorage.setItem("identityMode", "guest");
    window.location.href = `lobby.html?playerId=${encodeURIComponent(guestName)}`;
}
// ==========================================
// Login Page Script (login.js)
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
    const params = new URLSearchParams(window.location.search);    
    let error = params.get('error');
    
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
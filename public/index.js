// ==========================================
// Lobby Homepage Script (index.js)
// ==========================================

let joinSidebar;

document.addEventListener("DOMContentLoaded", function() {
    // Initialize the Bootstrap Offcanvas sidebar component
    const sidebarElement = document.getElementById('joinGameSidebar');
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
    }
});

// Function triggered when clicking "Join Table" on any lobby card
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
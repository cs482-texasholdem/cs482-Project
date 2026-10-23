/**
 * ============================================================================
 * File Name: index.js
 * Author: Bonita Rodrigues
 * Purpose: Frontend controller script for the Poker Lobby homepage. Manages 
 *          Bootstrap offcanvas sidebar components and dynamic table join 
 *          interactions, including buy-in parsing and minimum threshold validation.
 * ============================================================================
 */

let joinSidebar;

// Initialize layout components once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
    // Initialize the Bootstrap Offcanvas sidebar component
    const sidebarElement = document.getElementById('joinGameSidebar');
    if (sidebarElement) {
        joinSidebar = new bootstrap.Offcanvas(sidebarElement);
    }
});


/**
 * Populates and opens the slide-out table join sidebar when a user clicks 
 * "Join Table" on any lobby card. Parses numeric buy-in thresholds.
 * 
 * @param {string} tableName - The name or identifier of the poker table
 * @param {string} blinds - The small/big blind stakes string (e.g., "$10/$20")
 * @param {string} minBuyin - The minimum chip buy-in requirement string
 */
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
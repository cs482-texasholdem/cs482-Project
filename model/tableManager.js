
/**
 * ============================================================================
 * File Name: tableManager.js
 * Purpose: Manages all poker tables (create, retrieve, find, and remove tables)
 * ============================================================================
 */

const { randomUUID } = require("node:crypto");
const ActiveTable = require("../model/activeTable");

class TableManager {
    constructor() {
        // Collection of all the tables
        // Key: tableId
        // Value: ActiveTable
        this.tables = new Map();
    }

    // Adds a table to the collection
    addTable(tableId, table) {
        // Check for valid table information
        if (!tableId || !table || table.tableId !== tableId) {
            return false;
        }

        // Check if table already exists
        if (this.tables.has(tableId)) {
            return false;
        }

        this.tables.set(tableId, table);
        return true;
    }

    // Removes a table
    removeTable(tableId) {
        if (!this.tables.has(tableId)) {
            return false;
        }

        this.tables.delete(tableId);
        return true;
    }

    // Retrieves a table using its ID
    getTable(tableId) {
        return this.tables.get(tableId) ?? null;
    }

    // Returns the existing tables
    getAllTables() {
        return Array.from(this.tables.values());
    }

    // Creates a new ActiveTable
    createTable(skillLevel = "general", timeLimit = 30, gameMode = "custom", maxPlayer = 9, smallBlind = 10, bigBlind = 20) {
        //error checking
        if (typeof skillLevel !== "string" || skillLevel.trim() === "") {
            throw new Error("Invalid skill level.");
        }

        if (!Number.isInteger(timeLimit) || timeLimit <= 0) {
            throw new Error("Time limit must be a positive integer.");
        }

        if (!["ranked", "custom"].includes(gameMode)) {
            throw new Error("Invalid game mode.");
        }

        if (gameMode === "ranked" &&
            !["beginner", "intermediate", "advanced"].includes(skillLevel)) {
            throw new Error("Invalid ranked skill level.");
        }


        //create table logic
        const tableId = randomUUID();
        const table = new ActiveTable(tableId, skillLevel, timeLimit, gameMode, maxPlayer, smallBlind, bigBlind);

        if (!this.addTable(tableId, table)) {
            throw new Error("Failed to add table.");
        }

        return table;
    }

    // Finds a table with available seats
    findAvailableTable(skillLevel) {
        if (typeof skillLevel !== "string" || skillLevel.trim() === "") {
            return null;
        }

        for (const table of this.tables.values()) {
            if (table.skillLevel === skillLevel && !table.isFull()) {
                return table;
            }
        }

        return null;
    }

    getOrCreateRankedTable(skillLevel) {
        if (!["beginner", "intermediate", "advanced"].includes(skillLevel)) {
            throw new Error("Invalid ranked skill level.");
        }

        //enter OR create new Ranked table logic
        let table = this.findAvailableTable(skillLevel, "ranked");

        if (table === null) {
            table = this.createTable(skillLevel, 30, "ranked");
        }

        return table;
    }
}

module.exports = TableManager;

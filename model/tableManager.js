
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

    // Returns all public custom tables
    getPublicTables() {
        return this.getAllTables().filter(table =>
            table.gameMode === "custom" &&
            table.visibility === "public"
        );
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
    findAvailableTable(skillLevel, gameMode) {
        if (typeof skillLevel !== "string" || skillLevel.trim() === "") {
            return null;
        }

        // Validate game mode
        if (!["ranked", "custom"].includes(gameMode)) {
            return null;
        }

        for (const table of this.tables.values()) {
            if (table.skillLevel === skillLevel && 
                table.gameMode === gameMode && 
                !table.isFull() && 
                (!table.gameStarted || !table.gameInProgress)) {
                return table;
            }
        }

        return null;
    }

    getOrCreateRankedTable(skillLevel) {
            const rankedSettings = {
            beginner: {
                smallBlind: 1,
                bigBlind: 2,
                buyIn: 100,
                name: "Beginner Lounge"
            },

            intermediate: {
                smallBlind: 25,
                bigBlind: 50,
                buyIn: 2500,
                name: "Intermediate Lounge"
            },

            advanced: {
                smallBlind: 5,
                bigBlind: 10,
                buyIn: 500,
                name: "Advanced Lounge"
            }
        };

        const settings = rankedSettings[skillLevel];

        if (!settings) {
            throw new Error("Invalid ranked skill level.");
        }
   
        // First, try to fill an existing waiting table
         let table = this.findAvailableTable(skillLevel, "ranked");

        // If all tables are full or currently playing, create a new one
        if (table === null) {
            table = this.createTable(
                skillLevel,
                30,
                "ranked",
                9,
                settings.smallBlind,
                settings.bigBlind
            );

            table.tableName = settings.name;
            table.buyIn = settings.buyIn;
        }

        return table;
        
        }
}

module.exports = TableManager;

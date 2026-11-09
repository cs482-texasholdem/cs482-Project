
const TableManager = require("../model/tableManager");
const ActiveTable = require("../model/activeTable");

describe("TableManager", () => {
    let manager;
    let table1;
    let table2;

    beforeEach(() => {
        manager = new TableManager();

        table1 = new ActiveTable("table1", "beginner", 30);
        table2 = new ActiveTable("table2", "intermediate", 30);
    });

    describe("addTable", () => {
        test("should add a table successfully", () => {
            manager.addTable("table1", table1);

            expect(manager.getTable("table1")).toBe(table1);
        });

        test("should not overwrite an existing table", () => {
            manager.addTable("table1", table1);
            manager.addTable("table1", table2);

            expect(manager.getTable("table1")).toBe(table1);
        });
    });

    describe("removeTable", () => {
        test("should remove an existing table", () => {
            manager.addTable("table1", table1);
            manager.removeTable("table1");

            expect(manager.getTable("table1")).toBeNull();
        });
    });

    describe("getTable", () => {
        test("should retrieve an existing table", () => {
            manager.addTable("table1", table1);

            expect(manager.getTable("table1")).toBe(table1);
        });
    });

    describe("getAllTables", () => {
        test("should return all tables", () => {
            manager.addTable("table1", table1);
            manager.addTable("table2", table2);

            expect(manager.getAllTables()).toHaveLength(2);
        });
    });

    describe("createTable", () => {
        test("should create a custom table", () => {
            const table = manager.createTable("beginner", 30, "custom");

            expect(table).toBeInstanceOf(ActiveTable);
        });

        test("should use default parameters", () => {
            const table = manager.createTable();

            expect(table.skillLevel).toBe("general");
            expect(table.timeLimit).toBe(30);
            expect(table.gameMode).toBe("custom");
        });
    });

    describe("findAvailableTable", () => {
        test("should find a matching table", () => {
            manager.addTable("table1", table1);

            expect(manager.findAvailableTable("beginner", "custom")).toBe(table1);
        });
    });

    describe("getOrCreateRankedTable", () => {
        test("should use an existing ranked table", () => {
            const table = manager.createTable("beginner", 30, "ranked");

            const result = manager.getOrCreateRankedTable("beginner");

            expect(result).toBe(table);
        });

        test("should create a ranked table if none exists", () => {
            const table = manager.getOrCreateRankedTable("beginner");

            expect(table).toBeInstanceOf(ActiveTable);
            expect(table.gameMode).toBe("ranked");
        });
    });
});

describe('TableManager Comprehensive Unit Tests', () => {
    let manager;
    let table;

    beforeEach(() => {
        manager = new TableManager();
        table = new ActiveTable("test-table", "beginner", 30);
    });

    test("should add and retrieve a table successfully", () => {
        manager.addTable("test-table", table);
        expect(manager.getTable("test-table")).toBe(table);
    });

    test("should not overwrite an existing table when adding with a duplicate ID", () => {
        const tableAlt = new ActiveTable("test-table", "expert", 60);
        manager.addTable("test-table", table);
        manager.addTable("test-table", tableAlt);

        expect(manager.getTable("test-table")).toBe(table);
    });

    test("should remove an existing table and return null on lookup", () => {
        manager.addTable("test-table", table);
        manager.removeTable("test-table");

        expect(manager.getTable("test-table")).toBeNull();
    });

    test("should return all active tables", () => {
        const table2 = new ActiveTable("test-table-2", "advanced", 30);
        manager.addTable("test-table", table);
        manager.addTable("test-table-2", table2);

        const allTables = manager.getAllTables();
        expect(allTables).toHaveLength(2);
        expect(allTables).toContain(table);
        expect(allTables).toContain(table2);
    });

    test("should create a custom table with specified parameters", () => {
        const customTable = manager.createTable("intermediate", 45, "custom");

        expect(customTable).toBeInstanceOf(ActiveTable);
        expect(customTable.skillLevel).toBe("intermediate");
        expect(customTable.timeLimit).toBe(45);
        expect(customTable.gameMode).toBe("custom");
    });

    test("findAvailableTable should return null when no tables match the criteria", () => {
        const table = new ActiveTable("table1", "beginner", 30, "custom");
        manager.addTable("table1", table);

        const found = manager.findAvailableTable("advanced", "ranked");
        expect(found).toBeNull();
    });

    test("findAvailableTable should successfully locate and return a matching table", () => {
        const table1 = new ActiveTable("table1", "beginner", 30, "custom");
        const table2 = new ActiveTable("table2", "intermediate", 30, "ranked");
        
        manager.addTable("table1", table1);
        manager.addTable("table2", table2);

        const found = manager.findAvailableTable("intermediate", "ranked");
        expect(found).toBe(table2);
    });

    test("getOrCreateRankedTable should return an existing ranked table if available for the skill level", () => {
        const existingRanked = new ActiveTable("ranked-beg", "beginner", 30, "ranked");
        manager.addTable("ranked-beg", existingRanked);

        const result = manager.getOrCreateRankedTable("beginner");
        expect(result).toBe(existingRanked);
    });

    test("getAllTables should return an empty array when no tables are registered", () => {
        expect(manager.getAllTables()).toEqual([]);
    });

    // Covers Line 39
    test("removeTable should return false when attempting to remove a non-existent table", () => {
        const result = manager.removeTable("fake-id");
        expect(result).toBe(false);
    });

    // Covers Line 60
    test("createTable should throw an error for invalid skill levels", () => {
        expect(() => manager.createTable("", 30, "custom")).toThrow("Invalid skill level.");
        expect(() => manager.createTable(123, 30, "custom")).toThrow("Invalid skill level.");
    });

    // Covers Line 64
    test("createTable should throw an error for invalid time limits", () => {
        expect(() => manager.createTable("beginner", -5, "custom")).toThrow("Time limit must be a positive integer.");
        expect(() => manager.createTable("beginner", 30.5, "custom")).toThrow("Time limit must be a positive integer.");
    });

    // Covers Line 68
    test("createTable should throw an error for invalid game modes", () => {
        expect(() => manager.createTable("beginner", 30, "invalid-mode")).toThrow("Invalid game mode.");
    });

    // Covers Line 73
    test("createTable should throw an error when gameMode is ranked with an invalid skill level", () => {
        expect(() => manager.createTable("general", 30, "ranked")).toThrow("Invalid ranked skill level.");
    });

    // Covers Line 82
    test("createTable should throw an error if addTable fails", () => {
        jest.spyOn(manager, "addTable").mockReturnValue(false);
        expect(() => manager.createTable("beginner", 30, "custom")).toThrow("Failed to add table.");
    });

    // Covers Lines 91 and 96
    test("findAvailableTable should return null for invalid inputs", () => {
        expect(manager.findAvailableTable("", "custom")).toBeNull();
        expect(manager.findAvailableTable(123, "custom")).toBeNull();
        expect(manager.findAvailableTable("beginner", "bad-mode")).toBeNull();
    });

    // Covers Line 110
    test("getOrCreateRankedTable should throw an error for invalid ranked skill levels", () => {
        expect(() => manager.getOrCreateRankedTable("general")).toThrow("Invalid ranked skill level.");
    });
});
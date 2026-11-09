
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

            expect(manager.findAvailableTable("beginner")).toBe(table1);
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

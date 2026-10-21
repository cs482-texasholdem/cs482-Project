const ActiveTable = require("../model/ActiveTable");

describe("ActiveTable", () => {
    let table;

    beforeEach(() => {
        table = new ActiveTable("table1", "beginner");
    });

    test("creates a table with the correct default values", () => {
        expect(table.tableId).toBe("table1");
        expect(table.skillLevel).toBe("beginner");
        expect(table.timeLimit).toBe(30);
        expect(table.maxPlayers).toBe(10);
        expect(table.players).toEqual([]);
    });

    test("adds a player to the table", () => {
        expect(table.addPlayer("player1")).toBe(true);
        expect(table.players).toContain("player1");
    });

    test("does not allow the same player to join twice", () => {
        table.addPlayer("player1");

        expect(table.addPlayer("player1")).toBe(false);
        expect(table.players).toEqual(["player1"]);
    });

    test("removes a player from the table", () => {
        table.addPlayer("player1");

        expect(table.removePlayer("player1")).toBe(true);
        expect(table.players).not.toContain("player1");
    });

    test("returns false when removing a player who is not at the table", () => {
        expect(table.removePlayer("player1")).toBe(false);
    });

    test("reports that an empty table is not full", () => {
        expect(table.isFull()).toBe(false);
    });

    test("reports that a table is full when it has 10 players", () => {
        for (let i = 1; i <= 10; i++) {
            table.addPlayer(`player${i}`);
        }

        expect(table.isFull()).toBe(true);
    });

    test("does not allow another player to join a full table", () => {
        for (let i = 1; i <= 10; i++) {
            table.addPlayer(`player${i}`);
        }

        expect(table.addPlayer("player11")).toBe(false);
        expect(table.players.length).toBe(10);
    });

    test("allows a new player to join after another player leaves", () => {
        for (let i = 1; i <= 10; i++) {
            table.addPlayer(`player${i}`);
        }

        table.removePlayer("player1");

        expect(table.addPlayer("player11")).toBe(true);
        expect(table.players.length).toBe(10);
    });

    test("uses a custom time limit when provided", () => {
        const customTable = new ActiveTable("table2", "advanced", 60);

        expect(customTable.timeLimit).toBe(60);
    });
});

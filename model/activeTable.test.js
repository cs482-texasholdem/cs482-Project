const ActiveTable = require("../model/activeTable");

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

    test("checks whether a player is at the table", () => {
        table.addPlayer("player1");

        expect(table.hasPlayer("player1")).toBe(true);
        expect(table.hasPlayer("player2")).toBe(false);
    });

    test("advances community cards through the flop, turn, and river", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");
        table.deck.deck = Array.from({ length: 52 }, (_, index) => index + 1);

        expect(table.nextRound()).toEqual([6, 7, 8]);
        expect(table.nextRound()).toEqual([6, 7, 8, 10]);
        expect(table.nextRound()).toEqual([6, 7, 8, 10, 12]);
    });

    test("displayCards returns 5 placeholders when displayedCards is empty", () => {
        table.displayedCards = [];
        expect(table.displayCards()).toEqual(["🂠", "🂠", "🂠", "🂠", "🂠"]);
    });

    test("displayCards returns correct mix of cards and placeholders for partial community cards", () => {
        table.displayedCards = [1, 14];
        const result = table.displayCards();
        expect(result.length).toBe(5);
        expect(result[0]).not.toBe("🂠");
        expect(result[1]).not.toBe("🂠");
        expect(result[2]).toBe("🂠");
        expect(result[3]).toBe("🂠");
        expect(result[4]).toBe("🂠");
    });

    test("displayCards handles sparse arrays correctly where some indices are undefined", () => {
        table.displayedCards = [];
        table.displayedCards[1] = 5;
        const result = table.displayCards();
        expect(result[0]).toBe("🂠");
        expect(result[1]).not.toBe("🂠");
        expect(result[2]).toBe("🂠");
    });

    test("rejects null card values in displayedCards", () => {
        table.displayedCards = [null];
        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );
    });

    test("rejects card values below 1 (e.g. 0 or negative numbers)", () => {
        table.displayedCards = [0];
        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );

        table.displayedCards = [-5];
        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );
    });

    test("rejects card values above 52", () => {
        table.displayedCards = [53];
        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );
    });

    test("rejects non-integer card numbers (floats)", () => {
        table.displayedCards = [12.5];
        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );
    });

    test("ignores extra cards beyond the first 5 in displayedCards", () => {
        table.displayedCards = [1, 2, 3, 4, 5, 6];
        const result = table.displayCards();
        expect(result.length).toBe(5);
    });

    test("rejects invalid displayed card values instead of returning unsafe content", () => {
        table.displayedCards = ["<script>alert(1)</script>"];

        expect(() => table.displayCards()).toThrow(
            "Displayed cards must be valid card numbers."
        );
    });

    test("returns the current player count", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");

        expect(table.getPlayerCount()).toBe(2);
    });

    test("rejects an invalid time limit", () => {
        expect(() => new ActiveTable("table2", "beginner", 0))
            .toThrow("Time limit must be a positive integer.");
    });
});
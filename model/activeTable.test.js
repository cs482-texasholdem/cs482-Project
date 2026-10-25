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

    test("returns the current player count", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");

        expect(table.getPlayerCount()).toBe(2);
    });

    test("rejects an invalid time limit", () => {
        expect(() => new ActiveTable("table2", "beginner", 0))
            .toThrow("Time limit must be a positive integer.");
    });

    test("not enough players", () => {
        table.addPlayer("player1");
        expect(table.rotateDealer()).toBe(false);
    });

    //randomMock was used to set randomizer for the test
    test("randomly selects the expected dealer", () => {
        const randomMock = jest.spyOn(Math, "random").mockReturnValue(0.5);
        table.players = ["Mei", "Alex", "Sam", "Joe"];
        table.dealerIndex = null; 
        table.rotateDealer();
        expect(table.dealerIndex).toBe(2);
        randomMock.mockRestore();
    });

    test("move dealer to next player", () => {
        table.players = ["Mei", "Alex", "Sam", "Joe"];
        table.dealerIndex = 2; 
        table.rotateDealer();
        expect(table.dealerIndex).toBe(3);
    });

    test("move dealer to next player who is at the front of arr", () => {
        table.players = ["Mei", "Alex", "Sam", "Joe"];
        table.dealerIndex = 3; 
        table.rotateDealer();
        expect(table.dealerIndex).toBe(0);
    });

    test("returns false with no players", () => {
        table.dealerIndex = 0;
        expect(table.assignBlinds()).toBe(false);
    });

    test("returns false with one player", () => {
        table.addPlayer("player1");
        table.dealerIndex = 0;
        expect(table.assignBlinds()).toBe(false);
    });

    test("returns false when no dealer is assigned", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");
        table.dealerIndex = null;
        expect(table.assignBlinds()).toBe(false);
    });

    test("with two players, the dealer is also the small blind", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");
        table.dealerIndex = 1;

        expect(table.assignBlinds()).toBe(true);
        expect(table.smallBlindIndex).toBe(table.dealerIndex);
        expect(table.bigBlindIndex).toBe(0);
    });

    test("Assign blinds with more than 2 players", () => {
        table.addPlayer("player1");
        table.addPlayer("player2");
        table.addPlayer("player3");
        table.dealerIndex = 1;

        expect(table.assignBlinds()).toBe(true);
        expect(table.smallBlindIndex).toBe(2);
        expect(table.bigBlindIndex).toBe(0);
    });

    test("rejects an invalid table ID", () => {
        expect(() => new ActiveTable("", "beginner")).toThrow("Table ID is required.");
    });

    test("rejects an invalid player ID", () => {
        expect(table.addPlayer("")).toBe(false);
        expect(table.addPlayer("   ")).toBe(false);
        expect(table.addPlayer(null)).toBe(false);
    });
    
    describe("Turn and timer management", () => {
        beforeEach(() => {
            table.addPlayer("Blossom");
            table.addPlayer("Bubbles");
            table.addPlayer("Buttercup");
        });

        test("starts a turn for a valid player", () => {
            expect(table.startTurn(0)).toBe(true);
            expect(table.currentPlayerIndex).toBe(0);
            expect(table.turnEndsAt).toBeGreaterThan(Date.now());
        });

        test("rejects invalid player indices", () => {
            expect(table.startTurn(-1)).toBe(false);
            expect(table.startTurn(3)).toBe(false);
            expect(table.startTurn(1.5)).toBe(false);
            expect(table.startTurn("1")).toBe(false);
        });

        test("rejects starting a turn for a folded player", () => {
            table.foldedPlayers.push("Bubbles");
            expect(table.startTurn(1)).toBe(false);
        });

        test("returns zero when no timer has started", () => {
            expect(table.getTimeRemaining()).toBe(0);
        });

        test("returns remaining time for an active turn", () => {
            table.turnEndsAt = Date.now() + 10000;
            expect(table.getTimeRemaining()).toBeGreaterThan(0);
            expect(table.getTimeRemaining()).toBeLessThanOrEqual(10);
        });

        test("returns zero after the timer expires", () => {
            table.turnEndsAt = Date.now() - 1000;
            expect(table.getTimeRemaining()).toBe(0);
        });

        test("detects whether a turn has expired", () => {
            expect(table.isTurnExpired()).toBe(false);

            table.turnEndsAt = Date.now() + 10000;
            expect(table.isTurnExpired()).toBe(false);

            table.turnEndsAt = Date.now() - 1000;
            expect(table.isTurnExpired()).toBe(true);
        });

        test("advances to the next player", () => {
            table.startTurn(0);
            expect(table.advanceTurn()).toBe(true);
            expect(table.currentPlayerIndex).toBe(1);
        });

        test("skips folded players when advancing", () => {
            table.startTurn(0);
            table.foldedPlayers.push("Bubbles");
            expect(table.advanceTurn()).toBe(true);
            expect(table.currentPlayerIndex).toBe(2);
        });

        test("wraps around to the first player", () => {
            table.startTurn(2);
            expect(table.advanceTurn()).toBe(true);
            expect(table.currentPlayerIndex).toBe(0);
        });

        test("cannot advance when there is no current turn", () => {
            expect(table.advanceTurn()).toBe(false);
        });

        test("cannot advance with fewer than two players", () => {
            table.players = ["Blossom"];
            table.currentPlayerIndex = 0;

            expect(table.advanceTurn()).toBe(false);
        });

        test("clears the turn when every player has folded", () => {
            table.startTurn(0);
            table.foldedPlayers = ["Blossom", "Bubbles", "Buttercup"];
            expect(table.advanceTurn()).toBe(false);
            expect(table.currentPlayerIndex).toBe(null);
            expect(table.turnEndsAt).toBe(null);
        });

        test("folds a player who is not currently taking a turn", () => {
            expect(table.foldPlayer("Bubbles")).toBe(true);
            expect(table.foldedPlayers).toContain("Bubbles");
        });

        test("rejects folding a player who is not at the table", () => {
            expect(table.foldPlayer("Unknown")).toBe(false);
        });

        test("rejects folding the same player twice", () => {
            table.foldPlayer("Bubbles");
            expect(table.foldPlayer("Bubbles")).toBe(false);
        });

        test("advances when the current player folds", () => {
            table.startTurn(0);
            expect(table.foldPlayer("Blossom")).toBe(true);
            expect(table.currentPlayerIndex).toBe(1);
        });

        test("does not fold a player before timeout", () => {
            table.startTurn(0);
            expect(table.checkTurnTimeout()).toBe(false);
            expect(table.foldedPlayers).not.toContain("Blossom");
        });

        test("automatically folds the player after timeout", () => {
            table.startTurn(0);
            table.turnEndsAt = Date.now() - 1000;
            expect(table.checkTurnTimeout()).toBe(true);
            expect(table.foldedPlayers).toContain("Blossom");
            expect(table.currentPlayerIndex).toBe(1);
        });

        test("does not time out when no current player is set", () => {
            table.turnEndsAt = Date.now() - 1000;
            expect(table.checkTurnTimeout()).toBe(false);
        });

        test("handles a missing current player", () => {
            table.currentPlayerIndex = 99;
            table.turnEndsAt = Date.now() - 1000;
            expect(table.checkTurnTimeout()).toBe(false);
        });
    });
});

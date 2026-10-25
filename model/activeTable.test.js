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

    test("throws when table ID is not a string", () => {
        expect(() => new ActiveTable(123, "beginner")).toThrow("Table ID is required.");
    });

    test("throws when table ID is empty", () => {
        expect(() => new ActiveTable("", "beginner")).toThrow("Table ID is required.");
    });

    test("throws when table ID contains only spaces", () => {
        expect(() => new ActiveTable("   ", "beginner")).toThrow("Table ID is required.");
    });

    test("adds a player to the table", () => {
        expect(table.addPlayer("player1")).toBe(true);
        expect(table.players).toContain("player1");
    });

    test("rejects a player ID that is not a string", () => {
        expect(table.addPlayer(123, 100)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
    });

    test("rejects an empty player ID", () => {
        expect(table.addPlayer("", 100)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
    });

    test("rejects a player ID containing only spaces", () => {
        expect(table.addPlayer("   ", 100)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
    });

    test("rejects a non-integer chip amount", () => {
        expect(table.addPlayer("player1", 1.5)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
    }); 

    test("rejects zero chips", () => {
        expect(table.addPlayer("player1", 0)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
    });

    test("rejects negative chips", () => {
        expect(table.addPlayer("player1", -10)).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
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

    describe("rotateDealer", () => {
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
    });


    describe("assignBlinds", () => {
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
    });

    describe("postBlind", () => {
        test("deducts the blind, records the bet, and increases the pot", () => {
            table.addPlayer("player1", 100);

            table.postBlind(0, 2);

            expect(table.playerChips.get("player1")).toBe(98);
            expect(table.playerBets.get("player1")).toBe(2);
            expect(table.pot).toBe(2);
        });

        test("posts only remaining chips when the player cannot cover the blind", () => {
            table.addPlayer("player1", 1);

            table.postBlind(0, 2);

            expect(table.playerChips.get("player1")).toBe(0);
            expect(table.playerBets.get("player1")).toBe(1);
            expect(table.pot).toBe(1);
        });

        test("adds the blind to an existing pot", () => {
            table.addPlayer("player1", 100);
            table.pot = 10;

            table.postBlind(0, 1);

            expect(table.playerChips.get("player1")).toBe(99);
            expect(table.pot).toBe(11);
        });
    });

    describe("postBlinds", () => {
        test("returns false when the small blind is unassigned", () => {
            table.smallBlindIndex = null;
            table.bigBlindIndex = 1;

            expect(table.postBlinds()).toBe(false);
            expect(table.pot).toBe(0);
            expect(table.playerBets.size).toBe(0);
        });

        test("returns false when the big blind is unassigned", () => {
            table.smallBlindIndex = 0;
            table.bigBlindIndex = null;

            expect(table.postBlinds()).toBe(false);
            expect(table.pot).toBe(0);
            expect(table.playerBets.size).toBe(0);
        });

        test("posts both blinds for two players", () => {
            table.addPlayer("player1", 100);
            table.addPlayer("player2", 50);
            table.dealerIndex = 0;
            table.assignBlinds();

            expect(table.postBlinds()).toBe(true);

            expect(table.playerChips.get("player1")).toBe(99);
            expect(table.playerChips.get("player2")).toBe(48);

            expect(table.playerBets.get("player1")).toBe(1);
            expect(table.playerBets.get("player2")).toBe(2);

            expect(table.pot).toBe(3);
        });

        test("leaves the player who owes neither blind unchanged", () => {
            table.addPlayer("player1", 100);
            table.addPlayer("player2", 100);
            table.addPlayer("player3", 100);
            table.dealerIndex = 0;
            table.assignBlinds();

            expect(table.postBlinds()).toBe(true);

            expect(table.playerChips.get("player1")).toBe(100);
            expect(table.playerChips.get("player2")).toBe(99);
            expect(table.playerChips.get("player3")).toBe(98);
            expect(table.playerBets.has("player1")).toBe(false);
            expect(table.pot).toBe(3);
        });
    });

    describe("fold", () => {
        test("player is not at the table", () => {
            expect(table.fold("missing-player")).toBe(false);
            expect(table.foldedPlayers.size).toBe(0);
        });

        test("player already folded", () => {
            table.addPlayer("player1");
            table.fold("player1");

            expect(table.fold("player1")).toBe(false);
            expect(table.foldedPlayers.size).toBe(1);
        });
        
        test("player has already folded", () => {
            table.addPlayer("player1");
            table.fold("player1");

            expect(table.fold("player1")).toBe(false);
            expect(table.foldedPlayers.size).toBe(1);
        });

        test("player folded", () => {
            table.addPlayer("player1");
            expect(table.fold("player1")).toBe(true);
            expect(table.foldedPlayers.has("player1")).toBe(true);
            expect(table.foldedPlayers.size).toBe(1);
        });
    });
});

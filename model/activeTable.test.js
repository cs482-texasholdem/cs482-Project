const ActiveTable = require('../model/activeTable.js');

describe('ActiveTable Model Class', () => {
    let table;

    beforeEach(() => {
        table = new ActiveTable('test-table', 'general', 30);
    });

    test('constructor initializes with correct default values', () => {
        expect(table.tableId).toBe('test-table');
        expect(table.skillLevel).toBe('general');
        expect(table.timeLimit).toBe(30);
        expect(table.maxPlayers).toBe(10);
        expect(table.queue).toEqual([]);
        expect(table.players).toEqual([]);
        expect(table.spectators).toEqual([]);
        expect(table.gameStarted).toBe(false);
        expect(table.gameInProgress).toBe(false);
        expect(table.pot).toBe(0);
    });

<<<<<<< HEAD
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
=======
    test('addPlayer successfully adds valid players and rejects invalid/duplicate IDs', () => {
        expect(table.addPlayer('Player1')).toBe(true);
        expect(table.addPlayer('Player1')).toBe(false); // Duplicate
        expect(table.addPlayer('')).toBe(false); // Invalid
        expect(table.addPlayer(null)).toBe(false); // Invalid
        expect(table.getPlayerCount()).toBe(1);
    });

    test('isFull returns true when queue reaches maxPlayers', () => {
>>>>>>> next_round_testing
        for (let i = 1; i <= 10; i++) {
            table.addPlayer(`Player${i}`);
        }
        expect(table.isFull()).toBe(true);
        expect(table.addPlayer('ExtraPlayer')).toBe(true); // Added to queue, but not active if game started
    });

    test('removePlayer handles queue, players, and spectators correctly', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        expect(table.removePlayer('Player1')).toBe(true);
        expect(table.removePlayer('NonExistent')).toBe(false);
        expect(table.hasPlayer('Player1')).toBe(false);
    });

    test('startGame fails when fewer than 2 players are present', () => {
        table.addPlayer('Player1');
        const res = table.startGame();
        expect(res.success).toBe(false);
        expect(res.error).toBeDefined();
    });

    test('startGame succeeds with 2+ players and sets up blinds and turn', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        const res = table.startGame();
        expect(res.success).toBe(true);
        expect(table.gameStarted).toBe(true);
        expect(table.gameInProgress).toBe(true);
        expect(table.pot).toBeGreaterThan(0);
    });

    test('dealHandToPlayer returns cards for active players', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        table.startGame();
        const hand = table.dealHandToPlayer('Player1');
        expect(hand).toHaveLength(2);
        expect(table.dealHandToPlayer('InvalidPlayer')).toBe(false);
    });

    test('recordAction handles fold, check, call, and raise correctly', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        table.addPlayer('Player3');
        table.startGame();

        const currentTurnId = table.players[table.currentTurnIndex];
        
        // Invalid action out of turn
        const invalidTurn = table.recordAction('WrongPlayer', 'Check', 0);
        expect(invalidTurn.success).toBe(false);

        // Valid action
        const actionRes = table.recordAction(currentTurnId, 'Call', 0);
        expect(actionRes.success).toBe(true);
    });

    test('recordAction handles raise and updates aggressor', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        table.addPlayer('Player3');
        table.startGame();

        const currentTurnId = table.players[table.currentTurnIndex];
        const raiseRes = table.recordAction(currentTurnId, 'Raise', 50);
        expect(raiseRes.success).toBe(true);
        expect(table.currentHighestBet).toBe(50);
    });

    test('checkTimeout triggers automatic check or fold', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        table.startGame();
        
        // Force timeout by backdating turnStartTime
        table.turnStartTime = Date.now() - 35000;
        const timedOut = table.checkTimeout();
        expect(timedOut).toBe(true);
    });

    test('nextRound advances community cards and handles showdown', () => {
        table.addPlayer('Player1');
        table.addPlayer('Player2');
        table.startGame();

        // Fast-forward actions to finish betting round
        while (!table.allPlayersHaveActedAndMatched()) {
            const currentId = table.players[table.currentTurnIndex];
            const p = table.playerObjects.get(currentId);
            if (p && !p.folded && !p.hasActed) {
                table.recordAction(currentId, 'Call', 0);
            } else {
                break;
            }
        }

        const roundRes = table.nextRound();
        expect(roundRes.communityCards).toBeDefined();
    });

    test('displayCards formats card integers correctly', () => {
        table.displayedCards = [1, 14, 27, 40, 52];
        const formatted = table.displayCards();
        expect(formatted).toEqual(['2♥', '2♦', '2♣', '2♠', 'A♠']);
    });
<<<<<<< HEAD

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
            table.foldedPlayers.add("Bubbles");
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
            table.foldedPlayers.add("Bubbles");
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
            table.foldedPlayers = new Set(["Blossom", "Bubbles", "Buttercup"]);
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

    describe("check", () => {
        test("player is not at the table", () => {
            expect(table.check("missing-player")).toBe(false);
            expect(table.checkPlayers.size).toBe(0);
        });

        test("player already checked", () => {
            table.addPlayer("player1");
            table.check("player1");

            expect(table.check("player1")).toBe(false);
            expect(table.checkPlayers.size).toBe(1);
        });
        
        test("player has already checked", () => {
            table.addPlayer("player1");
            table.check("player1");

            expect(table.check("player1")).toBe(false);
            expect(table.checkPlayers.size).toBe(1);
        });

        test("player has already folded", () => {
            table.addPlayer("player1");
            table.fold("player1");

            expect(table.fold("player1")).toBe(false);
            expect(table.foldedPlayers.size).toBe(1);
        });

        test("player check", () => {
            table.addPlayer("player1");
            expect(table.check("player1")).toBe(true);
            expect(table.checkPlayers.has("player1")).toBe(true);
            expect(table.checkPlayers.size).toBe(1);
        });

        test("missing player becomes as zero", () => {
            table.addPlayer("player1");
            table.currentBet = 0;

            expect(table.playerBets.has("player1")).toBe(false);
            expect(table.check("player1")).toBe(true);
            expect(table.checkPlayers.has("player1")).toBe(true);
        });

        test("check does not matched the current bet", () => {
            table.addPlayer("player1", 1);
            table.playerBets.set("player1", 1);
            table.currentBet = 2;

            expect(table.check("player1")).toBe(false);
            expect(table.checkPlayers.has("player1")).toBe(false);
        });
    });

    describe("call", () => {
        test("player is not at the table", () => {
            expect(table.call("missing-player")).toBe(false);
            expect(table.pot).toBe(0);
        });

        test("player already folded", () => {
            table.addPlayer("player1");
            table.fold("player1");

            expect(table.fold("player1")).toBe(false);
            expect(table.foldedPlayers.size).toBe(1);
        });

        test("rejects calling when the player already matched the bet", () => {
            table.addPlayer("player1", 100);
            table.playerBets.set("player1", 10);
            table.currentBet = 10;

            expect(table.call("player1")).toBe(false);
            expect(table.playerChips.get("player1")).toBe(100);
            expect(table.pot).toBe(0);
        });

        test("rejects calling when the player has no chips", () => {
            table.addPlayer("player1", 100);
            table.playerChips.set("player1", 0);
            table.currentBet = 10;

            expect(table.call("player1")).toBe(false);
            expect(table.playerChips.get("player1")).toBe(0);
            expect(table.pot).toBe(0);
        });

        test("uses zero when no previous bet is recorded", () => {
            table.addPlayer("player1", 100);
            table.currentBet = 10;

            expect(table.call("player1")).toBe(true);
            expect(table.playerChips.get("player1")).toBe(90);
            expect(table.playerBets.get("player1")).toBe(10);
            expect(table.pot).toBe(10);
        });

        test("pays only the difference and adds it to the existing pot", () => {
            table.addPlayer("player1", 100);
            table.playerBets.set("player1", 2);
            table.currentBet = 10;
            table.pot = 12;

            expect(table.call("player1")).toBe(true);

            // Owes 10 - 2 = 8 chips.
            expect(table.playerChips.get("player1")).toBe(92);
            expect(table.playerBets.get("player1")).toBe(10);
            expect(table.pot).toBe(20);
        });

        test("posts remaining chips when unable to cover the call", () => {
            table.addPlayer("player1", 3);
            table.playerBets.set("player1", 2);
            table.currentBet = 10;
            table.pot = 12;

            expect(table.call("player1")).toBe(true);

            // Owes 8, but can pay only 3.
            expect(table.playerChips.get("player1")).toBe(0);
            expect(table.playerBets.get("player1")).toBe(5);
            expect(table.pot).toBe(15);
        });

        test("can call with exactly the remaining chips", () => {
            table.addPlayer("player1", 8);
            table.playerBets.set("player1", 2);
            table.currentBet = 10;

            expect(table.call("player1")).toBe(true);
            expect(table.playerChips.get("player1")).toBe(0);
            expect(table.playerBets.get("player1")).toBe(10);
            expect(table.pot).toBe(8);
        });
    });

    describe("raise", () => {
        test("rejects a missing player", () => {
            expect(table.raise("missing", 10)).toBe(false);
        });

        test("rejects a folded player", () => {
            table.addPlayer("player1", 100);
            table.fold("player1");

            expect(table.raise("player1", 10)).toBe(false);
        });

        test("rejects a non-integer amount", () => {
            table.addPlayer("player1", 100);

            expect(table.raise("player1", 2.5)).toBe(false);
        });

        test("rejects an amount equal to the current bet", () => {
            table.addPlayer("player1", 100);
            table.currentBet = 10;

            expect(table.raise("player1", 10)).toBe(false);
        });

        test("rejects a nonpositive payment", () => {
            table.addPlayer("player1", 100);
            table.currentBet = 2;
            table.playerBets.set("player1", 10);

            expect(table.raise("player1", 10)).toBe(false);
        });

        test("rejects a payment exceeding available chips", () => {
            table.addPlayer("player1", 5);
            table.currentBet = 2;

            expect(table.raise("player1", 10)).toBe(false);
        });

        test("raises successfully with no previous bet", () => {
            table.addPlayer("player1", 100);
            table.currentBet = 2;

            expect(table.raise("player1", 10)).toBe(true);
            expect(table.playerChips.get("player1")).toBe(90);
            expect(table.playerBets.get("player1")).toBe(10);
            expect(table.currentBet).toBe(10);
            expect(table.pot).toBe(10);
        });
    });

    

    
});
=======
});
>>>>>>> next_round_testing

jest.mock('../model/GameDao');
jest.mock('../model/UserDao', () => ({
    findOne: jest.fn().mockResolvedValue(null)
}));
const GameDao = require('../model/GameDao');
const { getTableStatus, tableManager, joinTable, joinRankedTable, leaveTable, startGame, finishGame, playerAction, nextRound, postChatMessage, mainTable} = require('../controller/tableController.js');
const TableManager = require('../model/tableManager');

describe('Table Controller Unit Tests', () => {
    let req, res, mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        // Prevent tests from making real database writes
        GameDao.create.mockResolvedValue({});

        // Set up mock io for testing broadcasts
        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
        };

        req = {
            query: {},
            body: {},
            session: {},
            app: {
                get: jest.fn((key) => {
                    if (key === 'io') return mockIo;
                    return null;
                })
            }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    test('joinTable validates missing player ID and successfully joins table', async () => {
        // Missing ID
        req.body = { playerId: '' };
        await joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Valid Join
        req.body = { playerId: 'ControllerPlayer1' };
        await joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);

        // Duplicate Join
        await joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('joinTable rejects a non-string player ID', async () => {
        req.body = { playerId: 123 };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Player ID is required."
        });
    });

    test('joinTable gets player ID from query parameters', async () => {
        const addPlayerSpy = jest.spyOn(mainTable, 'addPlayer').mockReturnValue(true);

        req.query = { playerId: 'QueryPlayer1' };

        await joinTable(req, res);

        expect(addPlayerSpy).toHaveBeenCalledWith('QueryPlayer1', 1000);
        expect(res.status).toHaveBeenCalledWith(200);

        addPlayerSpy.mockRestore();
    });

    test('joinTable succeeds when Socket.io is unavailable', async () => {
        req.app.get.mockReturnValue(null);
        req.body = { playerId: 'NoSocketPlayer' };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Successfully joined the table as a player.",
                isPlayer: true
            })
        );

        mainTable.removePlayer('NoSocketPlayer');
    });

    test('getTableStatus returns complete table status data', () => {
        req.query = { playerId: 'ControllerPlayer1' };
        getTableStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            tableId: 'main',
            inTable: true
        }));
    });

    test('getTableStatus handles a player who is not at the table', () => {
        req.query = { playerId: 'UnknownPlayer' };

        getTableStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                inTable: false,
                isPlayer: false,
                isSpectator: false,
                playerChips: 1000
            })
        );
    });

    test('getTableStatus returns player hand during an active game', async () => {
        // Add two players and start a game
        req.body = { playerId: 'StatusPlayer1' };
        await joinTable(req, res);

        req.body = { playerId: 'StatusPlayer2' };
        await joinTable(req, res);

        startGame(req, res);

        // Request the first player's table status
        req.query = { playerId: 'StatusPlayer1' };
        getTableStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                inTable: true,
                isPlayer: true,
                gameInProgress: true,
                playerHand: expect.any(Array)
            })
        );

        // Clean up the players and game state
        mainTable.resetToLobby();
        mainTable.removePlayer('StatusPlayer1');
        mainTable.removePlayer('StatusPlayer2');
    });

    test('startGame handles insufficient players and successful start', async () => {
        // Try starting with only 1 player
        startGame(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Add second player to meet minimum requirement
        req.body = { playerId: 'ControllerPlayer2' };
        await joinTable(req, res);

        startGame(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('finishGame returns an error when no game is in progress', () => {
        const finishGameSpy = jest.spyOn(mainTable, 'finishGame')
            .mockReturnValue({
                success: false,
                error: "No game in progress to finish."
            });

        finishGame(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "No game in progress to finish."
        });

        finishGameSpy.mockRestore();
    });

    test('finishGame successfully finishes the game and broadcasts winner data', () => {
        const mockWinnerData = {
            winners: ['ControllerPlayer1'],
            pot: 2000
        };

        const finishGameSpy = jest.spyOn(mainTable, 'finishGame')
            .mockReturnValue({
                success: true,
                winnerData: mockWinnerData
            });

        finishGame(req, res);

        expect(finishGameSpy).toHaveBeenCalled();
        expect(mockIo.to).toHaveBeenCalledWith('table_main');
        expect(mockIo.emit).toHaveBeenCalledWith('SHOWDOWN_REVEAL', mockWinnerData);
        expect(mockIo.emit).toHaveBeenCalledWith(
            'TABLE_UPDATED',
            { tableId: 'main' }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Game finished successfully.",
            winnerData: mockWinnerData
        });

        finishGameSpy.mockRestore();
    });

    test('playerAction validates required fields and executes action', async () => {
        // Check missing required fields
        req.body = {};
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Set up a game
        req.body = { playerId: 'ControllerPlayer1' };
        await joinTable(req, res);

        req.body = { playerId: 'ControllerPlayer2' };
        await joinTable(req, res);

        startGame(req, res);

        // Check successful action
        req.body = { playerId: 'ControllerPlayer1', action: 'Call' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('playerAction handles showdown winner and resets table', () => {
        const mockWinnerData = {
            winners: ['ControllerPlayer1'],
            pot: 2000
        };

        const recordActionSpy = jest.spyOn(mainTable, 'recordAction')
            .mockReturnValue({
                success: true,
                winnerData: mockWinnerData
            });

        const resetToLobbySpy = jest.spyOn(mainTable, 'resetToLobby')
            .mockImplementation(() => {});

        req.body = {
            playerId: 'ControllerPlayer1',
            action: 'Call'
        };

        playerAction(req, res);

        expect(recordActionSpy).toHaveBeenCalledWith(
            'ControllerPlayer1',
            'Call',
            0
        );

        expect(mockIo.to).toHaveBeenCalledWith('table_main');
        expect(mockIo.emit).toHaveBeenCalledWith(
            'SHOWDOWN_REVEAL',
            mockWinnerData
        );
        expect(mockIo.emit).toHaveBeenCalledWith(
            'TABLE_UPDATED',
            { tableId: 'main' }
        );

        expect(resetToLobbySpy).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Action Call recorded successfully.",
                winnerData: mockWinnerData
            })
        );

        recordActionSpy.mockRestore();
        resetToLobbySpy.mockRestore();
    });

    test('nextRound advances round or errors appropriately', () => {
        req.query = { playerId: 'ControllerPlayer1' };
        nextRound(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('nextRound handles showdown winner and resets table', () => {
        const mockWinnerData = {
            winners: ['ControllerPlayer1'],
            pot: 2000
        };

        const nextRoundSpy = jest.spyOn(mainTable, 'nextRound')
            .mockReturnValue({
                error: null,
                winnerData: mockWinnerData,
                communityCards: [],
                pot: 2000
            });

        const resetToLobbySpy = jest.spyOn(mainTable, 'resetToLobby')
            .mockImplementation(() => {});

        req.query = { playerId: 'ControllerPlayer1' };

        nextRound(req, res);

        expect(nextRoundSpy).toHaveBeenCalled();

        expect(mockIo.to).toHaveBeenCalledWith('table_main');
        expect(mockIo.emit).toHaveBeenCalledWith(
            'SHOWDOWN_REVEAL',
            mockWinnerData
        );
        expect(mockIo.emit).toHaveBeenCalledWith(
            'TABLE_UPDATED',
            { tableId: 'main' }
        );

        expect(resetToLobbySpy).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Advanced to the next round.",
                winnerData: mockWinnerData
            })
        );

        nextRoundSpy.mockRestore();
        resetToLobbySpy.mockRestore();
    });

    test('leaveTable validates and removes player', async () => {
        req.body = { playerId: 'ControllerPlayer1' };
        await leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);

        // Leave non-existent player safely succeeds with 200
        req.body = { playerId: 'Ghost' };
        await leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('leaveTable rejects a missing player ID', async () => {
        req.body = {};
        req.query = {};

        await leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Player ID is required."
        });
    });

    test('playerAction executes action and broadcasts state update via Socket.io', async () => {
        req.body = { playerId: 'ControllerPlayer1' };
        await joinTable(req, res);
        req.body = { playerId: 'ControllerPlayer2' };
        await joinTable(req, res);
        startGame(req, res);

        req.body = { playerId: 'ControllerPlayer1', action: 'Call' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        
        expect(mockIo.emit).toHaveBeenCalledWith(
            "TABLE_UPDATED",
            { tableId: "main" }
        );
    });

    test('playerAction broadcasts PLAYER_FOLDED when a player folds', async () => {
        req.body = { playerId: 'ControllerPlayer1' };
        await joinTable(req, res);
        req.body = { playerId: 'ControllerPlayer2' };
        await joinTable(req, res);
        startGame(req, res);

        req.body = { playerId: 'ControllerPlayer1', action: 'Fold' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        
        expect(mockIo.emit).toHaveBeenCalledWith(
            "TABLE_UPDATED",
            { tableId: "main" }
        );
    });

    test('joinTable returns 404 when tableId does not exist in tableManager', async () => {
        req.params = { tableId: 'nonexistentTable' };
        req.body = { playerId: 'PlayerX' };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Table not found." });
    });

    test('joinTable handles table full or registration failure gracefully', async () => {
        // Mock addPlayer to return false (table full / error)
        const addPlayerSpy = jest.spyOn(mainTable, 'addPlayer').mockReturnValue(false);
        req.body = { playerId: 'OverflowPlayer' };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        addPlayerSpy.mockRestore();
    });

    test('leaveTable returns 400 when playerId is missing', async () => {
        req.body = {};
        req.query = {};

        await leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Player ID is required." });
    });

    test('leaveTable handles table not found when params.tableId is invalid', async () => {
        req.params = { tableId: 'badTable' };
        req.body = { playerId: 'Player1' };

        await leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Table not found." });
    });

    test('playerAction returns 400 when missing playerId or action parameters', () => {
        req.body = { playerId: '' }; // missing action
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        req.body = { action: 'Call' }; // missing playerId
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('playerAction returns 404 if tableId is invalid', () => {
        req.params = { tableId: 'ghostTable' };
        req.body = { playerId: 'Player1', action: 'Call' };

        playerAction(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Table not found." });
    });

    test('playerAction handles action failure returned by table engine', async () => {
        req.body = { playerId: 'Player1' };
        await joinTable(req, res);
        req.body = { playerId: 'Player2' };
        await joinTable(req, res);
        startGame(req, res);

        const recordActionSpy = jest.spyOn(mainTable, 'recordAction').mockReturnValue({
            success: false,
            error: "Not your turn."
        });

        req.body = { playerId: 'Player1', action: 'Raise', amount: 50 };
        playerAction(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Not your turn." });

        recordActionSpy.mockRestore();
        mainTable.resetToLobby();
        mainTable.removePlayer('Player1');
        mainTable.removePlayer('Player2');
    });

    test('nextRound handles error object returned by table nextRound', () => {
        const nextRoundSpy = jest.spyOn(mainTable, 'nextRound').mockReturnValue({
            error: "Game has not been started yet."
        });

        req.query = { playerId: 'Player1' };
        nextRound(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Game has not been started yet." });

        nextRoundSpy.mockRestore();
    });

    // Verify leaving as a Guest_ player saves their current chip stack into req.session.pendingGuestPoints
    test('leaveTable stores departing guest chips in req.session.pendingGuestPoints', async () => {
        mainTable.resetToLobby();
        const guestId = 'Guest_4321';
        mainTable.addPlayer(guestId);
        mainTable.playerManager.getPlayer(guestId).chips = 1550;

        req.body = { tableId: 'main', playerId: guestId };
        req.session = {};

        await leaveTable(req, res);

        expect(req.session.pendingGuestPoints).toBe(1550);
        expect(mainTable.hasPlayer(guestId)).toBe(false);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});


describe('Multi-Table Controller Tests', () => {
    let req, res, mockIo;
    let table1, table2, table3;

    beforeEach(() => {
        tableManager.tables.clear();
        tableManager.addTable("main", mainTable);
        
        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        };

        req = {
            params: {},
            query: {},
            body: {},
            session: {},
            app: {
                get: jest.fn((key) => {
                    if (key === 'io') return mockIo;
                    return null;
                })
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        table1 = tableManager.createTable("beginner", 30, "custom");
        table2 = tableManager.createTable("intermediate", 30, "custom");
        table3 = tableManager.createTable("advanced", 30, "custom");
    });

    afterEach(() => {
        tableManager.removeTable(table1.tableId);
        tableManager.removeTable(table2.tableId);
        tableManager.removeTable(table3.tableId);
    });

    test('should create three independent tables', () => {
        const ids = [
            table1.tableId,
            table2.tableId,
            table3.tableId
        ];

        expect(new Set(ids).size).toBe(3);

        expect(tableManager.getTable(table1.tableId)).toBe(table1);
        expect(tableManager.getTable(table2.tableId)).toBe(table2);
        expect(tableManager.getTable(table3.tableId)).toBe(table3);
    });

    test('should allow players to join three separate tables', async () => {
        req.params = { tableId: table1.tableId };
        req.body = { playerId: 'Player1' };
        await joinTable(req, res);
        expect(res.status).toHaveBeenLastCalledWith(200);

        req.params = { tableId: table2.tableId };
        req.body = { playerId: 'Player2' };
        await joinTable(req, res);
        expect(res.status).toHaveBeenLastCalledWith(200);

        req.params = { tableId: table3.tableId };
        req.body = { playerId: 'Player3' };
        await joinTable(req, res);
        expect(res.status).toHaveBeenLastCalledWith(200);

        expect(table1.players).toEqual(['Player1']);
        expect(table2.players).toEqual(['Player2']);
        expect(table3.players).toEqual(['Player3']);
    });

    test('should return correct status for each table', () => {
        const tables = [table1, table2, table3];

        for (const table of tables) {
            res.status.mockClear();
            res.json.mockClear();

            req.params = { tableId: table.tableId };

            getTableStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    tableId: table.tableId,
                    skillLevel: table.skillLevel
                })
            );
        }
    });

    test('should only remove players from the selected table', async () => {
        table1.addPlayer('Player1');
        table2.addPlayer('Player2');
        table3.addPlayer('Player3');

        req.params = { tableId: table2.tableId };
        req.body = { playerId: 'Player2' };

        await leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(table1.players).toContain('Player1');
        expect(table2.players).not.toContain('Player2');
        expect(table3.players).toContain('Player3');
    });

    test('should return 404 for a nonexistent table', async () => {
        req.params = { tableId: 'invalidTable' };
        req.body = { playerId: 'Player1' };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        // All three actual tables should still exist
        expect(tableManager.getTable(table1.tableId)).toBe(table1);
        expect(tableManager.getTable(table2.tableId)).toBe(table2);
        expect(tableManager.getTable(table3.tableId)).toBe(table3);
    });

    test('should start a game without affecting other tables', () => {
        table1.addPlayer('Player1');
        table1.addPlayer('Player2');

        table2.addPlayer('Player3');
        table2.addPlayer('Player4');

        table3.addPlayer('Player5');
        table3.addPlayer('Player6');

        req.params = { tableId: table1.tableId };
        startGame(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);

        expect(table1.gameInProgress).toBe(true);
        expect(table2.gameInProgress).toBe(false);
        expect(table3.gameInProgress).toBe(false);
    });

    test('should start three independent games', () => {
        const tables = [table1, table2, table3];

        tables.forEach((table, index) => {
            table.addPlayer(`Player${index * 2 + 1}`);
            table.addPlayer(`Player${index * 2 + 2}`);
        });

        for (const table of tables) {
            req.params = { tableId: table.tableId };

            res.status.mockClear();
            res.json.mockClear();

            startGame(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(table.gameInProgress).toBe(true);
        }

        expect(table1.gameInProgress).toBe(true);
        expect(table2.gameInProgress).toBe(true);
        expect(table3.gameInProgress).toBe(true);
    });

    test('getTableStatus initializes and returns chatMessages', () => {
        req.query = { playerId: 'StatusChatPlayer' };

        getTableStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                chatMessages: expect.any(Array)
            })
        );
        expect(mainTable.chatMessages.length).toBeGreaterThan(0);
    });

    test('postChatMessage returns 404 when requested table does not exist', () => {
        req.params = { tableId: 'missing-table' };
        req.body = { playerId: 'Alice', message: 'Hello!' };

        postChatMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Table not found." });
    });

    test('postChatMessage returns 401 when sender is missing', () => {
        req.session = {};
        req.body = { message: 'Hello!' };

        postChatMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Player ID is required to chat." });
    });

    test('postChatMessage returns 400 when message is empty or whitespace', () => {
        req.body = { playerId: 'Alice', message: '   ' };

        postChatMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Message cannot be empty." });
        expect(mockIo.emit).not.toHaveBeenCalledWith('table-chat', expect.anything());
    });

    test('postChatMessage stores trimmed message up to 200 chars, emits table-chat, and returns 200', () => {
        const initialCount = mainTable.chatMessages.length;
        const longText = '  ' + 'x'.repeat(230) + '  ';

        req.session = { user: { username: 'SessionAlice' } };
        req.body = { message: longText };

        postChatMessage(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            chatMessages: expect.any(Array)
        });

        const latest = mainTable.chatMessages[mainTable.chatMessages.length - 1];
        expect(mainTable.chatMessages.length).toBe(initialCount + 1);
        expect(latest.sender).toBe('SessionAlice');
        expect(latest.text).toBe('x'.repeat(200));
        expect(typeof latest.timestamp).toBe('number');

        expect(mockIo.emit).toHaveBeenCalledWith('table-chat', {
            tableId: 'main',
            sender: 'SessionAlice',
            message: 'x'.repeat(200)
        });
    });

    test('postChatMessage caps chat history at 50 messages', () => {
        mainTable.chatMessages = Array.from({ length: 50 }, (_, i) => ({
            sender: 'Dealer',
            text: `Msg ${i}`,
            timestamp: Date.now()
        }));

        req.body = { playerId: 'Bob', message: 'Message 51' };

        postChatMessage(req, res);

        expect(mainTable.chatMessages.length).toBe(50);
        expect(mainTable.chatMessages[0].text).toBe('Msg 1');
        expect(mainTable.chatMessages[49].text).toBe('Message 51');
        expect(res.status).toHaveBeenCalledWith(200);
    });
    
});


describe("Ranked Matchmaking Controller Tests", () => {
    let req, res, mockIo;
    let originalTables;

    beforeEach(() => {
        jest.clearAllMocks();

        // Preserve existing tables, including custom tables.
        originalTables = new Map(tableManager.tables);
        tableManager.tables.clear();

        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        };

        req = {
            params: {},
            query: {},
            body: {},
            session: {},
            app: {
                get: jest.fn((key) =>
                    key === "io" ? mockIo : null
                )
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    afterEach(() => {
        // Restore the tables that existed before each test.
        tableManager.tables.clear();

        for (const [id, table] of originalTables) {
            tableManager.tables.set(id, table);
        }
    });

    async function rankedJoin(playerId, skillLevel = "beginner") {
        res.status.mockClear();
        res.json.mockClear();

        req.body = { playerId, skillLevel };

        await joinRankedTable(req, res);

        const response = res.json.mock.calls.at(-1)[0];

        return {
            status: res.status.mock.calls.at(-1)[0],
            response,
            table: response.tableId
                ? tableManager.getTable(response.tableId)
                : null
        };
    }

    test("Nine ranked players join the same table", async () => {
        const tableIds = [];

        for (let i = 1; i <= 9; i++) {
            const result = await rankedJoin(`Guest_Rank${i}`);

            expect(result.status).toBe(200);
            expect(result.response.isPlayer).toBe(true);

            tableIds.push(result.response.tableId);
        }

        expect(new Set(tableIds).size).toBe(1);

        const table = tableManager.getTable(tableIds[0]);

        expect(table.getPlayerCount()).toBe(9);
        expect(table.isFull()).toBe(true);
        expect(table.getSpectatorCount()).toBe(0);
    });

    test("Tenth ranked player joins a new table", async () => {
        let firstTableId;

        for (let i = 1; i <= 9; i++) {
            const result = await rankedJoin(`Guest_Rank${i}`);
            expect(result.status).toBe(200);

            firstTableId = result.response.tableId;
        }

        const tenth = await rankedJoin("Guest_Rank10");

        expect(tenth.status).toBe(200);
        expect(tenth.response.tableId).not.toBe(firstTableId);

        const firstTable = tableManager.getTable(firstTableId);
        const secondTable = tenth.table;

        expect(firstTable.getPlayerCount()).toBe(9);
        expect(secondTable.getPlayerCount()).toBe(1);

        expect(secondTable.players).toContain("Guest_Rank10");
        expect(firstTable.players).not.toContain("Guest_Rank10");
    });

    test("Players cannot join a ranked game in progress", async () => {
        const first = await rankedJoin("Guest_A");
        await rankedJoin("Guest_B");

        const firstTable = first.table;

        expect(firstTable.startGame().success).toBe(true);
        expect(firstTable.gameInProgress).toBe(true);

        const third = await rankedJoin("Guest_C");

        expect(third.status).toBe(200);
        expect(third.response.tableId).not.toBe(firstTable.tableId);

        expect(firstTable.players).not.toContain("Guest_C");
        expect(third.table.players).toContain("Guest_C");
    });

    test("Different skill levels have separate ranked tables", async () => {
        const beginner = await rankedJoin("Guest_Beginner", "beginner");
        const intermediate = await rankedJoin("Guest_Intermediate", "intermediate");
        const advanced = await rankedJoin("Guest_Advanced", "advanced");

        expect(beginner.status).toBe(200);
        expect(intermediate.status).toBe(200);
        expect(advanced.status).toBe(200);

        const ids = [
            beginner.response.tableId,
            intermediate.response.tableId,
            advanced.response.tableId
        ];

        expect(new Set(ids).size).toBe(3);

        expect(beginner.table.skillLevel).toBe("beginner");
        expect(intermediate.table.skillLevel).toBe("intermediate");
        expect(advanced.table.skillLevel).toBe("advanced");
    });

    test("Duplicate ranked joins do not create another player", async () => {
        const first = await rankedJoin("Guest_Duplicate");
        const second = await rankedJoin("Guest_Duplicate");

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);

        expect(second.response.tableId).toBe(first.response.tableId);
        expect(first.table.getPlayerCount()).toBe(1);
    });

    test("Direct joining of ranked tables is rejected", async () => {
        const ranked = tableManager.getOrCreateRankedTable("beginner");

        req.body = {
            tableId: ranked.tableId,
            playerId: "Guest_DirectJoin"
        };

        await joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(ranked.players).not.toContain("Guest_DirectJoin");
    });

    test("Ranked joining does not modify custom tables", async () => {
        const custom = tableManager.createTable(
            "general", 30, "custom"
        );

        custom.addPlayer("Guest_CustomPlayer");

        const ranked = await rankedJoin("Guest_RankedPlayer");

        expect(ranked.status).toBe(200);
        expect(ranked.table.tableId).not.toBe(custom.tableId);

        expect(custom.players).toEqual(["Guest_CustomPlayer"]);
        expect(custom.gameMode).toBe("custom");
        expect(ranked.table.gameMode).toBe("ranked");
    });

    test("Invalid ranked skill level is rejected", async () => {
        const result = await rankedJoin("Guest_Invalid", "general");

        expect(result.status).toBe(400);
        expect(result.response.error).toBe("Invalid ranked skill level.");
    });

    test("Missing ranked player ID is rejected", async () => {
        const result = await rankedJoin("", "beginner");

        expect(result.status).toBe(400);
        expect(result.response.error).toBe("Player ID is required.");
    });

    test("Ranked joins broadcast updates to the correct table", async () => {
        const result = await rankedJoin("Guest_Broadcast");

        expect(result.status).toBe(200);

        expect(mockIo.emit).toHaveBeenCalledWith(
            "TABLE_UPDATED",
            { tableId: result.response.tableId }
        );
    });
});

// ============================================================================
// ADDITIONAL TABLE CONTROLLER TESTS
// ============================================================================

describe('Additional Table Controller Tests', () => {
    const controller = require('../controller/tableController.js');
    const UserDao = require('../model/UserDao');

    let req, res, io, table, originalTables;

    const settings = {
        tableName: ' Friday Poker ',
        maxPlayers: 4,
        buyIn: 100,
        smallBlind: 1,
        bigBlind: 2,
        visibility: 'public'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        UserDao.findOne.mockReset().mockResolvedValue(null);

        // Preserve existing tables
        originalTables = new Map(tableManager.tables);
        tableManager.tables.clear();

        // Create a fresh custom table for each test
        table = tableManager.createTable(
            'general', 30, 'custom', 4, 1, 2
        );

        io = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        };

        req = {
            params: {},
            query: {},
            body: {},
            session: {},
            app: {
                get: jest.fn().mockReturnValue(io)
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        req.params.tableId = table.tableId;
    });

    afterEach(() => {
        jest.restoreAllMocks();

        UserDao.findOne.mockReset().mockResolvedValue(null);

        // Restore original tables
        tableManager.tables.clear();

        for (const [id, saved] of originalTables) {
            tableManager.tables.set(id, saved);
        }
    });

    // ========================================================================
    // CREATE CUSTOM TABLE
    // ========================================================================

    test.each(['public', 'private'])(
        'createTable creates a %s custom table',
        visibility => {
            req.body = {
                ...settings,
                visibility,
                maxPlayers: '4',
                buyIn: '100'
            };

            controller.createTable(req, res);

            expect(res.status).toHaveBeenLastCalledWith(201);

            const data = res.json.mock.calls.at(-1)[0];
            const created = tableManager.getTable(data.tableId);

            expect(created).toMatchObject({
                tableName: 'Friday Poker',
                gameMode: 'custom',
                maxPlayers: 4,
                buyIn: 100,
                visibility
            });

            expect(created.chatMessages).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        sender: 'Dealer'
                    })
                ])
            );

            expect(io.emit).toHaveBeenCalledWith(
                'TABLE_UPDATED',
                { tableId: data.tableId }
            );
        }
    );

    test.each([
        [
            { tableName: '' },
            'Missing required table settings.'
        ],
        [
            { maxPlayers: undefined },
            'Missing required table settings.'
        ],
        [
            { buyIn: undefined },
            'Missing required table settings.'
        ],
        [
            { smallBlind: undefined },
            'Missing required table settings.'
        ],
        [
            { bigBlind: undefined },
            'Missing required table settings.'
        ],
        [
            { tableName: '   ' },
            'Invalid table name.'
        ],
        [
            { tableName: 123 },
            'Invalid table name.'
        ],
        [
            { maxPlayers: 2.5 },
            'Invalid table settings.'
        ],
        [
            { maxPlayers: 1 },
            'Invalid table settings.'
        ],
        [
            { maxPlayers: 10 },
            'Invalid table settings.'
        ],
        [
            { buyIn: 'abc' },
            'Invalid table settings.'
        ],
        [
            { smallBlind: 'abc' },
            'Invalid table settings.'
        ],
        [
            { bigBlind: 'abc' },
            'Invalid table settings.'
        ],
        [
            { buyIn: -1 },
            'Invalid table settings.'
        ],
        [
            { smallBlind: -1 },
            'Invalid table settings.'
        ],
        [
            { bigBlind: 1 },
            'Invalid table settings.'
        ],
        [
            { smallBlind: 2, bigBlind: 3, buyIn: 2 },
            'Invalid table settings.'
        ],
        [
            { visibility: 'unknown' },
            'Invalid table visibility.'
        ]
    ])(
        'createTable rejects invalid settings %j',
        (changes, error) => {
            const count = tableManager.tables.size;

            req.body = {
                ...settings,
                ...changes
            };

            controller.createTable(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith({ error });

            // Invalid tables should not be created
            expect(tableManager.tables.size).toBe(count);

            // No update should be broadcast
            expect(io.emit).not.toHaveBeenCalled();
        }
    );

    // ========================================================================
    // PUBLIC CUSTOM TABLES
    // ========================================================================

    test('getPublicTables returns table configuration and player count', () => {
        Object.assign(table, {
            tableName: 'Public Poker',
            buyIn: 100,
            visibility: 'public'
        });

        table.addPlayer('Guest_Public', 1000);

        const privateTable = tableManager.createTable(
            'general', 30, 'custom'
        );

        privateTable.visibility = 'private';

        const ranked = tableManager.getOrCreateRankedTable(
            'beginner'
        );

        controller.getPublicTables(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);

        const data = res.json.mock.calls.at(-1)[0];

        expect(data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    tableId: table.tableId,
                    tableName: 'Public Poker',
                    gameMode: 'custom',
                    playerCount: 1,
                    maxPlayers: 4,
                    smallBlind: 1,
                    bigBlind: 2,
                    buyIn: 100,
                    visibility: 'public',
                    gameInProgress: false,
                    isFull: false
                })
            ])
        );

        // Private tables should not appear in the public lobby
        expect(data.map(t => t.tableId))
            .not.toContain(privateTable.tableId);

        // Ranked tables should not appear as custom tables
        expect(data.map(t => t.tableId))
            .not.toContain(ranked.tableId);
    });

    test('getPublicTables returns an empty array when there are no public tables', () => {
        tableManager.tables.clear();

        controller.getPublicTables(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);
        expect(res.json).toHaveBeenLastCalledWith([]);
    });

    // ========================================================================
    // RANKED PLAYER COUNTS
    // ========================================================================

    test('getRankedPlayerCounts totals multiple tables and excludes custom players', async () => {
        table.addPlayer('Guest_Custom', 1000);

        const queues = [
            ['beginner', 10],
            ['intermediate', 2],
            ['advanced', 1]
        ];

        for (const [skillLevel, count] of queues) {
            for (let i = 0; i < count; i++) {
                req.body = {
                    playerId: `Guest_${skillLevel}_${i}`,
                    skillLevel
                };

                await controller.joinRankedTable(req, res);

                expect(res.status)
                    .toHaveBeenLastCalledWith(200);
            }
        }

        controller.getRankedPlayerCounts(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);

        expect(res.json).toHaveBeenLastCalledWith({
            beginner: 10,
            intermediate: 2,
            advanced: 1
        });
    });

    test('getRankedPlayerCounts returns zero for empty queues', () => {
        controller.getRankedPlayerCounts(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);

        expect(res.json).toHaveBeenLastCalledWith({
            beginner: 0,
            intermediate: 0,
            advanced: 0
        });
    });

    // ========================================================================
    // MUCK PREFERENCES
    // ========================================================================

    test.each([true, false])(
        'updateMuckPreference sets preference to %s',
        muckPreference => {
            table.addPlayer('Guest_Muck', 1000);

            const player = table.playerManager.getPlayer(
                'Guest_Muck'
            );

            player.muckPreference = !muckPreference;

            req.body = {
                playerId: 'Guest_Muck',
                muckPreference
            };

            controller.updateMuckPreference(req, res);

            expect(player.muckPreference).toBe(muckPreference);

            expect(res.status).toHaveBeenLastCalledWith(200);

            expect(res.json).toHaveBeenLastCalledWith({
                success: true,
                muckPreference
            });
        }
    );

    test.each([
        { playerId: 12, muckPreference: true },
        { playerId: 'Guest_A', muckPreference: 'true' }
    ])(
        'updateMuckPreference rejects invalid body %j',
        body => {
            req.body = body;

            controller.updateMuckPreference(req, res);

            expect(res.status).toHaveBeenLastCalledWith(400);

            expect(res.json).toHaveBeenLastCalledWith({
                error: 'Invalid muck preference.'
            });
        }
    );

    test('updateMuckPreference rejects an unknown player', () => {
        req.body = {
            playerId: 'Guest_Unknown',
            muckPreference: true
        };

        controller.updateMuckPreference(req, res);

        expect(res.status).toHaveBeenLastCalledWith(404);

        expect(res.json).toHaveBeenLastCalledWith({
            error: 'Player not found at table.'
        });
    });

    // ========================================================================
    // INVALID TABLE IDs
    // ========================================================================

    test.each([
        'getTableStatus',
        'startGame',
        'finishGame',
        'nextRound',
        'updateMuckPreference'
    ])(
        '%s returns 404 for an unknown table',
        method => {
            req.params.tableId = 'missing-table';

            controller[method](req, res);

            expect(res.status).toHaveBeenLastCalledWith(404);

            expect(res.json).toHaveBeenLastCalledWith({
                error: 'Table not found.'
            });
        }
    );

    // ========================================================================
    // REGISTERED USER CHIPS AND AVATARS
    // ========================================================================

    test.each(['custom', 'ranked'])(
        '%s join loads registered user chips and avatar',
        async mode => {
            UserDao.findOne.mockResolvedValue({
                points: 1234.9,
                avatar: 'blossom'
            });

            req.body = {
                playerId: ' Alice ',
                skillLevel: 'beginner'
            };

            const method = mode === 'custom'
                ? 'joinTable'
                : 'joinRankedTable';

            await controller[method](req, res);

            expect(res.status).toHaveBeenLastCalledWith(200);

            const data = res.json.mock.calls.at(-1)[0];

            const joined = tableManager.getTable(data.tableId);

            expect(
                joined.playerManager.getPlayer('Alice')
            ).toMatchObject({
                chips: 1234,
                avatar: 'blossom'
            });

            expect(UserDao.findOne).toHaveBeenCalledWith({
                $or: [
                    { username: 'Alice' },
                    { email: 'Alice' }
                ]
            });
        }
    );

    test.each(['custom', 'ranked'])(
        '%s join falls back to defaults on database error',
        async mode => {
            jest.spyOn(console, 'error')
                .mockImplementation(() => {});

            UserDao.findOne.mockRejectedValue(
                new Error('Database unavailable')
            );

            req.body = {
                playerId: 'Alice',
                skillLevel: 'beginner'
            };

            const method = mode === 'custom'
                ? 'joinTable'
                : 'joinRankedTable';

            await controller[method](req, res);

            expect(res.status).toHaveBeenLastCalledWith(200);

            const data = res.json.mock.calls.at(-1)[0];

            const joined = tableManager.getTable(data.tableId);

            expect(
                joined.playerManager.getPlayer('Alice')
            ).toMatchObject({
                chips: 1000,
                avatar: 'default'
            });
        }
    );

    // ========================================================================
    // CUSTOM TABLE CAPACITY
    // ========================================================================

    test('joinTable rejects a full custom table', async () => {
        // Fill all four available seats
        for (let i = 0; i < 4; i++) {
            table.addPlayer(`Guest_Full${i}`, 1000);
        }

        req.body = {
            playerId: 'Guest_Overflow'
        };

        await controller.joinTable(req, res);

        expect(res.status).toHaveBeenLastCalledWith(409);

        expect(res.json).toHaveBeenLastCalledWith({
            error: 'This custom table is full.'
        });

        expect(table.hasPlayer('Guest_Overflow')).toBe(false);
        expect(table.getPlayerCount()).toBe(4);
    });

    test('joinTable checks capacity again after database lookup', async () => {
        // Simulate a table filling while the database is queried
        jest.spyOn(table, 'isFull')
            .mockReturnValueOnce(false)
            .mockReturnValue(true);

        req.body = {
            playerId: 'Alice'
        };

        await controller.joinTable(req, res);

        expect(UserDao.findOne).toHaveBeenCalled();

        expect(res.status).toHaveBeenLastCalledWith(409);

        expect(res.json).toHaveBeenLastCalledWith({
            error: 'This custom table is full.'
        });

        expect(table.hasPlayer('Alice')).toBe(false);
    });

    // ========================================================================
    // RANKED MATCHMAKING FAILURE HANDLING
    // ========================================================================

    test.each([
        'full',
        'in progress',
        'add failed'
    ])(
        'ranked join handles %s table',
        async condition => {
            const ranked = tableManager.getOrCreateRankedTable(
                'beginner'
            );

            jest.spyOn(
                tableManager,
                'getOrCreateRankedTable'
            ).mockReturnValue(ranked);

            if (condition === 'full') {
                jest.spyOn(ranked, 'isFull')
                    .mockReturnValue(true);
            } else if (condition === 'in progress') {
                ranked.gameInProgress = true;
            } else {
                jest.spyOn(ranked, 'addPlayer')
                    .mockReturnValue(false);
            }

            req.body = {
                playerId: 'Guest_Rejected',
                skillLevel: 'beginner'
            };

            await controller.joinRankedTable(req, res);

            expect(res.status).toHaveBeenLastCalledWith(409);

            const error = condition === 'add failed'
                ? 'Could not join ranked table.'
                : 'Ranked table is no longer available.';

            expect(res.json).toHaveBeenLastCalledWith({
                error
            });

            expect(io.emit).not.toHaveBeenCalled();
        }
    );

    // ========================================================================
    // CHAT ISOLATION
    // ========================================================================

    test('chat is isolated between tables and works without sockets', () => {
        const other = tableManager.createTable(
            'general', 30, 'custom'
        );

        req.app.get.mockReturnValue(null);

        req.body = {
            playerId: ' Guest_Chat ',
            message: ' Hello! '
        };

        controller.postChatMessage(req, res);

        expect(res.status).toHaveBeenLastCalledWith(200);

        expect(table.chatMessages.at(-1)).toMatchObject({
            sender: 'Guest_Chat',
            text: 'Hello!'
        });

        // Message should not appear at the other table
        expect(other.chatMessages || []).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    text: 'Hello!'
                })
            ])
        );
    });

    // ========================================================================
    // PLAYER ACTION AND MUCK INTEGRATION
    // ========================================================================

    test('playerAction passes numeric amount and updates muck preference', () => {
        table.addPlayer('Guest_Action', 1000);

        const spy = jest.spyOn(table, 'recordAction')
            .mockReturnValue({
                success: true
            });

        req.body = {
            playerId: 'Guest_Action',
            action: 'Raise',
            amount: '50',
            muckPreference: false
        };

        controller.playerAction(req, res);

        expect(spy).toHaveBeenCalledWith(
            'Guest_Action',
            'Raise',
            50
        );

        expect(
            table.playerManager.getPlayer('Guest_Action')
                .muckPreference
        ).toBe(false);

        expect(res.status).toHaveBeenLastCalledWith(200);
    });

    // ========================================================================
    // BETTING PERMISSIONS AND RAISE LIMITS
    // ========================================================================

    test.each([
        [0, 0, 100, true, false, true],
        [2, 0, 1, false, true, false],
        [2, 0, 0, false, false, false]
    ])(
        'getTableStatus calculates betting permissions (highest=%i, bet=%i, chips=%i)',
        (
            highest,
            bet,
            chips,
            canCheck,
            canCall,
            canRaise
        ) => {
            table.addPlayer('Guest_Turn', 1000);

            const player = table.playerManager.getPlayer(
                'Guest_Turn'
            );

            Object.assign(player, {
                chips,
                currentBet: bet,
                hasActed: false
            });

            table.gameInProgress = true;
            table.currentTurnIndex = 0;
            table.currentHighestBet = highest;

            jest.spyOn(table, 'checkTimeout')
                .mockImplementation(() => {});

            jest.spyOn(table, 'dealHandToPlayer')
                .mockReturnValue([]);

            jest.spyOn(table, 'displayCards')
                .mockReturnValue([]);

            req.query.playerId = 'Guest_Turn';

            controller.getTableStatus(req, res);

            expect(res.status).toHaveBeenLastCalledWith(200);

            expect(res.json).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    isCurrentTurn: true,
                    buttonsBlocked: false,
                    canCheck,
                    canCall,
                    canRaise,
                    minRaise: highest === 0 ? 2 : highest + 2,
                    maxRaise: bet + chips
                })
            );
        }
    );
});

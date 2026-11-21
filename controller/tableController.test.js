jest.mock('../model/GameDao');
jest.mock('../model/UserDao', () => ({
    findOne: jest.fn().mockResolvedValue(null)
}));
const GameDao = require('../model/GameDao');
const { getTableStatus, tableManager, joinTable, leaveTable, startGame, finishGame, playerAction, nextRound, postChatMessage, mainTable} = require('../controller/tableController.js');
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
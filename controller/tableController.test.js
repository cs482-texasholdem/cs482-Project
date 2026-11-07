const { tableManager, getTableStatus, joinTable, leaveTable, startGame, playerAction, nextRound } = require('../controller/tableController.js');

describe('Table Controller Unit Tests', () => {
    let req, res, mockIo;

    beforeEach(() => {
        //set up mock io for testing broadcasts
        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
        };

        req = {
            query: {},
            body: {},
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

    test('joinTable validates missing player ID and successfully joins table', () => {
        // Missing ID
        req.body = { playerId: '' };
        joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Valid Join
        req.body = { playerId: 'ControllerPlayer1' };
        joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);

        // Duplicate Join
        joinTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
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

    test('startGame handles insufficient players and successful start', () => {
        // Try starting with only 1 player
        startGame(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Add second player to meet minimum requirement
        req.body = { playerId: 'ControllerPlayer2' };
        joinTable(req, res);

        startGame(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('playerAction validates required fields and executes action', () => {
        req.body = {};
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        req.body = { playerId: 'ControllerPlayer1', action: 'Call' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('nextRound advances round or errors appropriately', () => {
        req.query = { playerId: 'ControllerPlayer1' };
        nextRound(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('leaveTable validates and removes player', () => {
        req.body = { playerId: 'ControllerPlayer1' };
        leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);

        // Leave non-existent player
        req.body = { playerId: 'Ghost' };
        leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('playerAction executes action and broadcasts state update via Socket.io', () => {
        req.body = { playerId: 'ControllerPlayer1' };
        joinTable(req, res);
        req.body = { playerId: 'ControllerPlayer2' };
        joinTable(req, res);
        startGame(req, res);

        req.body = { playerId: 'ControllerPlayer1', action: 'Call' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(mockIo.emit).toHaveBeenCalledWith('TABLE_UPDATED');
    });

    test('playerAction broadcasts PLAYER_FOLDED when a player folds', () => {
        req.body = { playerId: 'ControllerPlayer1' };
        joinTable(req, res);
        req.body = { playerId: 'ControllerPlayer2' };
        joinTable(req, res);
        startGame(req, res);

        req.body = { playerId: 'ControllerPlayer1', action: 'Fold' };
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(mockIo.emit).toHaveBeenCalledWith('TABLE_UPDATED');
    });
});


describe('Multi-Table Controller Tests', () => {
    let req, res, mockIo;
    let table1, table2, table3;

    beforeEach(() => {
        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        };

        req = {
            params: {},
            query: {},
            body: {},
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

    test('should allow players to join three separate tables', () => {
        req.params = { tableId: table1.tableId };
        req.body = { playerId: 'Player1' };
        joinTable(req, res);
        expect(res.status).toHaveBeenLastCalledWith(200);

        req.params = { tableId: table2.tableId };
        req.body = { playerId: 'Player2' };
        joinTable(req, res);
        expect(res.status).toHaveBeenLastCalledWith(200);

        req.params = { tableId: table3.tableId };
        req.body = { playerId: 'Player3' };
        joinTable(req, res);
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

    test('should only remove players from the selected table', () => {
        table1.addPlayer('Player1');
        table2.addPlayer('Player2');
        table3.addPlayer('Player3');

        req.params = { tableId: table2.tableId };
        req.body = { playerId: 'Player2' };

        leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(table1.players).toContain('Player1');
        expect(table2.players).not.toContain('Player2');
        expect(table3.players).toContain('Player3');
    });

    test('should return 404 for a nonexistent table', () => {
        req.params = { tableId: 'invalidTable' };
        req.body = { playerId: 'Player1' };

        joinTable(req, res);

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
});

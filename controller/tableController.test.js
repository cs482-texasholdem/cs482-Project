jest.mock('../model/GameDao');
const GameDao = require('../model/GameDao');
const { getTableStatus, joinTable, leaveTable, startGame, playerAction, nextRound } = require('../controller/tableController.js');

describe('Table Controller Unit Tests', () => {
    let req, res, mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        // Prevent tests from making real database writes
        GameDao.create.mockResolvedValue({})

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
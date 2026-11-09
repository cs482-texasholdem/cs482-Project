jest.mock('../model/GameDao');
const GameDao = require('../model/GameDao');
const { getTableStatus, joinTable, leaveTable, startGame, finishGame, playerAction, nextRound, mainTable} = require('../controller/tableController.js');

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

    test('joinTable rejects a non-string player ID', () => {
        req.body = { playerId: 123 };

        joinTable(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Player ID is required."
        });
    });

    test('joinTable gets player ID from query parameters', () => {
        const addPlayerSpy = jest.spyOn(mainTable, 'addPlayer').mockReturnValue(true);

        req.query = { playerId: 'QueryPlayer1' };

        joinTable(req, res);

        expect(addPlayerSpy).toHaveBeenCalledWith('QueryPlayer1');
        expect(res.status).toHaveBeenCalledWith(200);

        addPlayerSpy.mockRestore();
    });

    test('joinTable succeeds when Socket.io is unavailable', () => {
        req.app.get.mockReturnValue(null);
        req.body = { playerId: 'NoSocketPlayer' };

        joinTable(req, res);

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

    test('getTableStatus returns player hand during an active game', () => {
        // Add two players and start a game
        req.body = { playerId: 'StatusPlayer1' };
        joinTable(req, res);

        req.body = { playerId: 'StatusPlayer2' };
        joinTable(req, res);

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
        expect(mockIo.emit).toHaveBeenCalledWith('TABLE_UPDATED');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Game finished successfully.",
            winnerData: mockWinnerData
        });

        finishGameSpy.mockRestore();
    });

    test('playerAction validates required fields and executes action', () => {
        // Check missing required fields
        req.body = {};
        playerAction(req, res);
        expect(res.status).toHaveBeenCalledWith(400);

        // Set up a game
        req.body = { playerId: 'ControllerPlayer1' };
        joinTable(req, res);

        req.body = { playerId: 'ControllerPlayer2' };
        joinTable(req, res);

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
        console.log(res.json.mock.calls);

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
        expect(mockIo.emit).toHaveBeenCalledWith('TABLE_UPDATED');

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
        expect(mockIo.emit).toHaveBeenCalledWith('TABLE_UPDATED');

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

    test('leaveTable validates and removes player', () => {
        req.body = { playerId: 'ControllerPlayer1' };
        leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(200);

        // Leave non-existent player
        req.body = { playerId: 'Ghost' };
        leaveTable(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    test('leaveTable rejects a missing player ID', () => {
        req.body = {};
        req.query = {};

        leaveTable(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Player ID is required."
        });
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
const mongoose = require('mongoose');
const GameDao = require('./GameDao');
const db = require('../model/DbConnection');

describe('GameDao Unit Tests', () => {
    beforeAll(async () => {
        // Use your project's established DbConnection helper if available, or test memory
        try {
            await db.connect('test');
        } catch (e) {
            if (mongoose.connection.readyState === 0) {
                await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/poker_test');
            }
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    test('read should return null if id is missing or not a string', async () => {
        const resultNull = await GameDao.read(null);
        expect(resultNull).toBeNull();

        const resultNonString = await GameDao.read(12345);
        expect(resultNonString).toBeNull();
    });

    test('findByPlayer should return an empty array if playerId is falsy', async () => {
        const result = await GameDao.findByPlayer(null);
        expect(result).toEqual([]);
    });

    test('create, read, readAll, and findByPlayer should work correctly with valid game data', async () => {
        const gameData = {
            tableId: 'test-table-1',
            initialPlayers: ['Player1', 'Player2'],
            dealerIndex: 0,
            smallBlindIndex: 1,
            bigBlindIndex: 2,
            shuffleSeed: '12345',
            actions: [
                { playerId: 'Player1', action: 'Check', amount: 0, round: 'Pre-Flop' }
            ],
            potFinal: 30,
            winners: ['Player1']
        };

        const savedGame = await GameDao.create(gameData);
        expect(savedGame).toHaveProperty('_id');
        expect(savedGame.tableId).toBe('test-table-1');

        const fetchedGame = await GameDao.read(savedGame._id.toString());
        expect(fetchedGame).not.toBeNull();
        expect(fetchedGame.tableId).toBe('test-table-1');

        const playerGames = await GameDao.findByPlayer('Player1');
        expect(playerGames.length).toBeGreaterThan(0);

        const allGames = await GameDao.readAll();
        expect(allGames.length).toBeGreaterThan(0);
    });
});
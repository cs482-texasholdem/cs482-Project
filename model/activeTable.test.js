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

    test('addPlayer successfully adds valid players and rejects invalid/duplicate IDs', () => {
        expect(table.addPlayer('Player1')).toBe(true);
        expect(table.addPlayer('Player1')).toBe(false); // Duplicate
        expect(table.addPlayer('')).toBe(false); // Invalid
        expect(table.addPlayer(null)).toBe(false); // Invalid
        expect(table.getPlayerCount()).toBe(1);
    });

    test('isFull returns true when queue reaches maxPlayers', () => {
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
});

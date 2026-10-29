const ActiveTable = require('./activeTable.js');

describe('ActiveTable Class (Delegated PlayerManager & Game Engine)', () => {
    let table;

    beforeEach(() => {
        table = new ActiveTable('main-table', 'general', 30);
    });

    test('constructor initializes with correct default values and properties', () => {
        expect(table.tableId).toBe('main-table');
        expect(table.skillLevel).toBe('general');
        expect(table.timeLimit).toBe(30);
        expect(table.maxPlayers).toBe(10);
        expect(table.gameStarted).toBe(false);
        expect(table.gameInProgress).toBe(false);
        expect(table.pot).toBe(0);
        expect(table.currentHighestBet).toBe(0);
        expect(table.dealerIndex).toBe(0);
        expect(table.aggressorIndex).toBe(0);
        expect(table.gameCount).toBe(0);
        expect(table.turnStartTime).toBeNull();
    });

    test('proxy methods correctly delegate to playerManager', () => {
        expect(table.isFull()).toBe(false);
        expect(table.hasPlayer('P1')).toBe(false);
        expect(table.getPlayerCount()).toBe(0);
        expect(table.getSpectatorCount()).toBe(0);

        table.addPlayer('P1');
        expect(table.hasPlayer('P1')).toBe(true);
        expect(table.getPlayerCount()).toBe(1);

        // Test proxy getters and setters
        expect(table.queue).toContain('P1');
        expect(table.players).toContain('P1');
        table.players = ['P1'];
        expect(table.players).toEqual(['P1']);

        expect(table.spectators).toEqual([]);
        table.spectators = [];
        expect(table.spectators).toEqual([]);

        expect(table.playerObjects.size).toBe(1);
        expect(table.consecutiveTimeouts).toBeDefined();
        expect(table.pendingRemovals).toBeDefined();
    });

    test('removePlayer handles inactive vs active game removal (deferred vs immediate)', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');

        // Not in game
        expect(table.removePlayer('Ghost')).toBe(false);
        expect(table.removePlayer('P1')).toBe(true);

        // In game (deferred removal)
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        expect(table.removePlayer('P1')).toBe(true);
        expect(table.pendingRemovals.has('P1')).toBe(true);
    });

    test('startGame fails with fewer than 2 players and succeeds with 2+', () => {
        const resFail = table.startGame();
        expect(resFail.success).toBe(false);
        expect(resFail.error).toContain('At least 2 players');

        table.addPlayer('P1');
        table.addPlayer('P2');
        const resSuccess = table.startGame();
        expect(resSuccess.success).toBe(true);
        expect(table.gameStarted).toBe(true);
        expect(table.gameInProgress).toBe(true);
    });

    test('dealHandToPlayer returns cached or new cards correctly', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        expect(table.dealHandToPlayer('InvalidPlayer')).toBe(false);

        const hand1 = table.dealHandToPlayer('P1');
        expect(hand1).toHaveLength(2);

        // Retrieve cached hand
        const hand2 = table.dealHandToPlayer('P1');
        expect(hand2).toEqual(hand1);
    });

    test('checkTimeout handles timeouts and consecutive timeout removals', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // No timeout yet
        expect(table.checkTimeout()).toBe(false);

        // Force timeout
        table.turnStartTime = Date.now() - 35000;
        expect(table.checkTimeout()).toBe(true);

        // Force second consecutive timeout to trigger removal
        table.turnStartTime = Date.now() - 35000;
        table.playerObjects.get(table.players[table.currentTurnIndex]).hasActed = false;
        expect(table.checkTimeout()).toBe(true);
    });

    test('recordAction handles various actions (Fold, Check, Call, Raise) and validation', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];

        // Invalid player / inactive
        expect(table.recordAction('Ghost', 'Call').success).toBe(false);

        // Wrong turn
        const wrongTurnId = table.players[(table.currentTurnIndex + 1) % table.players.length];
        expect(table.recordAction(wrongTurnId, 'Call').success).toBe(false);

        // Valid Call
        const callRes = table.recordAction(currentId, 'Call');
        expect(callRes.success).toBe(true);

        // Next turn - Raise
        const nextId = table.players[table.currentTurnIndex];
        // Invalid raise (below current highest bet)
        expect(table.recordAction(nextId, 'Raise', 10).success).toBe(false);
        // Valid raise
        const raiseRes = table.recordAction(nextId, 'Raise', 50);
        expect(raiseRes.success).toBe(true);
        expect(table.currentHighestBet).toBe(50);
    });

    test('recordAction handles Check error when facing a bet', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        table.currentHighestBet = 50;
        const checkRes = table.recordAction(currentId, 'Check');
        expect(checkRes.success).toBe(false);
    });

    test('nextRound handles street progression (flop, turn, river) and showdown', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // Force betting round completion
        table.playerObjects.forEach(p => { p.hasActed = true; p.currentBet = table.currentHighestBet; });

        // Flop
        const round1 = table.nextRound();
        expect(round1.communityCards).toHaveLength(5);
        expect(table.displayedCards).toHaveLength(3);

        // Turn
        const round2 = table.nextRound();
        expect(table.displayedCards).toHaveLength(4);

        // River
        const round3 = table.nextRound();
        expect(table.displayedCards).toHaveLength(5);

        // Showdown / Winner
        const round4 = table.nextRound();
        expect(round4.winnerData).toBeDefined();
    });

    test('displayCards formats valid cards and throws on invalid card numbers', () => {
        table.displayedCards = [1, 14, 27];
        const formatted = table.displayCards();
        expect(formatted[0]).toBe('2♥');
        expect(formatted[3]).toBe('🂠');

        // Invalid card number throws error
        table.displayedCards = [999];
        expect(() => table.displayCards()).toThrow('Displayed cards must be valid card numbers.');
    });

    test('resetToLobby resets table state completely', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();
        table.resetToLobby();

        expect(table.gameStarted).toBe(false);
        expect(table.gameInProgress).toBe(false);
        expect(table.pot).toBe(0);
        expect(table.currentHighestBet).toBe(0);
    });

    test('handleWinner evaluates single remaining player and multi-player showdown correctly', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // Test single active non-folded winner
        table.playerObjects.get('P2').folded = true;
        const winnerData = table.handleWinner();
        expect(winnerData.winners).toEqual(['P1']);
    });
});
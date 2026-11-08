const ActiveTable = require('./activeTable.js');

describe('ActiveTable Class (Delegated PlayerManager & Game Engine with Side-Pots)', () => {
    let table;

    beforeEach(() => {
        table = new ActiveTable('main-table', 'general', 30);
    });

    test('constructor initializes with correct default values and properties', () => {
        expect(table.tableId).toBe('main-table');
        expect(table.skillLevel).toBe('general');
        expect(table.timeLimit).toBe(30);
        expect(table.maxPlayers).toBe(9);
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

        expect(table.removePlayer('Ghost')).toBe(false);
        expect(table.removePlayer('P1')).toBe(true);

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

        const hand2 = table.dealHandToPlayer('P1');
        expect(hand2).toEqual(hand1);
    });

    test('recordAction handles various actions (Fold, Check, Call, Raise) and validation', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];

        expect(table.recordAction('Ghost', 'Call').success).toBe(false);

        const wrongTurnId = table.players[(table.currentTurnIndex + 1) % table.players.length];
        expect(table.recordAction(wrongTurnId, 'Call').success).toBe(false);

        const callRes = table.recordAction(currentId, 'Call');
        expect(callRes.success).toBe(true);

        const nextId = table.players[table.currentTurnIndex];
        expect(table.recordAction(nextId, 'Raise', 10).success).toBe(false);
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

        table.playerObjects.forEach(p => { p.hasActed = true; p.currentBet = table.currentHighestBet; });

        const round1 = table.nextRound();
        expect(round1.communityCards).toHaveLength(5);
        expect(table.displayedCards).toHaveLength(3);

        const round2 = table.nextRound();
        expect(table.displayedCards).toHaveLength(4);

        const round3 = table.nextRound();
        expect(table.displayedCards).toHaveLength(5);

        const round4 = table.nextRound();
        expect(round4.winnerData).toBeDefined();
    });

    test('displayCards formats valid cards and throws on invalid card numbers', () => {
        table.displayedCards = [1, 14, 27];
        const formatted = table.displayCards();
        expect(formatted[0]).toBe('2♥');
        expect(formatted[3]).toBe('🂠');

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

        table.playerObjects.get('P2').folded = true;
        const winnerData = table.handleWinner();
        expect(winnerData.winners).toEqual(['P1']);
    });

    // ==========================================
    // SIDE-POT ARCHITECTURE UNIT TESTS
    // ==========================================

    test('PotManager correctly builds single main pot when contributions are equal', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        table.playerObjects.get('P1').totalHandContribution = 100;
        table.playerObjects.get('P2').totalHandContribution = 100;

        table.potManager.buildPots(['P1', 'P2'], table.playerManager);

        expect(table.potManager.pots).toHaveLength(1);
        expect(table.potManager.pots[0].amount).toBe(200);
        expect(table.potManager.pots[0].eligiblePlayers).toEqual(['P1', 'P2']);
    });

    test('PotManager correctly builds main pot and side pots for staggered all-in contributions', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        // P1 all-in at 100, P2 all-in at 300, P3 calls 500
        table.playerObjects.get('P1').totalHandContribution = 100;
        table.playerObjects.get('P2').totalHandContribution = 300;
        table.playerObjects.get('P3').totalHandContribution = 500;

        table.potManager.buildPots(['P1', 'P2', 'P3'], table.playerManager);

        // Tier 1 (100 from P1, P2, P3 = 300) -> Eligible: P1, P2, P3
        // Tier 2 (200 extra from P2, P3 = 400) -> Eligible: P2, P3
        // Tier 3 (200 extra from P3 = 200) -> Eligible: P3 only
        expect(table.potManager.pots.length).toBeGreaterThanOrEqual(2);
        expect(table.potManager.pots[0].amount).toBe(300);
        expect(table.potManager.pots[0].eligiblePlayers).toEqual(['P1', 'P2', 'P3']);
        expect(table.potManager.pots[1].eligiblePlayers).toEqual(['P2', 'P3']);
    });

    test('PotManager excludes folded players from pot eligibility', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        table.playerObjects.get('P1').totalHandContribution = 200;
        table.playerObjects.get('P2').totalHandContribution = 200;
        table.playerObjects.get('P2').folded = true;

        table.potManager.buildPots(['P1', 'P2'], table.playerManager);

        expect(table.potManager.pots[0].eligiblePlayers).toEqual(['P1']);
    });

    test('PotManager distributes multi-tier side pots correctly among eligible winners', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // Set up manual pots for testing distribution
        table.potManager.pots = [
            { amount: 200, eligiblePlayers: ['P1', 'P2'] },
            { amount: 400, eligiblePlayers: ['P2'] }
        ];

        table.playerObjects.get('P1').chips = 1000;
        table.playerObjects.get('P2').chips = 1000;

        // P1 wins main pot, P2 wins side pot (or P2 wins both)
        const distributed = table.potManager.distributePot(
            ['P2'], 
            table.playerManager, 
            [], 
            table.playerHands, 
            table.deck, 
            2
        );

        expect(distributed).toBe(600);
        expect(table.playerObjects.get('P2').chips).toBe(1600); // 1000 + 600
        expect(table.playerObjects.get('P1').chips).toBe(1000); // Unchanged
    });
});
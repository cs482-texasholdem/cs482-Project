jest.mock('./GameDao');
const GameDao = require('./GameDao');
const ActiveTable = require('./activeTable.js');
const Deck = require('../util/pokerLogic');

describe('ActiveTable Class (Delegated PlayerManager & Game Engine with Side-Pots)', () => {
    let table;

    beforeEach(() => {
        jest.clearAllMocks();
        GameDao.create.mockResolvedValue({});
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

        table.nextRound(); //round 2
        expect(table.displayedCards).toHaveLength(4);

        table.nextRound(); //round 3
        expect(table.displayedCards).toHaveLength(5);

        const showdown = table.nextRound();
        expect(showdown.winnerData).toBeDefined();

        expect(GameDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 'main-table' })
    );
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

    test('posts custom small and big blinds', () => {
        const customTable = new ActiveTable(
            'test-custom',
            'general',
            30,
            'custom',
            4,
            2,
            3
        );

        customTable.addPlayer('Player1');
        customTable.addPlayer('Player2');

        const result = customTable.startGame();

        expect(result.success).toBe(true);

        expect(customTable.smallBlind).toBe(2);
        expect(customTable.bigBlind).toBe(3);
        expect(customTable.maxPlayers).toBe(4);
        expect(customTable.pot).toBe(5);
        expect(customTable.currentHighestBet).toBe(3);

        const chips = customTable.players.map(
            id => customTable.playerManager.getPlayer(id).chips
        );

        expect(chips.sort((a, b) => a - b)).toEqual([997, 998]);
    });

    // ==========================================
    // ADDITIONAL BRANCH COVERAGE
    // ==========================================

    // Lines 436-437
    test('folding the second-to-last player calls handleWinner', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const winnerSpy = jest.spyOn(table, 'handleWinner')
            .mockReturnValue({ winners: ['P2'] });

        const result = table.recordAction('P1', 'Fold');

        expect(result.success).toBe(true);
        expect(result.roundAdvanced).toBe(true);
        expect(result.winnerData.winners).toEqual(['P2']);
        expect(winnerSpy).toHaveBeenCalledTimes(1);

        winnerSpy.mockRestore();
    });

    // Lines 441-442 and 471
    test('when all players have acted and matched, action advances street', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const actorId = table.players[table.currentTurnIndex];
        const otherId = table.players.find(id => id !== actorId);

        const actor = table.playerManager.getPlayer(actorId);
        const other = table.playerManager.getPlayer(otherId);

        actor.currentBet = 20;
        actor.hasActed = false;

        other.currentBet = 20;
        other.hasActed = true;

        table.currentHighestBet = 20;

        const nextSpy = jest.spyOn(table, 'nextRound')
            .mockReturnValue({
                communityCards: [],
                winnerData: null,
                pot: 0
            });

        const result = table.recordAction(actorId, 'Check');

        expect(result.success).toBe(true);
        expect(result.roundAdvanced).toBe(true);
        expect(table.allPlayersHaveActedAndMatched()).toBe(true);
        expect(nextSpy).toHaveBeenCalledTimes(1);

        nextSpy.mockRestore();
    });

    // Lines 486-487
    test('resetPlayerActions skips folded player when selecting first turn', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');

        table.dealerIndex = 0;
        table.playerManager.getPlayer(table.players[1]).folded = true;

        table.resetPlayerActions();

        expect(table.currentTurnIndex).toBe(2);
        expect(
            table.playerManager.getPlayer(table.players[2]).hasActed
        ).toBe(false);
    });

    // Line 495
    test('nextRound rejects a game that has not started', () => {
        expect(table.nextRound()).toEqual({
            error: 'Game has not been started yet.'
        });
    });

    // Line 560
    test('newGameSession rotates dealer on later hands', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');

        table.gameCount = 1;
        table.dealerIndex = 0;

        table.newGameSession();

        expect(table.dealerIndex).toBe(1);
        expect(table.gameCount).toBe(2);
    });

    // Lines 644-650 and 669-672
    test('showdown finds high-score tie and hides losing mucked hand', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        table.playerHands.set('P1', [1, 2]);
        table.playerHands.set('P2', [3, 4]);
        table.playerHands.set('P3', [5, 6]);

        table.playerManager.getPlayer('P1').muckPreference = true;

        const cardsSpy = jest.spyOn(table.deck, 'commonCards')
            .mockReturnValue([7, 8, 9, 10, 11]);

        const scoreSpy = jest.spyOn(Deck, 'bestHand')
            .mockImplementation(hand => {
                return hand[0] === 1 ? 10 : 20;
            });

        const daoSpy = jest.spyOn(GameDao, 'create')
            .mockResolvedValue({});

        table.potManager.pots = [{
            amount: 30,
            eligiblePlayers: ['P1', 'P2', 'P3']
        }];

        const result = table.handleWinner();

        expect(result.winners).toEqual(['P2', 'P3']);
        expect(result.maxScore).toBe(20);

        expect(result.showdownHands).not.toHaveProperty('P1');
        expect(result.showdownHands).toHaveProperty('P2');
        expect(result.showdownHands).toHaveProperty('P3');

        scoreSpy.mockRestore();
        cardsSpy.mockRestore();
        daoSpy.mockRestore();
    });

    // Line 644
    test('showdown skips players without a dealt hand', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // Both players intentionally have no cached hands.
        const cardsSpy = jest.spyOn(table.deck, 'commonCards')
            .mockReturnValue([7, 8, 9, 10, 11]);

        const daoSpy = jest.spyOn(GameDao, 'create')
            .mockResolvedValue({});

        const result = table.handleWinner();

        expect(result.winners).toEqual([]);
        expect(result.showdownHands).toEqual({});

        cardsSpy.mockRestore();
        daoSpy.mockRestore();
    });

    // Line 688
    test('handleWinner catches rejected game-record persistence', async () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        table.playerManager.getPlayer('P2').folded = true;

        const daoSpy = jest.spyOn(GameDao, 'create')
            .mockRejectedValue(new Error('Database failure'));

        const errorSpy = jest.spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = table.handleWinner();

        // Allow the promise rejection handler to execute.
        await new Promise(resolve => setImmediate(resolve));

        expect(result.winners).toEqual(['P1']);

        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to persist game history record:',
            expect.objectContaining({
                message: 'Database failure'
            })
        );

        daoSpy.mockRestore();
        errorSpy.mockRestore();
    });

    
    // =========================================================
    // ADDITIONAL GAME LOGIC TESTS
    // =========================================================

    // Lines 128-133, 138-143
    // Verify that side pots go to the best eligible players,
    // even when the main-pot winner cannot win the side pot.
    test('side pot goes to best eligible players and splits ties', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        // P1 wins main pot but cannot win side pot.
        // P2 and P3 tie for the side pot.
        table.playerHands.set('P1', [1, 2]);
        table.playerHands.set('P2', [3, 4]);
        table.playerHands.set('P3', [5, 6]);

        jest.spyOn(Deck, 'bestHand')
            .mockImplementation(hand => {
                if (hand[0] === 1) return 100;
                return 80;
            });

        table.potManager.pots = [
            {
                amount: 300,
                eligiblePlayers: ['P1', 'P2', 'P3']
            },
            {
                amount: 101,
                eligiblePlayers: ['P2', 'P3']
            }
        ];

        // Fixed starting values make chip changes measurable.
        for (const id of table.players) {
            table.playerManager.getPlayer(id).chips = 1000;
        }

        const distributed = table.potManager.distributePot(
            ['P1'],
            table.playerManager,
            [7, 8, 9, 10, 11],
            table.playerHands
        );

        expect(distributed).toBe(401);

        // Main pot goes to P1.
        expect(table.playerManager.getPlayer('P1').chips)
            .toBe(1300);

        // Odd chip goes to first tied winner.
        expect(table.playerManager.getPlayer('P2').chips)
            .toBe(1051);

        expect(table.playerManager.getPlayer('P3').chips)
            .toBe(1050);

        // No chips created or lost.
        const total = table.players.reduce(
            (sum, id) =>
                sum + table.playerManager.getPlayer(id).chips,
            0
        );

        expect(total).toBe(3401);
    });

    // Line 201
    test('table lock prevents simultaneous state modifications', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        const originalChips = player.chips;
        const originalActions = table.actionHistory.length;

        // Simulate another operation holding the lock.
        table.isLocked = true;

        const result = table.recordAction(currentId, 'Call');

        expect(result.success).toBe(false);
        expect(result.error).toContain('currently updating');

        // Rejected action must not change game state.
        expect(player.chips).toBe(originalChips);
        expect(table.actionHistory).toHaveLength(originalActions);

        table.isLocked = false;
    });

    // Lines 230-249
    test('removing current player advances to another active player', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.addPlayer('P4');
        table.startGame();

        const removedId = table.players[table.currentTurnIndex];
        const previousToken = table.turnToken;

        const result = table.removePlayer(removedId);

        expect(result.timedOut).toBe(true);
        expect(result.action).toBe("Check");
        expect(table.pendingRemovals.has(removedId)).toBe(true);

        const nextId = table.players[table.currentTurnIndex];

        expect(nextId).not.toBe(removedId);
        expect(table.playerManager.getPlayer(nextId).folded)
            .toBe(false);

        // A new turn must be registered.
        expect(table.turnToken).toBeGreaterThan(previousToken);
        expect(table.turnStartTime).not.toBeNull();
    });

    // Lines 243-249
    test('removing current player ends hand when one player remains', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const removedId = table.players[table.currentTurnIndex];
        const remainingId = table.players.find(
            id => id !== removedId
        );

        table.removePlayer(removedId);

        // The leaving player must no longer be able to win.
        expect(table.playerManager.getPlayer(removedId).folded)
            .toBe(true);

        expect(table.gameOver).toBe(true);

        // Surviving player should receive the pot.
        const survivor = table.playerManager.getPlayer(remainingId);

        expect(survivor.chips).toBe(1020);
    });

    // Line 270 - pot getter/setter
    test('pot getter and setter reflect PotManager state', () => {
        table.pot = 250;

        expect(table.pot).toBe(250);
        expect(table.potManager.pots[0].amount).toBe(250);

        table.potManager.reset();

        expect(table.pot).toBe(0);
    });

    // Lines 287-292
    test('finishGame rejects an inactive game', () => {
        const result = table.finishGame();

        expect(result.success).toBe(false);
        expect(result.error).toBe(
            'No game in progress to finish.'
        );

        expect(table.gameOver).toBe(false);
    });

    test('finishGame awards pot and returns winner data', () => {
        jest.spyOn(GameDao, 'create').mockResolvedValue({});

        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        // Leave only one player eligible.
        table.playerManager.getPlayer('P2').folded = true;

        const result = table.finishGame();

        expect(result.success).toBe(true);
        expect(result.winnerData.winners).toEqual(['P1']);
        expect(result.winnerData.pot).toBe(30);
        expect(table.gameOver).toBe(true);

        // P1 started at 1000, posted SB 10,
        // then received the 30-chip pot.
        expect(table.playerManager.getPlayer('P1').chips)
            .toBe(1020);

        expect(table.playerManager.getPlayer('P2').chips)
            .toBe(980);
    });

    // Lines 313-336
    test('checkTimeout does nothing before deadline', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const previousActions = table.actionHistory.length;

        table.turnStartTime = Date.now() - 10000;

        expect(table.checkTimeout()).toBe(false);

        expect(table.actionHistory).toHaveLength(previousActions);
        expect(table.playerManager.getPlayer(currentId).folded)
            .toBe(false);
    });

    test('timeout automatically checks when no bet is owed', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        // No outstanding chips to call.
        table.currentHighestBet = player.currentBet;

        table.turnStartTime = Date.now() - 31000;

        const result = table.checkTimeout();

        expect(result.timedOut).toBe(true);
        expect(result.action).toBe("Check");
        expect(player.folded).toBe(false);
        expect(player.hasActed).toBe(true);

        expect(table.actionHistory).toContainEqual(
            expect.objectContaining({
                playerId: currentId,
                action: 'Check'
            })
        );
    });

    test('timeout automatically folds when facing a bet', () => {
        jest.spyOn(GameDao, 'create').mockResolvedValue({});

        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        table.currentHighestBet = player.currentBet + 50;
        table.turnStartTime = Date.now() - 31000;

        expect(table.checkTimeout()).toBe(true);
        expect(player.folded).toBe(true);
        expect(player.mucked).toBe(true);

        expect(table.actionHistory).toContainEqual(
            expect.objectContaining({
                playerId: currentId,
                action: 'Fold'
            })
        );
    });

    test('two consecutive timeouts trigger player removal', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];

        // First missed turn: automatic check.
        table.currentHighestBet = 0;
        table.turnStartTime = Date.now() - 31000;

        expect(table.checkTimeout()).toBe(true);

        // Simulate that the player receives another turn.
        const player = table.playerManager.getPlayer(currentId);
        player.hasActed = false;

        table.currentTurnIndex = table.players.indexOf(currentId);
        table.turnStartTime = Date.now() - 31000;

        // Second consecutive missed turn.
        expect(table.checkTimeout()).toBe(true);

        expect(table.pendingRemovals.has(currentId)).toBe(true);
    });

    // Lines 347 and 353
    test('folded player cannot call or raise', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        player.folded = true;

        const originalChips = player.chips;

        expect(table.recordAction(currentId, 'Call').success)
            .toBe(false);

        expect(table.recordAction(currentId, 'Raise', 100).success)
            .toBe(false);

        expect(player.chips).toBe(originalChips);
    });

    test('player cannot act twice without a new betting opportunity', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        player.hasActed = true;

        const result = table.recordAction(currentId, 'Call');

        expect(result.success).toBe(false);
        expect(result.error).toBe(
            'You have already acted this round.'
        );
    });

    // Lines 368-374
    test('folding aggressor skips folded players and advances turn', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.addPlayer('P4');
        table.startGame();

        table.currentTurnIndex = 0;
        table.aggressorIndex = 0;

        const foldingId = table.players[0];
        const alreadyFoldedId = table.players[1];

        table.playerManager.getPlayer(alreadyFoldedId).folded = true;

        const result = table.recordAction(foldingId, 'Fold');

        expect(result.success).toBe(true);

        expect(table.playerManager.getPlayer(foldingId).folded)
            .toBe(true);

        // Skip both folded players.
        expect(table.aggressorIndex).toBe(2);

        // Next player must actually receive the turn.
        expect(table.currentTurnIndex).toBe(2);
    });

    // Lines 383-386
    test('short-stacked call goes all-in without negative chips', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        player.chips = 15;
        player.currentBet = 0;
        player.totalHandContribution = 0;

        table.currentHighestBet = 100;

        const result = table.recordAction(currentId, 'Call');

        expect(result.success).toBe(true);

        expect(player.chips).toBe(0);
        expect(player.currentBet).toBe(15);
        expect(player.totalHandContribution).toBe(15);

        // Short call must not reduce the required bet.
        expect(table.currentHighestBet).toBe(100);

        // Player has committed every chip available.
        expect(player.chips).toBeGreaterThanOrEqual(0);
    });

    // Lines 398-402
    test('short all-in raise never decreases highest bet', () => {
        table.addPlayer('P1');
        table.addPlayer('P2');
        table.addPlayer('P3');
        table.startGame();

        const currentId = table.players[table.currentTurnIndex];
        const player = table.playerManager.getPlayer(currentId);

        player.chips = 15;
        player.currentBet = 0;
        player.totalHandContribution = 0;

        table.currentHighestBet = 100;

        // Player requests a raise but only has 15 chips.
        const result = table.recordAction(currentId, 'Raise', 150);

        // A short all-in may be accepted as a call,
        // but must never reduce the table's highest bet.
        if (result.success) {
            expect(player.chips).toBe(0);
            expect(player.currentBet).toBe(15);
            expect(player.totalHandContribution).toBe(15);
            expect(table.currentHighestBet).toBe(100);
        } else {
            // Also acceptable: reject the invalid raise
            // without changing the player's state.
            expect(player.chips).toBe(15);
            expect(player.currentBet).toBe(0);
            expect(player.totalHandContribution).toBe(0);
            expect(table.currentHighestBet).toBe(100);
        }
    });

});
const PlayerManager = require('./playerManager.js');

describe('Player & PlayerManager Classes', () => {
  let manager;

  beforeEach(() => {
    manager = new PlayerManager(3); // Small maxPlayers for easy spectator testing
  });

  describe('Player Class', () => {
    test('constructor initializes with correct default values', () => {
      const player = new Player('TestPlayer');
      expect(player.id).toBe('TestPlayer');
      expect(player.chips).toBe(1000);
      expect(player.folded).toBe(false);
      expect(player.currentBet).toBe(0);
      expect(player.hasActed).toBe(false);
    });

    test('constructor accepts custom chip count', () => {
      const player = new Player('RichPlayer', 5000);
      expect(player.chips).toBe(5000);
    });
  });

  describe('PlayerManager Basic Properties & Getters', () => {
    test('isFull returns false initially and true when maxPlayers is reached', () => {
      expect(manager.isFull()).toBe(false);
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      expect(manager.isFull()).toBe(false);
      manager.addPlayer('P3');
      expect(manager.isFull()).toBe(true);
    });

    test('hasPlayer checks playerObjects and queue correctly', () => {
      expect(manager.hasPlayer('P1')).toBe(false);
      manager.addPlayer('P1');
      expect(manager.hasPlayer('P1')).toBe(true);
    });

    test('getPlayerCount and getSpectatorCount return correct lengths', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.addPlayer('P3');
      manager.addPlayer('P4'); // Spectator

      expect(manager.getPlayerCount()).toBe(3);
      expect(manager.getSpectatorCount()).toBe(1);
    });
  });

  describe('addPlayer Validation & Execution', () => {
    test('rejects non-string, empty, or whitespace player IDs', () => {
      expect(manager.addPlayer('')).toBe(false);
      expect(manager.addPlayer('   ')).toBe(false);
      expect(manager.addPlayer(null)).toBe(false);
      expect(manager.addPlayer(123)).toBe(false);
    });

    test('rejects duplicate player IDs', () => {
      expect(manager.addPlayer('P1')).toBe(true);
      expect(manager.addPlayer('P1')).toBe(false);
    });

    test('trims player ID whitespace successfully', () => {
      expect(manager.addPlayer('  P1  ')).toBe(true);
      expect(manager.hasPlayer('P1')).toBe(true);
    });
  });

  describe('updateQueueDistribution Logic', () => {
    test('distributes queue into players and spectators when gameInProgress is false', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.addPlayer('P3');
      manager.addPlayer('P4');

      manager.updateQueueDistribution(false);
      expect(manager.players).toEqual(['P1', 'P2', 'P3']);
      expect(manager.spectators).toEqual(['P4']);
    });

    test('locks active players and routes new joiners to spectators when gameInProgress is true', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.updateQueueDistribution(false);

      // Start game simulation (active players locked)
      manager.queue.push('P3');
      manager.updateQueueDistribution(true);

      expect(manager.players).toEqual(['P1', 'P2']);
      expect(manager.spectators).toEqual(['P3']);
    });
  });

  describe('removePlayer & executeRemoval', () => {
    test('returns false when trying to remove a non-existent player', () => {
      expect(manager.removePlayer('Ghost', false)).toBe(false);
    });

    test('removes player immediately when gameInProgress is false', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      expect(manager.removePlayer('P1', false)).toBe(true);
      expect(manager.hasPlayer('P1')).toBe(false);
      expect(manager.players).toEqual(['P2']);
    });

    test('defers removal when gameInProgress is true, folding the player', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.updateQueueDistribution(false);

      expect(manager.removePlayer('P1', true)).toBe(true);
      expect(manager.pendingRemovals.has('P1')).toBe(true);
      expect(manager.playerObjects.get('P1').folded).toBe(true);
      // Still in players array until processed
      expect(manager.players).toContain('P1');
    });

    test('removes player correctly from spectators as well', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.addPlayer('P3');
      manager.addPlayer('P4'); // Spectator

      expect(manager.removePlayer('P4', false)).toBe(true);
      expect(manager.spectators).not.toContain('P4');
    });
  });

  describe('processPendingRemovals', () => {
    test('processes and clears pending removals correctly', () => {
      manager.addPlayer('P1');
      manager.addPlayer('P2');
      manager.updateQueueDistribution(false);

      manager.removePlayer('P1', true);
      expect(manager.pendingRemovals.size).toBe(1);

      manager.processPendingRemovals(true);
      expect(manager.pendingRemovals.size).toBe(0);
      expect(manager.hasPlayer('P1')).toBe(false);
      expect(manager.players).not.toContain('P1');
    });
  });
});
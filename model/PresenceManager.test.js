// ============================================================================
// File Name: PresenceManager.test.js
// Purpose: Tests online/offline status and multiple socket connections.
// ============================================================================

describe('Presence Manager Unit Tests', () => {
    let addUser, removeUser, isOnline;

    beforeEach(() => {
        // Reset module to clear onlineUsers before each test
        jest.resetModules();

        ({
            addUser,
            removeUser,
            isOnline
        } = require('./PresenceManager'));
    });

    // ========================================================================
    // ADD USER
    // ========================================================================

    test('addUser adds a new user and returns true', () => {
        expect(addUser('Blossom', 'socket1')).toBe(true);
        expect(isOnline('Blossom')).toBe(true);
    });

    test('addUser returns false when user is already online', () => {
        addUser('Blossom', 'socket1');

        expect(addUser('Blossom', 'socket2')).toBe(false);
        expect(isOnline('Blossom')).toBe(true);
    });

    test('addUser handles all three Powerpuff Girls', () => {
        expect(addUser('Blossom', 'socket1')).toBe(true);
        expect(addUser('Bubbles', 'socket2')).toBe(true);
        expect(addUser('Buttercup', 'socket3')).toBe(true);

        expect(isOnline('Blossom')).toBe(true);
        expect(isOnline('Bubbles')).toBe(true);
        expect(isOnline('Buttercup')).toBe(true);
    });

    test('addUser does not duplicate the same socket connection', () => {
        addUser('Bubbles', 'socket1');

        expect(addUser('Bubbles', 'socket1')).toBe(false);

        expect(removeUser('Bubbles', 'socket1')).toBe(true);
        expect(isOnline('Bubbles')).toBe(false);
    });

    // ========================================================================
    // REMOVE USER
    // ========================================================================

    test('removeUser returns false for an unknown user', () => {
        expect(removeUser('MojoJojo', 'socket1')).toBe(false);
    });

    test('removeUser removes a user with one connection', () => {
        addUser('Buttercup', 'socket1');

        expect(removeUser('Buttercup', 'socket1')).toBe(true);
        expect(isOnline('Buttercup')).toBe(false);
    });

    test('removeUser keeps user online when another socket remains', () => {
        addUser('Blossom', 'socket1');
        addUser('Blossom', 'socket2');

        expect(removeUser('Blossom', 'socket1')).toBe(false);
        expect(isOnline('Blossom')).toBe(true);
    });

    test('removeUser makes user offline after the last socket disconnects', () => {
        addUser('Blossom', 'socket1');
        addUser('Blossom', 'socket2');

        expect(removeUser('Blossom', 'socket1')).toBe(false);
        expect(removeUser('Blossom', 'socket2')).toBe(true);

        expect(isOnline('Blossom')).toBe(false);
    });

    test('removeUser handles an invalid socket ID', () => {
        addUser('Bubbles', 'socket1');

        expect(removeUser('Bubbles', 'invalidSocket')).toBe(false);
        expect(isOnline('Bubbles')).toBe(true);
    });

    test('removeUser handles repeated disconnections', () => {
        addUser('Buttercup', 'socket1');

        expect(removeUser('Buttercup', 'socket1')).toBe(true);
        expect(removeUser('Buttercup', 'socket1')).toBe(false);

        expect(isOnline('Buttercup')).toBe(false);
    });

    test('removeUser does not affect the other Powerpuff Girls', () => {
        addUser('Blossom', 'socket1');
        addUser('Bubbles', 'socket2');
        addUser('Buttercup', 'socket3');

        removeUser('Bubbles', 'socket2');

        expect(isOnline('Blossom')).toBe(true);
        expect(isOnline('Bubbles')).toBe(false);
        expect(isOnline('Buttercup')).toBe(true);
    });

    test('Mojo Jojo cannot remove another users socket', () => {
        addUser('Blossom', 'socket1');
        addUser('MojoJojo', 'socket2');

        expect(removeUser('MojoJojo', 'socket1')).toBe(false);

        expect(isOnline('Blossom')).toBe(true);
        expect(isOnline('MojoJojo')).toBe(true);
    });

    // ========================================================================
    // ONLINE STATUS
    // ========================================================================

    test('isOnline returns false for an unknown user', () => {
        expect(isOnline('HIM')).toBe(false);
    });

    test('isOnline returns true for a connected user', () => {
        addUser('ProfessorUtonium', 'socket1');

        expect(isOnline('ProfessorUtonium')).toBe(true);
    });

    test('isOnline returns false after user disconnects', () => {
        addUser('Mayor', 'socket1');
        removeUser('Mayor', 'socket1');

        expect(isOnline('Mayor')).toBe(false);
    });

    // ========================================================================
    // RECONNECTION AND MULTIPLE CONNECTIONS
    // ========================================================================

    test('Bubbles can reconnect after going offline', () => {
        expect(addUser('Bubbles', 'socket1')).toBe(true);

        expect(removeUser('Bubbles', 'socket1')).toBe(true);
        expect(isOnline('Bubbles')).toBe(false);

        expect(addUser('Bubbles', 'socket2')).toBe(true);
        expect(isOnline('Bubbles')).toBe(true);
    });

    test('Blossom remains online with three separate connections', () => {
        expect(addUser('Blossom', 'socket1')).toBe(true);
        expect(addUser('Blossom', 'socket2')).toBe(false);
        expect(addUser('Blossom', 'socket3')).toBe(false);

        expect(removeUser('Blossom', 'socket1')).toBe(false);
        expect(isOnline('Blossom')).toBe(true);

        expect(removeUser('Blossom', 'socket2')).toBe(false);
        expect(isOnline('Blossom')).toBe(true);

        expect(removeUser('Blossom', 'socket3')).toBe(true);
        expect(isOnline('Blossom')).toBe(false);
    });

    test('The Powerpuff Girls independently connect and disconnect', () => {
        addUser('Blossom', 'socket1');
        addUser('Blossom', 'socket2');
        addUser('Bubbles', 'socket3');
        addUser('Buttercup', 'socket4');

        expect(removeUser('Blossom', 'socket1')).toBe(false);
        expect(removeUser('Bubbles', 'socket3')).toBe(true);

        expect(isOnline('Blossom')).toBe(true);
        expect(isOnline('Bubbles')).toBe(false);
        expect(isOnline('Buttercup')).toBe(true);

        expect(removeUser('Blossom', 'socket2')).toBe(true);
        expect(removeUser('Buttercup', 'socket4')).toBe(true);

        expect(isOnline('Blossom')).toBe(false);
        expect(isOnline('Bubbles')).toBe(false);
        expect(isOnline('Buttercup')).toBe(false);
    });
});
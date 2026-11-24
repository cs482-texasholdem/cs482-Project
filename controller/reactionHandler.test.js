const registerReactionHandler = require("./reactionHandler");

describe("Reaction Handler", () => {
    let io;
    let socket;
    let tableManager;
    let emit;
    let sendReaction;
    let validReaction;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(10000);

        emit = jest.fn();

        io = {
            to: jest.fn().mockReturnValue({ emit })
        };

        socket = {
            on: jest.fn(),
            rooms: new Set(["table_townsville"]),
            request: {
                session: {
                    user: "Blossom"
                }
            }
        };

        tableManager = {
            getTable: jest.fn().mockReturnValue({
                players: ["Blossom", "Bubbles", "Buttercup"]
            })
        };

        validReaction = {
            tableId: "townsville",
            playerId: "Blossom",
            emoji: "😂"
        };

        registerReactionHandler(io, socket, tableManager);

        sendReaction = socket.on.mock.calls.find(
            ([event]) => event === "SEND_REACTION"
        )[1];
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    // Event Registration

    test("should register the SEND_REACTION event", () => {
        expect(socket.on).toHaveBeenCalledWith(
            "SEND_REACTION",
            expect.any(Function)
        );
    });

    // Valid Reactions

    test("should broadcast a valid reaction to the table", () => {
        sendReaction(validReaction);

        expect(tableManager.getTable).toHaveBeenCalledWith(
            "townsville"
        );

        expect(io.to).toHaveBeenCalledWith("table_townsville");

        expect(emit).toHaveBeenCalledWith(
            "PLAYER_REACTION",
            validReaction
        );
    });

    test.each(["😂", "😡", "😎", "😭", "👏", "😮"])(
        "should accept allowed emoji %s",
        (emoji) => {
            sendReaction({
                ...validReaction,
                emoji
            });

            expect(emit).toHaveBeenCalledWith(
                "PLAYER_REACTION",
                {
                    ...validReaction,
                    emoji
                }
            );
        }
    );

    // Invalid Reactions

    test("should reject an unsupported emoji", () => {
        sendReaction({
            ...validReaction,
            emoji: "💀"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject a missing emoji", () => {
        sendReaction({
            tableId: "townsville",
            playerId: "Blossom"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test.each([null, undefined, "Mojo Jojo", 123, true])(
        "should reject invalid reaction data: %p",
        (data) => {
            sendReaction(data);

            expect(emit).not.toHaveBeenCalled();
        }
    );

    test("should reject an invalid table ID", () => {
        sendReaction({
            ...validReaction,
            tableId: 123
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject a missing table ID", () => {
        sendReaction({
            playerId: "Blossom",
            emoji: "😂"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject an invalid player ID", () => {
        sendReaction({
            ...validReaction,
            playerId: 123
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject a missing player ID", () => {
        sendReaction({
            tableId: "townsville",
            emoji: "😂"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    // Table Validation

    test("should reject a reaction from a nonexistent table", () => {
        tableManager.getTable.mockReturnValue(undefined);

        sendReaction({
            ...validReaction,
            tableId: "mojoJojoLair"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject a player who is not seated at the table", () => {
        socket.request.session.user = "MojoJojo";

        sendReaction({
            ...validReaction,
            playerId: "MojoJojo"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    // Registered User Validation

    test("should reject a player impersonating another player", () => {
        // Blossom attempts to send a reaction as Bubbles
        sendReaction({
            ...validReaction,
            playerId: "Bubbles"
        });

        expect(emit).not.toHaveBeenCalled();
    });

    test("should accept a session containing a username object", () => {
        socket.request.session.user = {
            username: "Blossom"
        };

        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledWith(
            "PLAYER_REACTION",
            validReaction
        );
    });

    test("should reject impersonation using an object session", () => {
        socket.request.session.user = {
            username: "Buttercup"
        };

        sendReaction(validReaction);

        expect(emit).not.toHaveBeenCalled();
    });

    // Guest Validation

    test("should allow a valid guest player to react", () => {
        socket.request.session.user = null;

        tableManager.getTable.mockReturnValue({
            players: ["Guest_Bubbles", "Blossom"]
        });

        const guestReaction = {
            ...validReaction,
            playerId: "Guest_Bubbles"
        };

        sendReaction(guestReaction);

        expect(emit).toHaveBeenCalledWith(
            "PLAYER_REACTION",
            guestReaction
        );
    });

    test("should reject an unauthenticated non-guest player", () => {
        socket.request.session.user = null;

        sendReaction(validReaction);

        expect(emit).not.toHaveBeenCalled();
    });

    test("should allow a valid guest without a session", () => {
        delete socket.request.session;

        tableManager.getTable.mockReturnValue({
            players: ["Guest_Buttercup"]
        });

        const guestReaction = {
            ...validReaction,
            playerId: "Guest_Buttercup"
        };

        sendReaction(guestReaction);

        expect(emit).toHaveBeenCalledWith(
            "PLAYER_REACTION",
            guestReaction
        );
    });

    // Socket Room Validation

    test("should reject a socket outside the table room", () => {
        socket.rooms.clear();

        sendReaction(validReaction);

        expect(emit).not.toHaveBeenCalled();
    });

    test("should reject a socket belonging to another table", () => {
        socket.rooms = new Set(["table_mojoJojoLair"]);

        sendReaction(validReaction);

        expect(emit).not.toHaveBeenCalled();
    });

    // Reaction Cooldown

    test("should immediately accept the first reaction", () => {
        jest.setSystemTime(0);

        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledTimes(1);
    });

    test("should prevent immediate reaction spamming", () => {
        sendReaction(validReaction);
        sendReaction(validReaction);
        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledTimes(1);
    });

    test("should reject a reaction before the cooldown ends", () => {
        sendReaction(validReaction);

        jest.advanceTimersByTime(2999);

        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledTimes(1);
    });

    test("should allow another reaction after exactly 3 seconds", () => {
        sendReaction(validReaction);

        jest.advanceTimersByTime(3000);

        sendReaction({
            ...validReaction,
            emoji: "😎"
        });

        expect(emit).toHaveBeenCalledTimes(2);

        expect(emit).toHaveBeenLastCalledWith(
            "PLAYER_REACTION",
            {
                ...validReaction,
                emoji: "😎"
            }
        );
    });

    test("should not restart the cooldown after a rejected reaction", () => {
        sendReaction(validReaction);

        jest.advanceTimersByTime(2000);
        sendReaction(validReaction);

        jest.advanceTimersByTime(1000);
        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledTimes(2);
    });

    test("should not start cooldown for an invalid reaction", () => {
        sendReaction({
            ...validReaction,
            emoji: "💀"
        });

        sendReaction(validReaction);

        expect(emit).toHaveBeenCalledTimes(1);
    });

    // Independent Socket Cooldowns

    test("should maintain separate cooldowns for different sockets", () => {
        const bubblesSocket = {
            on: jest.fn(),
            rooms: new Set(["table_townsville"]),
            request: {
                session: {
                    user: "Bubbles"
                }
            }
        };

        registerReactionHandler(
            io,
            bubblesSocket,
            tableManager
        );

        const bubblesReaction = bubblesSocket.on.mock.calls.find(
            ([event]) => event === "SEND_REACTION"
        )[1];

        // Blossom sends a reaction
        sendReaction(validReaction);

        // Bubbles sends a reaction immediately afterward
        bubblesReaction({
            ...validReaction,
            playerId: "Bubbles",
            emoji: "👏"
        });

        expect(emit).toHaveBeenCalledTimes(2);

        // Neither player can immediately react again
        sendReaction(validReaction);

        bubblesReaction({
            ...validReaction,
            playerId: "Bubbles",
            emoji: "👏"
        });

        expect(emit).toHaveBeenCalledTimes(2);
    });
});
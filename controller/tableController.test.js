const request = require("supertest");
const { app } = require("../app");

describe("Join Table", () => {
    test("joins an existing table successfully", async () => {
        const response = await request(app).post("/api/tables/table1/join").send({ playerId: "testPlayer1" });
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully joined the table.");
        expect(response.body.tableId).toBe("table1");
        expect(response.body.playerCount).toBe(1);
    });

    test("rejects a player who joins the same table twice", async () => {
        await request(app).post("/api/tables/table1/join").send({ playerId: "duplicatePlayer" });
        const response = await request(app).post("/api/tables/table1/join").send({ playerId: "duplicatePlayer" });
        expect(response.status).toBe(409);
        expect(response.body.error).toBe("Player has already joined this table.");
    });

    test("rejects a table that does not exist", async () => {
        const response = await request(app).post("/api/tables/table99/join").send({ playerId: "testPlayer2" });
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("rejects a request without a player ID", async () => {
        const response = await request(app).post("/api/tables/table1/join").send({});
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a blank player ID", async () => {
        const response = await request(app).post("/api/tables/table1/join").send({ playerId: "   " });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a non-string player ID", async () => {
        const response = await request(app).post("/api/tables/table1/join").send({ playerId: 123 });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });
});

describe("Leave Table", () => {
    test("allows a player to leave a table successfully", async () => {
        await request(app).post("/api/tables/table1/join").send({ playerId: "leavingPlayer" });
        const response = await request(app).post("/api/tables/table1/leave").send({ playerId: "leavingPlayer" });
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully left the table.");
        expect(response.body.tableId).toBe("table1");
    });

    test("rejects leaving a table that does not exist", async () => {
        const response = await request(app).post("/api/tables/table99/leave").send({ playerId: "testPlayer" });
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("rejects a request without a player ID", async () => {
        const response = await request(app).post("/api/tables/table1/leave").send({});
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a player who is not at the table", async () => {
        const response = await request(app).post("/api/tables/table1/leave").send({ playerId: "notJoinedPlayer" });
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Player is not in this table.");
    });
});

describe("Demo Hand", () => {
    test("starts a demo hand with six players", async () => {
        const response = await request(app).post("/api/tables/table1/start-demo");
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Demo hand started.");
        expect(response.body.players).toHaveLength(6);
        expect(response.body.currentPlayer).toBe("Blossom");
        expect(response.body.timeLimit).toBe(30);
        expect(response.body.timeRemaining).toBeGreaterThan(0);
    });

    test("rejects starting a demo on a nonexistent table", async () => {
        const response = await request(app).post("/api/tables/table99/start-demo");
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });
});

describe("Table State", () => {
    test("returns the current player and timer", async () => {
        // Start a fresh demo hand first.
        await request(app).post("/api/tables/table1/start-demo");
        const response = await request(app).get("/api/tables/table1/state");
        expect(response.status).toBe(200);
        expect(response.body.tableId).toBe("table1");
        expect(response.body.currentPlayer).toBe("Blossom");
        expect(response.body.currentPlayerIndex).toBe(0);
        expect(response.body.timeLimit).toBe(30);
        expect(response.body.timeRemaining).toBeGreaterThan(0);
        expect(response.body.timeRemaining).toBeLessThanOrEqual(30);
        expect(response.body.foldedPlayers).toEqual([]);
    });

    test("rejects requesting state for a nonexistent table", async () => {
        const response = await request(app).get("/api/tables/table99/state");
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });
});

describe("Deal Test Hand API", () => {
    test("returns 404 for a nonexistent table", async () => {
        const response = await request(app).get("/api/tables/table99/test-cards");
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("deals player hands and community cards", async () => {
        const response = await request(app).get("/api/tables/table2/test-cards");
        expect(response.status).toBe(200);
        expect(response.body.playerHands.length).toBeGreaterThanOrEqual(2);
        expect(response.body.communityCards).toBeDefined();
        expect(response.body.dealerIndex).not.toBeNull();
        expect(response.body.smallBlindIndex).not.toBeNull();
        expect(response.body.bigBlindIndex).not.toBeNull();
    });
});


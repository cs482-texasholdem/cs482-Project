const request = require("supertest");
const { app } = require("../app");

describe("Join Table API", () => {
    test("joins an existing table successfully", async () => {
        const response = await request(app)
            .post("/api/tables/table1/join")
            .send({ playerId: "testPlayer1" });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
            "Successfully joined the table."
        );
        expect(response.body.tableId).toBe("table1");
        expect(response.body.playerCount).toBe(1);
    });

    test("rejects a player who joins the same table twice", async () => {
        await request(app)
            .post("/api/tables/table1/join")
            .send({ playerId: "duplicatePlayer" });

        const response = await request(app)
            .post("/api/tables/table1/join")
            .send({ playerId: "duplicatePlayer" });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe(
            "Player has already joined this table."
        );
    });

    test("rejects a table that does not exist", async () => {
        const response = await request(app)
            .post("/api/tables/table99/join")
            .send({ playerId: "testPlayer2" });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("rejects a request without a player ID", async () => {
        const response = await request(app)
            .post("/api/tables/table1/join")
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a request with non-string player ID", async () => {
        const response = await request(app)
            .post("/api/tables/table1/join")
            .send({ playerId: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });
});

describe("Leave Table API", () => {
    test("allows a player to leave a table successfully", async () => {
        await request(app)
            .post("/api/tables/table1/join")
            .send({ playerId: "leavingPlayer" });

        const response = await request(app)
            .post("/api/tables/table1/leave")
            .send({ playerId: "leavingPlayer" });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
            "Successfully left the table."
        );
        expect(response.body.tableId).toBe("table1");
    });

    test("rejects leaving a table that does not exist", async () => {
        const response = await request(app)
            .post("/api/tables/table99/leave")
            .send({ playerId: "testPlayer" });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("rejects a request without a player ID", async () => {
        const response = await request(app)
            .post("/api/tables/table1/leave")
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a request with non-string player ID", async () => {
        const response = await request(app)
            .post("/api/tables/table1/leave")
            .send({ playerId: 456 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Player ID is required.");
    });

    test("rejects a player who is not at the table", async () => {
        const response = await request(app)
            .post("/api/tables/table1/leave")
            .send({ playerId: "notJoinedPlayer" });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe(
            "Player is not in this table."
        );
    });
});

describe("Table Game Flow APIs", () => {
    test("deals test cards to a player via GET query params", async () => {
        const response = await request(app)
            .get("/api/test-cards?playerId=TestUserCard");

        expect(response.status).toBe(200);
        expect(response.body.playerId).toBe("TestUserCard");
        expect(response.body).toHaveProperty("playerHand");
        expect(response.body).toHaveProperty("communityCards");
    });

    test("deals test cards using default player ID when query param is omitted", async () => {
        const response = await request(app).get("/api/test-cards");

        expect(response.status).toBe(200);
        expect(response.body.playerId).toBe("Player123");
    });

    test("advances round successfully", async () => {
        const response = await request(app).get("/api/next-round");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Advanced to the next round.");
        expect(response.body).toHaveProperty("communityCards");
    });

    test("starts a new game successfully", async () => {
        const response = await request(app).get("/api/new-game?playerId=NewGamePlayer");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("New game started successfully.");
        expect(response.body.playerId).toBe("NewGamePlayer");
        expect(response.body).toHaveProperty("playerHand");
        expect(response.body).toHaveProperty("communityCards");
    });
});
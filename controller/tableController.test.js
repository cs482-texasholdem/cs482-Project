const ActiveTable = require("../model/activeTable");
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

    test("table full", async () => {
        const spy = jest.spyOn(ActiveTable.prototype, "addPlayer").mockReturnValue(false);

        try {
            const response = await request(app)
                .post("/api/tables/table1/join")
                .send({ playerId: "extra-player" });

            expect(response.status).toBe(409);
            expect(response.body.error).toBe("Table is full.");
        
        } finally {
            spy.mockRestore();
        }
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
        const response = await request(app)
            .post("/api/tables/table1/leave")
            .send({ playerId: "notJoinedPlayer" });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe(
            "Player is not in this table."
        );
    });
});

describe("dealTestHand", () => {
    const url = "/api/tables/table1/test-cards";
    
    test("table does not exist", async () => {
        const response = await request(app).get("/api/tables/missing-table/test-cards");
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Table not found.");
    });

    test("returns 400 when there are not enough players", async () => {
        //set value to the randomizer
        const spy = jest.spyOn(ActiveTable.prototype, "rotateDealer") .mockReturnValue(false);

        try {
            const response = await request(app).get("/api/tables/table1/test-cards");
            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Must have at least 2 players in order to start");
        } 
        finally {
            spy.mockRestore();
        }
    });  

    test("returns 200 with game data", async () => {
        const response = await request(app).get("/api/tables/table1/test-cards");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            players: expect.any(Array),
            pot: expect.any(Number),
            currentBet: expect.any(Number),
            dealerIndex: expect.any(Number),
            smallBlindIndex: expect.any(Number),
            bigBlindIndex: expect.any(Number),
            playerHands: expect.any(Array),
            communityCards: expect.any(Array)
        });
    });

});    


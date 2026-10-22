
const request = require("supertest");
const app = require("../app");

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
});

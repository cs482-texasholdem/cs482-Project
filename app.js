const express = require("express");
const { joinTable } = require("./controller/tableController");

const app = express();

app.use(express.json());

app.get("/api", (req, res) => {
    res.json({ message: "Texas Hold'em API is running" });
});

// Join a specific table.
app.post("/api/tables/:tableId/join", joinTable);

module.exports = app;

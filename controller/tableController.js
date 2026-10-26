const ActiveTable = require("../model/activeTable");
const Deck = require("../util/pokerLogic");

const mainTable = new ActiveTable("main", "general");

function getTableStatus(req, res) {
    const playerId = req.query.playerId;
    const inTable = playerId ? mainTable.hasPlayer(playerId) : false;
    const isPlayer = playerId ? mainTable.players.includes(playerId) : false;
    const isSpectator = playerId ? mainTable.spectators.includes(playerId) : false;
    
    let playerChips = 1000;
    let playerBet = 0;
    let playerHand = [];

    if (playerId && mainTable.playerObjects.has(playerId)) {
        const p = mainTable.playerObjects.get(playerId);
        playerChips = p.chips;
        playerBet = p.currentBet;
    }

    if (playerId && isPlayer && mainTable.gameInProgress) {
        let hand = mainTable.dealHandToPlayer(playerId);
        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    const allPlayersData = mainTable.players.map(id => {
        const p = mainTable.playerObjects.get(id);
        return {
            id,
            chips: p ? p.chips : 1000,
            status: p && p.folded ? "Folded" : "Active",
            isCurrent: id === playerId
        };
    });

    const spectatorsData = mainTable.spectators;

    return res.status(200).json({
        tableId: mainTable.tableId,
        skillLevel: mainTable.skillLevel,
        playerCount: mainTable.getPlayerCount(),
        spectatorCount: mainTable.getSpectatorCount(),
        maxPlayers: mainTable.maxPlayers,
        players: allPlayersData,
        spectators: spectatorsData,
        inTable,
        isPlayer,
        isSpectator,
        gameStarted: mainTable.gameStarted,
        gameInProgress: mainTable.gameInProgress,
        pot: mainTable.pot,
        playerChips,
        playerBet,
        currentHighestBet: mainTable.currentHighestBet,
        communityCards: mainTable.displayCards(),
        playerHand
    });
}

function joinTable(req, res) {
    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    const id = playerId.trim();

    if (mainTable.hasPlayer(id)) {
        return res.status(200).json({
            message: "Player is already at the table.",
            isPlayer: mainTable.players.includes(id)
        });
    }

    if (!mainTable.addPlayer(id)) {
        return res.status(409).json({ error: "Could not add player to table." });
    }

    const isPlayer = mainTable.players.includes(id);

    return res.status(200).json({
        message: isPlayer ? "Successfully joined the table as a player." : "Game in progress. Added to spectator queue.",
        isPlayer,
        playerCount: mainTable.getPlayerCount()
    });
}

function leaveTable(req, res) {
    const playerId = req.body.playerId || req.query.playerId;

    if (typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ error: "Player ID is required." });
    }

    if (!mainTable.removePlayer(playerId.trim())) {
        return res.status(404).json({ error: "Player is not in this table." });
    }

    return res.status(200).json({
        message: "Successfully left the table.",
        playerCount: mainTable.getPlayerCount()
    });
}

function startGame(req, res) {
    const result = mainTable.startGame();
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const playerId = req.body.playerId || req.query.playerId || mainTable.players[0];
    const playerHand = mainTable.dealHandToPlayer(playerId);

    return res.status(200).json({
        message: "Game started successfully.",
        communityCards: mainTable.displayCards(),
        playerHand: playerHand ? playerHand.map(card => Deck.cardToText(card)) : []
    });
}

function playerAction(req, res) {
    const { playerId, action, amount } = req.body;
    if (!playerId || !action) {
        return res.status(400).json({ error: "Player ID and action are required." });
    }

    const result = mainTable.recordAction(playerId, action, Number(amount) || 0);
    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    const p = mainTable.playerObjects.get(playerId);
    return res.status(200).json({
        message: `Action ${action} recorded successfully.`,
        chips: p.chips,
        currentBet: p.currentBet,
        pot: mainTable.pot
    });
}

function nextRound(req, res) {
    const result = mainTable.nextRound();
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }

    const playerId = req.query.playerId;
    let playerHand = [];
    if (playerId && mainTable.players.includes(playerId)) {
        let hand = mainTable.dealHandToPlayer(playerId);
        if (hand) {
            playerHand = hand.map(card => Deck.cardToText(card));
        }
    }

    return res.status(200).json({
        message: "Advanced to the next round.",
        communityCards: result.communityCards,
        winnerData: result.winnerData,
        pot: result.pot,
        playerHand
    });
}

module.exports = { joinTable, leaveTable, startGame, playerAction, nextRound, getTableStatus };
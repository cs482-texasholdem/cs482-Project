require('dotenv').config(); // Load environment variables from .env
const express = require('express'); // import express server
const morgan = require('morgan'); // import morgan for logging
const session = require('express-session'); // generic session handling for express
const cors = require('cors'); // to avoid cors errors with react
const mongostore = require('connect-mongo').default;

const app = express(); // creates a new Express Application
app.use(morgan('dev')); // For better logging, we use morgan
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cors());


const sessionOptions = {
    secret: process.env.SESSION_SECRET || "bananas apples guava",
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60 * 24}
};

if (process.env.NODE_ENV !== "test") {
    sessionOptions.store = mongostore.create({
        mongoUrl: process.env.DB_URI,
        ttl: 60 * 60 * 24 * 7
    });
}
app.use(session(sessionOptions));
app.use(express.static('public'));

// User Actions
const UserCont = require("./controller/UserController"); 
app.post('/user', UserCont.postCreateOrUpdate);
app.get('/user', UserCont.getAll);
app.post('/register', UserCont.register);
app.post('/loginuser', UserCont.login);
app.get('/loggeduser', UserCont.loggedUser);
app.get('/logout', UserCont.logout); 
app.get('/deluser/:id', UserCont.deleteOne); 

// Social & Friend System Routes
app.get('/api/users/search', UserCont.searchUsers);        
app.post('/friends/request', UserCont.sendFriendRequest);  
app.post('/friends/accept', UserCont.acceptFriendRequest);
app.post('/friends/decline', UserCont.declineFriendRequest);
app.get('/api/friends/data', UserCont.getFriendsData);

// Report Player Routes
const reportCont = require('./controller/ReportController');
app.post('/api/reports', reportCont.submitReport);
app.get('/api/reports', reportCont.getAllReports); // Optional: for admin review later
app.patch('/api/reports/:id/resolve', reportCont.resolveReport);
app.post('/api/reports/warn', reportCont.warnUser);
app.get('/api/user/messages', UserCont.getUserMessages);
app.delete('/api/user/messages/:msgId', UserCont.deleteUserMessage);

// Table Actions (Single Table Architecture)
const {joinTable, leaveTable, playerAction, startGame, nextRound, getTableStatus} = require("./controller/tableController");
app.get("/api/table/status", getTableStatus);
app.post("/api/table/join", joinTable);
app.post("/api/table/leave", leaveTable);
app.post("/api/table/action", playerAction);
app.post("/api/table/start", startGame);
app.get("/api/table/next-round", nextRound);

// Game History Route for Admin Dashboard
const GameDao = require("./model/GameDao");
app.get('/api/games', async (req, res) => {
    try {
        const games = await GameDao.readAll();
        res.status(200).json(games);
    } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ error: "Failed to fetch game history" });
    }
});

const Deck = require("./util/pokerLogic");
/**
 * Reconstructs a game session server-side using the saved shuffle seed, 
 * initial player array order, and evaluates each player's hand score.
 */
app.get('/api/games/:id/reconstruct', async (req, res) => {
    try {
        const game = await GameDao.read(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game record not found" });
        }

        const deck = new Deck(game.shuffleSeed);
        const totalPlayers = game.initialPlayers.length;

        const playerHands = {};
        game.initialPlayers.forEach((playerId, index) => {
            const rawCards = deck.hand(index, totalPlayers);
            playerHands[playerId] = rawCards.map(c => Deck.cardToText(c));
        });

        const flopRaw = deck.showFlop(totalPlayers);
        const turnRaw = deck.showTurn(totalPlayers);
        const riverRaw = deck.showRiver(totalPlayers);

        const communityCards = {
            flop: flopRaw.map(c => Deck.cardToText(c)),
            turn: Deck.cardToText(turnRaw),
            river: Deck.cardToText(riverRaw)
        };

        const commonCardsRaw = [...flopRaw, turnRaw, riverRaw];
        const playerScores = {};

        game.initialPlayers.forEach(playerId => {
            const handRaw = deck.hand(game.initialPlayers.indexOf(playerId), totalPlayers);
            const score = Deck.bestHand(handRaw, commonCardsRaw);
            playerScores[playerId] = score;
        });

        res.status(200).json({
            ...game.toObject(),
            playerHands,
            communityCards,
            playerScores
        });
    } catch (error) {
        console.error("Error during game reconstruction:", error);
        res.status(500).json({ error: "Server error during game reconstruction" });
    }
});

exports.app = app;
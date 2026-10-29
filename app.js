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

app.get('/api/games/:id/reconstruct', async (req, res) => {
    try {
        const game = await GameDao.read(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game record not found" });
        }

        // Reconstruct the exact deck using the saved shuffle seed
        const reconstructedDeck = new Deck(game.shuffleSeed);
        const totalPlayers = game.initialPlayers.length;

        // Reconstruct each player's hole cards server-side
        const playerHands = {};
        game.initialPlayers.forEach((playerId, index) => {
            const rawHand = reconstructedDeck.hand(index, totalPlayers);
            playerHands[playerId] = rawHand.map(c => Deck.cardToText(c));
        });

        // Reconstruct community cards server-side (flop, turn, river)
        const flopCards = reconstructedDeck.showFlop(totalPlayers).map(c => Deck.cardToText(c));
        const turnCard = Deck.cardToText(reconstructedDeck.showTurn(totalPlayers));
        const riverCard = Deck.cardToText(reconstructedDeck.showRiver(totalPlayers));

        res.status(200).json({
            gameId: game._id,
            tableId: game.tableId,
            timestamp: game.timestamp,
            initialPlayers: game.initialPlayers,
            playerHands,
            communityCards: {
                flop: flopCards,
                turn: turnCard,
                river: riverCard,
                all: [...flopCards, turnCard, riverCard]
            },
            potFinal: game.potFinal,
            winners: game.winners,
            actions: game.actions
        });
    } catch (error) {
        console.error("Error during server-side game reconstruction:", error);
        res.status(500).json({ error: "Server error during game reconstruction" });
    }
});

exports.app = app;
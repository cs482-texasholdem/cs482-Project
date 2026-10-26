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

exports.app = app;
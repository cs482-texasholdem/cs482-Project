require('dotenv').config(); // Load environment variables from .env
const express = require('express'); // import express server
const morgan = require('morgan'); // import morgan for logging
const session = require('express-session'); // generic session handling for express
const cors = require('cors'); // to avoid cors errors with react
const mongostore = require('connect-mongo').default; // <-- Added .default here

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

// Use MongoDB sessions during normal application startup.
// Jest uses Express's default in-memory session store.
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

// Table Actions
const {joinTable, leaveTable} = require("./controller/tableController");
app.post("/api/tables/:tableId/join", joinTable);
app.post("/api/tables/:tableId/leave", leaveTable);

exports.app = app;
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

app.use(session({
    secret: process.env.SESSION_SECRET || 'bananas apples guava', 
    resave: false, // prevents saving session if it wasn't modified
    saveUninitialized: false, // prevents saving empty sessions
    cookie: {maxAge: 1000 * 60 * 60 * 24}, // cookie expires in 1 day
    store: mongostore.create({
        mongoUrl: process.env.DB_URI,
        ttl: 60 * 60 * 24 * 7 // session expires in 7 days
    })
}));

// Static server use the folder where your HTML/CSS/JS live (e.g., public_html or your project root view folders)
app.use(express.static('public'));

// User Actions
const UserCont = require("./controller/UserController"); // Adjust path if your folder is lowercase/uppercase
app.post('/user', UserCont.postCreateOrUpdate); // register new user
app.get('/user', UserCont.getAll);
app.post('/loginuser', UserCont.login); // login user
app.get('/loggeduser', UserCont.loggedUser); // fetches logged user (or null)
app.get('/logout', UserCont.logout); 
app.get('/deluser/:id', UserCont.deleteOne); // deletes user 

exports.app = app;




require('dotenv').config();
const mongoose = require('mongoose');

exports.connect = async function(where){
    let uri = process.env.DB_URI; //production DB
    if(where==='test') uri = process.env.TESTDB_URI; //Test DB
    if(process.env.CI) uri = 'mongodb://adm:secret@localhost:27017';

    try {
        await mongoose.connect(uri);
        console.log(`Database connected successfully to: ${where || 'production'}`);
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

exports.disconnect = async function(){
    await mongoose.connection.close();
    console.log('Database disconnected successfully');
}
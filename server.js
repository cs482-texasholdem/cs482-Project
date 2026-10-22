require('dotenv').config();
const { app } = require('./app');
const db = require('./config/dbConnection');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to MongoDB Atlas using your professor's pattern
        await db.connect();
        console.log('Database connection initialized.');

        app.listen(PORT, () => {
            console.log(`Server is running live on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
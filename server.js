require('dotenv').config();
const { app } = require('./app');
const db = require('./model/DbConnection');
//for Socket.io
const http = require('http'); // ADD: Required for Socket.io
const { Server } = require('socket.io');
const mainTable = require('./controller/tableController').mainTable;

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to MongoDB Atlas using your professor's pattern
        await db.connect();
        console.log('Database connection initialized.');

        const server = http.createServer(app); // Create an HTTP server for Socket.io
        const io = new Server(server, {
            cors: { origin: '*', methods: ['GET', 'POST'] } // Allow all origins for simplicity; ADJUST as needed for security
        });
        app.set('io', io); // make io accessible to controllers via req.app.get('io')

        //Socket.io connection and room joining
        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);
            socket.on('join_table', (tableId) => {
                socket.join(`table_${tableId}`);
            });
            socket.on('leave_table', (tableId) => {
                console.log(`User ${socket.id} leaving table ${tableId}`);
            });
        });

        //server side turn timeout and timer tick loop
        setInterval(() => {
            const timeOut = mainTable.checkTimeout();
            if (timeOut) {
                io.emit('TABLE_UPDATED');
            }
            const elapsed = mainTable.turnStartTime ? Math.floor((Date.now() - mainTable.turnStartTime) / 1000) : 0;
            const turnTimeRemaining = Math.max(0, 30 - elapsed);
            io.emit('TURN_TIMER', { turnTimeRemaining });
        }, 1000);

        //use server instead for app.listen to enable socket.io
        server.listen(PORT, () => {
            console.log(`Server is running live on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
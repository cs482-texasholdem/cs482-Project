require('dotenv').config();
const { app } = require('./app');
const db = require('./model/DbConnection');
const http = require('http');
const { Server } = require('socket.io');
const { mainTable, finishGame } = require('./controller/tableController');

const PORT = process.env.PORT || 3000;

// Register finish game route
app.post("/api/table/finish", finishGame);

async function startServer() {
    try {
        await db.connect();
        console.log('Database connection initialized.');

        const server = http.createServer(app);
        const io = new Server(server, {
            cors: { origin: '*', methods: ['GET', 'POST'] }
        });
        app.set('io', io);

        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);
            socket.on('join_table', (tableId) => {
                socket.join(`table_${tableId}`);
            });
            socket.on('leave_table', (tableId) => {
                socket.leave(`table_${tableId}`);
                console.log(`User ${socket.id} left table ${tableId}`);
            });
        });

        setInterval(() => {
            const timeOut = mainTable.checkTimeout();
            if (timeOut) {
                io.to(`table_${mainTable.tableId}`).emit('TABLE_UPDATED');
            }
            const elapsed = mainTable.turnStartTime ? Math.floor((Date.now() - mainTable.turnStartTime) / 1000) : 0;
            const turnTimeRemaining = Math.max(0, 30 - elapsed);
            io.to(`table_${mainTable.tableId}`).emit('TURN_TIMER', { turnTimeRemaining });
        }, 1000);

        server.listen(PORT, () => {
            console.log(`Server is running live on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
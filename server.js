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

        const getTurnTimeRemaining = () => {
            if (!mainTable.gameInProgress || mainTable.gameOver || !mainTable.turnStartTime) {
                return null;
            }

            const elapsed = Math.floor((Date.now() - mainTable.turnStartTime) / 1000);
            return Math.max(0, mainTable.timeLimit - elapsed);
        };

        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);
            socket.on('join_table', (tableId) => {
                socket.join(`table_${tableId}`);

                // Immediately send the current countdown to the joining player
                const turnTimeRemaining = getTurnTimeRemaining();
                if (turnTimeRemaining !== null) {
                    socket.emit('TURN_TIMER', { turnTimeRemaining });
                }
            });
            socket.on('leave_table', (tableId) => {
                socket.leave(`table_${tableId}`);
                console.log(`User ${socket.id} left table ${tableId}`);
            });
        });

        setInterval(() => {
            try {
                const room = `table_${mainTable.tableId}`;
                const timeOut = mainTable.checkTimeout();

                if (timeOut && timeOut.timedOut) {
                    if (timeOut.winnerData && timeOut.winnerData.winners) {
                        io.to(room).emit('SHOWDOWN_REVEAL', timeOut.winnerData);
                        mainTable.resetToLobby();
                    }
                    io.to(room).emit('TABLE_UPDATED');
                }

                const turnTimeRemaining = getTurnTimeRemaining();
                if (turnTimeRemaining !== null) {
                    io.to(room).emit('TURN_TIMER', { turnTimeRemaining });
                }
            } catch (err) {
                console.error('Turn timer tick failed:', err);
            }
        }, 1000);

        server.listen(PORT, () => {
            console.log(`Server is running live on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
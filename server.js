require('dotenv').config();

const { app, sessionMiddleware } = require('./app');
const presence = require('./model/PresenceManager');


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
        // Share Express authentication sessions with Socket.IO
        io.engine.use(sessionMiddleware);

        const getTurnTimeRemaining = () => {
            if (!mainTable.gameInProgress || mainTable.gameOver || !mainTable.turnStartTime) {
                return null;
            }

            const elapsed = Math.floor((Date.now() - mainTable.turnStartTime) / 1000);
            return Math.max(0, mainTable.timeLimit - elapsed);
        };

        io.on('connection', (socket) => {
            // Get the logged-in user from the Express session
            const sessionUser = socket.request.session?.user;

            const username = sessionUser
                ? (typeof sessionUser === 'object'
                    ? sessionUser.username
                    : sessionUser)
                : null;

            // Track logged-in users
            if (username) {
                socket.join('authenticated_users');
                socket.join(`session:${socket.request.sessionID}`);

                const becameOnline = presence.addUser(username, socket.id);

                if (becameOnline) {
                    io.to('authenticated_users').emit('PRESENCE_UPDATED', {
                        username,
                        online: true
                    });
                }
            }

            // Existing poker table functionality
            socket.on('join_table', (tableId) => {
                socket.join(`table_${tableId}`);

                // Immediately send the current countdown
                const turnTimeRemaining = getTurnTimeRemaining();

                if (turnTimeRemaining !== null) {
                    socket.emit('TURN_TIMER', { turnTimeRemaining });
                }
            });

            socket.on('leave_table', (tableId) => {
                socket.leave(`table_${tableId}`);
                console.log(`User ${socket.id} left table ${tableId}`);
            });

            // Detect when a user disconnects
            socket.on('disconnect', () => {
                if (!username) return;

                const becameOffline = presence.removeUser(username, socket.id);

                if (becameOffline) {
                    io.to('authenticated_users').emit('PRESENCE_UPDATED', {
                        username,
                        online: false
                    });
                }
            });
        });

        const intervalId = setInterval(() => {
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

        if (intervalId.unref) {
            intervalId.unref();
        }

        server.listen(PORT, () => {
            console.log(`Server is running live on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
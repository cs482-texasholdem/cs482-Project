require('dotenv').config();

const { app, sessionMiddleware } = require('./app');
const presence = require('./model/PresenceManager');


const db = require('./model/DbConnection');
const http = require('http');
const { Server } = require('socket.io');
const { mainTable, finishGame, tableManager } = require('./controller/tableController');
const registerReactionHandler = require('./controller/reactionHandler');
const SponsorBanner = require('./model/SponsorBanner');

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
            // Register player emoji reactions
            registerReactionHandler(io, socket, tableManager);
            
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

            //send banner immediately on connect and refresh when it updates
            socket.emit('SPONSOR_BANNER_ROTATION', getCurrentBannerPayload());
            socket.on('REQUEST_SPONSOR_BANNER', () => {
                socket.emit('SPONSOR_BANNER_ROTATION', getCurrentBannerPayload());
            });

        });

        let activeBannersCache = [];
        let activeBannerIndex = 0;
        let currentBannerEndsAt = 0;

        // load approve banners
        function getCurrentBannerPayload() {
            if (!activeBannersCache.length) {
                return { banner: null, secondsRemaining: 0, totalBanners: 0 };
            }
            const safeIdx = activeBannerIndex % activeBannersCache.length;
            const current = activeBannersCache[safeIdx];
            const secondsRemaining = Math.max(0, Math.ceil((currentBannerEndsAt - Date.now()) / 1000));
            return {
                banner: current,
                secondsRemaining,
                totalBanners: activeBannersCache.length
            };
        }

        async function refreshApprovedBanners(resetIndex = false) {
            try {
                const rows = await SponsorBanner.find({
                    status: 'approved',
                    isActive: true
                })
                    .select('_id sponsorName sponsorCode headline subtext linkUrl theme durationSec updatedAt')
                    .sort({ updatedAt: -1 });

                activeBannersCache = rows.map((b) => {
                    let safeUrl = '';
                    if (b.linkUrl) {
                        try {
                            const parsed = new URL(b.linkUrl);
                            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                                safeUrl = parsed.href;
                            }
                        } catch {
                            safeUrl = '';
                        }
                    }
                    const dur = Math.max(5, Math.min(30, Number(b.durationSec) || 20));
                    return {
                        id: String(b._id),
                        sponsorName: b.sponsorName,
                        sponsorCode: b.sponsorCode,
                        headline: b.headline,
                        subtext: b.subtext || '',
                        linkUrl: safeUrl,
                        theme: b.theme || 'midnight',
                        durationSec: dur
                    };
                });

                if (!activeBannersCache.length) {
                    activeBannerIndex = 0;
                    currentBannerEndsAt = 0;
                } else {
                    if (resetIndex || activeBannerIndex >= activeBannersCache.length) {
                        activeBannerIndex = 0;
                    }
                    const durationMs = activeBannersCache[activeBannerIndex].durationSec * 1000;
                    currentBannerEndsAt = Date.now() + durationMs;
                }

                io.emit('SPONSOR_BANNER_ROTATION', getCurrentBannerPayload());
            } catch (err) {
                console.error('Failed to refresh approved sponsor banners:', err);
            }
        }

        refreshApprovedBanners(true);

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
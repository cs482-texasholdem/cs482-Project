/**
 * ============================================================================
 * File Name: leaderboardUtil.js
 * Purpose: Computes monthly points-gained leaderboards per public table from
 *          recorded game history, automatically scoped to the current UTC month
 *          so rankings reset at the start of every month.
 * ============================================================================
 */

const GameDao = require("../model/GameDao");

const LOUNGE_TIERS = [
    { key: "beginner", label: "Beginner Lounge" },
    { key: "intermediate", label: "Intermediate Lounge" },
    { key: "advanced", label: "Advanced Lounge" }
];

function resolveLoungeTier({ tableId = "", gameMode = "", tableName = "" }) {
    const combined = `${String(tableId)} ${String(gameMode)} ${String(tableName)}`.toLowerCase();

    if (combined.includes("beginner")) return "beginner";
    if (combined.includes("intermediate")) return "intermediate";
    if (combined.includes("advanced")) return "advanced";

    return null;
}

function buildLoungeMetadataMap(tableManager) {
    const map = new Map();
    for (const tier of LOUNGE_TIERS) {
        map.set(tier.key, {
            loungeKey: tier.key,
            tableId: `lounge-${tier.key}`,
            tableName: tier.label,
            tableIds: new Set(),
            playerCount: 0,
            maxPlayers: 0
        });
    }

    if (!tableManager || typeof tableManager.getAllTables !== "function") {
        return map;
    }

    for (const table of tableManager.getAllTables()) {
        if (!table) continue;
        const tierKey = resolveLoungeTier({
            tableId: table.tableId,
            gameMode: table.gameMode,
            tableName: table.tableName
        });
        if (!tierKey) continue;

        const meta = map.get(tierKey);
        if (table.tableId) {
            meta.tableIds.add(String(table.tableId).trim());
        }
        meta.playerCount += typeof table.getPlayerCount === "function" ? table.getPlayerCount() : 0;
        meta.maxPlayers += Number(table.maxPlayers) || 9;
    }

    return map;
}

async function getMonthlyPublicTableLeaderboards({ tableManager = null, referenceDate = new Date() } = {}) {
    const { start, end } = getCurrentMonthUtcBounds(referenceDate);
    const monthKey = getMonthKey(referenceDate);
    const loungeMetaMap = buildLoungeMetadataMap(tableManager);

    const allGames = await GameDao.readAll();
    const monthlyGames = (Array.isArray(allGames) ? allGames : []).filter((game) => {
        if (!game || !game.timestamp) return false;
        const ts = new Date(game.timestamp);
        return !Number.isNaN(ts.getTime()) && ts >= start && ts < end;
    });

    // loungeKey -> Map(playerKey -> { playerId, pointsGained, handsWon, handsPlayed })
    const perLoungePlayerStats = new Map();
    for (const tier of LOUNGE_TIERS) {
        perLoungePlayerStats.set(tier.key, new Map());
    }

    for (const game of monthlyGames) {
        const tableId = typeof game.tableId === "string" ? game.tableId.trim() : "";
        const tierKey = resolveLoungeTier({
            tableId,
            gameMode: game.gameMode,
            tableName: game.tableName
        });
        if (!tierKey) continue;

        const meta = loungeMetaMap.get(tierKey);
        if (tableId) {
            meta.tableIds.add(tableId);
        }

        const playerMap = perLoungePlayerStats.get(tierKey);
        const initialPlayers = Array.isArray(game.initialPlayers) ? game.initialPlayers : [];
        const winners = Array.isArray(game.winners) ? game.winners : [];
        const winnerSet = new Set(winners.map((w) => normalizePlayerId(w).toLowerCase()).filter(Boolean));
        const potFinal = Math.max(0, Number(game.potFinal) || 0);
        const actions = Array.isArray(game.actions) ? game.actions : [];

        const winnerCount = winnerSet.size;
        const potSharePerWinner = winnerCount > 0 ? potFinal / winnerCount : 0;

        for (const rawPlayerId of initialPlayers) {
            const playerId = normalizePlayerId(rawPlayerId);
            if (!playerId) continue;

            const playerKey = playerId.toLowerCase();
            if (!playerMap.has(playerKey)) {
                playerMap.set(playerKey, {
                    playerId,
                    pointsGained: 0,
                    handsWon: 0,
                    handsPlayed: 0
                });
            }

            const stats = playerMap.get(playerKey);
            stats.handsPlayed += 1;

            const isWinner = winnerSet.has(playerKey);
            const committed = getPlayerActionSpend(actions, playerKey);

            if (isWinner) {
                stats.handsWon += 1;
                const netGain = Math.round(potSharePerWinner - committed);
                stats.pointsGained += netGain;
            } else if (committed > 0) {
                stats.pointsGained -= Math.round(committed);
            }
        }
    }

    const tables = LOUNGE_TIERS.map((tier) => {
        const meta = loungeMetaMap.get(tier.key);
        const playerMap = perLoungePlayerStats.get(tier.key);

        const leaderboard = Array.from(playerMap.values())
            .sort(
                (a, b) =>
                    b.pointsGained - a.pointsGained ||
                    b.handsWon - a.handsWon ||
                    a.playerId.localeCompare(b.playerId)
            )
            .map((entry, idx) => ({
                rank: idx + 1,
                playerId: entry.playerId,
                pointsGained: entry.pointsGained,
                handsWon: entry.handsWon,
                handsPlayed: entry.handsPlayed
            }));

        return {
            loungeKey: tier.key,
            tableId: meta.tableId,
            tableName: tier.label,
            tableIds: Array.from(meta.tableIds),
            tableCount: meta.tableIds.size,
            playerCount: meta.playerCount,
            maxPlayers: meta.maxPlayers,
            leaderboard
        };
    });

    return {
        month: monthKey,
        resetsAt: end.toISOString(),
        tables
    };
}

function getCurrentMonthUtcBounds(referenceDate = new Date()) {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    return { start, end };
}

function getMonthKey(referenceDate = new Date()) {
    const year = referenceDate.getUTCFullYear();
    const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function normalizePlayerId(playerId) {
    return typeof playerId === "string" ? playerId.trim() : "";
}

function getPlayerActionSpend(actions, playerIdLower) {
    if (!Array.isArray(actions) || !playerIdLower) return 0;

    // Track cumulative committed chips per player within the hand using action amounts
    let totalCommitted = 0;
    for (const entry of actions) {
        if (!entry || typeof entry.playerId !== "string") continue;
        if (entry.playerId.trim().toLowerCase() !== playerIdLower) continue;
        if (entry.action === "Call" || entry.action === "Raise" || entry.action === "Bet") {
            const amt = Number(entry.amount) || 0;
            if (amt > totalCommitted) {
                totalCommitted = amt;
            }
        }
    }
    return totalCommitted;
}

function isPublicTableId(tableId, activeTablesById = new Map()) {
    if (!tableId || typeof tableId !== "string") return false;
    const trimmed = tableId.trim();
    if (!trimmed || trimmed.startsWith("ranked-")) return false;

    const liveTable = activeTablesById.get(trimmed);
    if (liveTable) {
        if (liveTable.gameMode === "ranked") return false;
        if (liveTable.visibility && liveTable.visibility !== "public") return false;
    }

    return true;
}

function buildPublicTableMetadataMap(tableManager) {
    const map = new Map();
    if (!tableManager || typeof tableManager.getAllTables !== "function") {
        return map;
    }

    for (const table of tableManager.getAllTables()) {
        if (!table || !table.tableId) continue;
        const isRanked = table.gameMode === "ranked" || String(table.tableId).startsWith("ranked-");
        const isPrivate = table.visibility && table.visibility !== "public";
        if (isRanked || isPrivate) continue;

        map.set(table.tableId, {
            tableId: table.tableId,
            tableName: table.tableName || `Public Table (${table.tableId.slice(0, 8)})`,
            smallBlind: table.smallBlind ?? null,
            bigBlind: table.bigBlind ?? null,
            buyIn: table.buyIn ?? null,
            playerCount: typeof table.getPlayerCount === "function" ? table.getPlayerCount() : 0,
            maxPlayers: table.maxPlayers ?? 9
        });
    }

    return map;
}

module.exports = {
    getMonthlyPublicTableLeaderboards,
    getCurrentMonthUtcBounds,
    getMonthKey
};
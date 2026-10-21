class ActiveTable {
    constructor(tableId, skillLevel, timeLimit = 30) {
        this.tableId = tableId;
        this.skillLevel = skillLevel;
        this.timeLimit = timeLimit;
        this.maxPlayers = 10;
        this.players = [];
    }

    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    addPlayer(playerId) {
        if (this.isFull()) {
            return false;
        }

        if (this.players.includes(playerId)) {
            return false;
        }

        this.players.push(playerId);
        return true;
    }

    removePlayer(playerId) {
        const index = this.players.indexOf(playerId);

        if (index === -1) {
            return false;
        }

        this.players.splice(index, 1);
        return true;
    }
}

module.exports = ActiveTable;

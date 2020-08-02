var ttDBHandler = require('./timeTrialDBHandler');
var ioClient = require('socket.io-client');
let adminPassword = require("../../config.json").adminPassword;

exports.storePlayerMoveIfNeeded = (player) => {
    if (player.playerType !== 'player' || ++player.numOfTicksPassed !== player.ttTickEvery) {
        return;
    }
    player.ttMoves.push({
        x: player.target.x,
        y: player.target.y,
    });
    player.numOfTicksPassed = 0;
}

exports.submitPlayerTimeTrial = (player, game) => {
    ttDBHandler.submitTimeTrial(player, game.map, player.finishTime-game.gameStartTime);
}

exports.submitNewLeaderboardTime = (player, game) => {
    if (player.admin) {
        return;
    }
    let time_taken_nano = player.finishTime-game.gameStartTime;
    if (process.env.DB_SERVER === "true") {
        ttDBHandler.submitNewLeaderboardTime(game.map, player.name, time_taken_nano);
    }
    else {
        let submitSocket = ioClient.connect('https://reboun.io');
        submitSocket.on('connect', () => {
            submitSocket.emit('submitNewLeaderboardTime', adminPassword, game.map, player.name, time_taken_nano);
            submitSocket.disconnect();
        });
    }
}

exports.updateTargetIfBot = (player) => {
    if (player.playerType !== 'bot' || ++player.numOfTicksPassed !== player.ttTickEvery) {
        return;
    }

    if(player.botTargetList == null){
        player.numOfTicksPassed = 0;
        player.target = {x: 0, y: 0};
        return;
    }

    if (player.botListPointer >= player.botTargetList.length) {
        player.game.disconnectPlayer(player);
        return;
    }



    player.target = player.botTargetList[player.botListPointer++];
    player.numOfTicksPassed = 0;
}
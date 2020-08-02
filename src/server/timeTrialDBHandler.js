var util = require('./lib/util');
var level = require('level');

var ttDB = level('data/timeTrialData');


var ttInfo = {};
var encOptions = {valueEncoding: "json"};

ttDB.get('ttInfo', encOptions, function (err, value) {
    if (err) {
        if (err.notFound) {
            return util.log("ttInfo not found")
        }
        return util.error(err);
    }
    ttInfo = value;
});

function timeTrialWanted(player, map, time_taken_sec, death_room) {
    if (!player.won || time_taken_sec > 600) {
        return false;
    }
    return true;
}

let ttPadding = 20; // 100 ticks of padding (20*5)
exports.submitTimeTrial = (player, map, time_taken_nano) => {
    let time_taken = util.timeToSeconds(time_taken_nano);
    let death_room = player.deathRoom
    let moves = player.ttMoves;
    if (!timeTrialWanted(player, map, time_taken, death_room)) {
        return;
    }

    if (ttInfo[map] === undefined) {
        ttInfo[map] = [];
    }
    let id = player.id + new Date().getTime().toString();
    ttInfo[map].push({
        id: id,
        time_taken: time_taken,
        death_room: death_room,
        ttTickEvery: player.ttTickEvery,
    });

    for (let i = 0; i < ttPadding; i++) {
        moves.push({x: 0, y: 0});
    }
    ttDB.put(id, moves, encOptions);
    ttDB.put('ttInfo', ttInfo, encOptions);
}

exports.getTimeTrialInfoAndPromise = (game) => {
    let map = game.map;
    let timeTrials = ttInfo[map];
    if (!timeTrials || timeTrials.length === 0) {
        // util.error("Tried to get time trial from map " + map + " with no time trials in timeTrialDBHandler.getTimeTrialPromise")
        util.log('no tts');
        return null;
    }
    let ttIdx = Math.floor(Math.random()*timeTrials.length);
    let chosenTTInfo = timeTrials[ttIdx];

    while (util.eleIn(game.existingBotPaths, chosenTTInfo.id)) {
        ttIdx = Math.floor(Math.random()*timeTrials.length);
        chosenTTInfo = timeTrials[ttIdx];
        if (timeTrials.length <= game.existingBotPaths.length) {
            util.log('ran out of tts');
            return null;
        }
    }
    game.existingBotPaths.push(chosenTTInfo.id);
    return {info: chosenTTInfo, promise: ttDB.get(chosenTTInfo.id, encOptions)};
}


let timeLeaderboard = {};

ttDB.get('timeLeaderboard', encOptions, function (err, value) {
    if (err) {
        if (err.notFound) {
            return util.log("ttInfo not found")
        }
        return util.error(err);
    }
    timeLeaderboard = value;
});

let leaderboardLength = 100;
exports.submitNewLeaderboardTime = (gameMap, playerName, time_taken_nano) => {
    if (!timeLeaderboard[gameMap]) {
        timeLeaderboard[gameMap] = [];
    }
    let mapLb = timeLeaderboard[gameMap];
    let time_taken = util.timeToSeconds(time_taken_nano);
    mapLb.push({time: time_taken, name: playerName});
    mapLb.sort((a, b) => {
        return a.time - b.time;
    });
    if (mapLb.length > leaderboardLength) {
        mapLb.splice(leaderboardLength, 1);
    }
    ttDB.put('timeLeaderboard', timeLeaderboard, encOptions);
}

exports.getLeaderboardTimes = () => {
    return timeLeaderboard;
}

exports.shutdown = () => {
    return ttDB.put('ttInfo', ttInfo, encOptions).then(() => { 
        return ttDB.put('timeLeaderboard', timeLeaderboard, encOptions).then(() => {
            return ttDB.close();
        });
    });
}
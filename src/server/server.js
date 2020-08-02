'use strict'
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var QuadTree = require('simple-quadtree');
var config = require('../../config.json');
var adminPassword = config.adminPassword;
var util = require('./lib/util');
var qtUtil = require('./lib/quadTreeUtil');

var food = require('./mapObjects/food.js');
var enemies = require('./mapObjects/enemies')
var players = require('./mapObjects/player.js');
var Game = require('./mapObjects/Game.js');

var setupAdminPlayer = require('./adminControls').setupAdminPlayer;
var setupAdminSocket = require('./setupAdminSocket').setupAdminSocket;

var timeTrialDBHandler = require('./timeTrialDBHandler.js');
var analyticsDBHandler = require('./analyticsDBHandler');

var sockets = {};
var games = {};

app.use(express.static(__dirname + '/../client'));

util.pubSub.subscribe('gameClosed', closeGame);

let prodEnvVar = process.env.NODE_ENV;
let isProdServer;
if (prodEnvVar === "dev") {
    isProdServer = false;
}
else {
    isProdServer = true;
}

function closeGame(game) {
    delete games[game.id];
    if (gameInQueue && gameInQueue.id === game.id) {
        gameInQueue = null;
    }
    util.log("Game " + game.id + " closed")
    printNumOfRealPlayers();
}

util.pubSub.subscribe('printNumPlayers', printNumOfRealPlayers);
function printNumOfRealPlayers() {
    let count = 0;
    for (let gameId in games) {
        let user;
        for (let i = 0; i < games[gameId].users.length; i++) {
            user = games[gameId].users[i];
            if (user.playerType === "player" && !user.disconnected) {
                count += 1;
            }
        }
    }
    util.log(`${count} players active`);
}

let gameCounter = 0;
let gameInQueue = null;

io.on('connection', function (socket) {

    let currentPlayer;

    socket.on('queue', function (playerSetup) {

        if (!util.validNick(playerSetup.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {

            let game;
            if (gameInQueue && gameInQueue.inQueue) {
                game = gameInQueue;
            }
            else {
                let gameConfig = {id: gameCounter++, io: io, sockets: sockets};
                game = new Game.Game(gameConfig);
                games[gameConfig.id] = game;
                gameInQueue = game;
            }

            let b1Promise, b2Promise;
            b1Promise = game.addBot();
            b2Promise = game.addBot();

            util.log('Player ' + playerSetup.name + ' joined the queue in game ' + game.id);

            let playerConfig = {
                playerType: 'player',
                name: playerSetup.name,
                radius: config.initialPlayerRadius,
                id: socket.id,
                x: 50,
                y: 500,
                screenWidth: playerSetup.screenWidth,
                screenHeight: playerSetup.screenHeight,
                ratio: calculateServerToClientRatio(playerSetup.screenWidth, playerSetup.screenHeight),
                seesRatio: calculateServerToClientRatio(playerSetup.screenWidth, playerSetup.screenHeight)**-1,
                hue: Math.round(Math.random() * 360),
                saturation: 100,
                lightness: 45,
                borderColour: config.defaultBorderColour,
                lastHeartbeat: new Date().getTime(),
                analytics: playerSetup.analytics,
                rooms: game.rooms,
                io: io,
                gameId: game.id,
                game: game,
                socket: socket,
                bot1Promise: b1Promise,
                bot2Promise: b2Promise,
            }

            currentPlayer = new players.Player(playerConfig);
            game.addPlayer(currentPlayer);

            sockets[currentPlayer.id] = socket;

            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: config.gameWidth,
                gameHeight: config.gameHeight,
                yourId: socket.id,
                defaultRatio: defaultRatio,
                ratioBound: ratioBound,
            });
            // game.startGame()
            socket.emit('newRatio', currentPlayer.ratio);

            setupGameSocketFunctions(currentPlayer);
            setupAdminPlayer(currentPlayer);
            analyticsDBHandler.newPlay();
            // todo: can remove guard when playerSetup is verified

            if (playerSetup.analytics && playerSetup.analytics.newPlayer === true) {
                analyticsDBHandler.newUniquePlayer();
            }
        }
    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('bestTimes', () => {
        socket.emit('bestTimesResponse', timeTrialDBHandler.getLeaderboardTimes());
    });

    socket.on('newVisit', () => {
        analyticsDBHandler.newVisit();
    });

    socket.on('newUniqueVisit', () => {
        analyticsDBHandler.newUniquePlayer();
    });

    socket.on('newLBTime', (pw, gameMap, playerName, time_taken_nano) => {
        if (pw !== adminPassword) {
            return;
        }

        timeTrialDBHandler.submitNewLeaderboardTime(gameMap, playerName, time_taken_nano);
    });

    setupAdminSocket(socket);
});

function setupGameSocketFunctions(currentPlayer) {
    let socket = currentPlayer.socket;

    socket.on('heartbeatAndTarget', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        currentPlayer.target = target;
    });

    socket.on('changeModeVote', (newModeVote) => {
        games[currentPlayer.gameId].changeModeVote(currentPlayer.modeVote, newModeVote);
        currentPlayer.modeVote = newModeVote;
        if (currentPlayer.bot1) {
            currentPlayer.bot1.botChangeModeVote(newModeVote);
        }
    });

    socket.on('changeMapVote', (newMapVote) => {
        games[currentPlayer.gameId].changeMapVote(currentPlayer.mapVote, newMapVote);
        currentPlayer.mapVote = newMapVote;
        if (currentPlayer.bot1) {
            currentPlayer.bot1.botChangeMapVote(newMapVote);
        }
    });

    socket.on('changeStartVote', (newStartVote) => {
        games[currentPlayer.gameId].changeStartVote(currentPlayer.startVote, newStartVote);
        currentPlayer.startVote = newStartVote;
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
        let newRatio = calculateServerToClientRatio(data.screenWidth, data.screenHeight);
        currentPlayer.ratio = newRatio;
        currentPlayer.seesRatio = newRatio**-1;
    });

    socket.on('disconnect', function (reason) {
        if (currentPlayer && currentPlayer.disconnected !== true) {
            currentPlayer.game.disconnectPlayer(currentPlayer);
            currentPlayer.disconnected = true;
        }
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (config.logChat === 1) {
            util.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
    });

    socket.on('clientHeartbeat', function() {
        currentPlayer.lastHeartbeat = new Date().getTime();
    });
}

util.pubSub.subscribe("generateNewRoomQuadTree", generateNewRoomQuadTree);

function generateNewRoomQuadTree(room) {
    room.quadTree = QuadTree(0, 0, room.width, room.height);
    room.teleportPortals.forEach( (portal) => {
        if (portal.portalType === "circle") {
            qtUtil.putInQuadTree(room, portal);
        }
        else if (portal.portalType === "roomStart") {
            room.quadTree.put({x: 0, y: 0, w: portal.width, h: room.height, obj: portal});
        }
        else if (portal.portalType === "roomEnd") {
            room.quadTree.put({x: room.width-portal.width, y: 0, w: portal.width, h: room.height, obj: portal});
        }
    });
    room.foods = [];
    room.foodSetups.forEach((foodSetup) => {
        let newFood = new food.Food(foodSetup);
        room.foods.push(newFood);
        qtUtil.putInQuadTree(room, newFood);
    });
    room.enemies = [];
    for (let i = 0; i < room.enemySetups.length; i++) {
        let enemySetup = room.enemySetups[i];
        enemySetup.room = room;
        enemySetup.id = i;
        let enemy;
        if (enemySetup.type === 'StandardEnemy') {
            enemy = new enemies.StandardEnemy(enemySetup);
        }
        room.enemies.push(enemy);
        qtUtil.putInQuadTree(room, enemy);
    }
}

// util.pubSub.subscribe("generateNewRandomFood", generateNewRandomFood);

// function generateNewRandomFood(room, i) {
//     // let newFood = new food.Food({id: i, room: room});
//     // room.foods[i] = newFood;
//     room.foods[i]
    
// }

const defaultRatio = {
    big: 1920,
    small: 1080,
}
function calculateServerToClientRatio(width, height) {
    if (height < width) {
        return getRatio(width, height);
    }
    else {
        return getRatio(height, width);
    }
}

const ratioBound = 16/9;
function getRatio(bigNum, smallNum) {
    if (bigNum/smallNum < ratioBound) {
        return smallNum/defaultRatio.small;
    } 
    else {
        let adjustedSmall = bigNum*(ratioBound**-1);
        return adjustedSmall/defaultRatio.small;
    }
}

/**
 * 
 * @param {Object} o 
 * @param {Object} p 
 */
function objectInPlayerFOV(o, p) {
    return o.x+o.radius*2 > p.x - (p.screenWidth/2 - 20)*p.seesRatio &&
        o.x-o.radius*2 < p.x + (p.screenWidth/2 + 20)*p.seesRatio &&
        o.y+o.radius*2 > p.y - (p.screenHeight/2 - 20)*p.seesRatio &&
        o.y-o.radius*2 < p.y + (p.screenHeight/2 + 20)*p.seesRatio;
}

function moveloop() {
    for (let gameId in games) {
        games[gameId].tick();
    }
}

function sendUpdates() {
    for (let gameId in games) {
        let game = games[gameId];
        if (game.inQueue === false) {
            game.users.forEach( function(u) {
                if (u.disconnected) {
                    return;
                }

                let playerRoom = game.rooms[u.roomId];

                let visibleFood = playerRoom.foods
                    .map(function(f) {
                        if (objectInPlayerFOV(f, u)) {
                            return f;
                        }
                    })
                    .filter(function(f) { return f; });
                
                let visibleCells = playerRoom.users
                    .map(function(f) {
                        if (objectInPlayerFOV(f, u)) {
                            if (u.id === f.id) {
                                return {
                                    id: f.id,
                                    name: f.name,
                                    x: f.x,
                                    y: f.y,
                                    radius: f.radius,
                                    saturation: f.saturation,
                                    lightness: f.lightness,
                                    borderColour: f.borderColour,
                                    timeTillDeath: f.timeTillDeath,
                                    state: f.state,
                                    team: f.team,
                                    target: f.target,
                                    level: f.level,
                                    expToNextLvl: f.expToNextLvl,
                                    expInCurrLvl: f.expInCurrLvl,
                                    screenWidth: f.screenWidth*f.seesRatio,
                                    screenHeight: f.screenHeight*f.seesRatio,
                                    maxSpeed: f.maxSpeed,
                                    speed: f.speed,
                                    roomId: f.roomId,                                        
                                };
                            }
                            return {
                                id: f.id,
                                name: f.name,
                                x: f.x,
                                y: f.y,
                                radius: f.radius,
                                saturation: f.saturation,
                                lightness: f.lightness,
                                borderColour: f.borderColour,
                                timeTillDeath: f.timeTillDeath,
                                state: f.state,
                                team: f.team,
                                maxSpeed: f.maxSpeed,
                                speed: f.speed,
                                target: f.target,
                            };
                        }
                    })
                    .filter(function(f) { return f; });

                let visibleEnemies = playerRoom.enemies
                    .map(function(f) {
                        if (objectInPlayerFOV(f, u)) {
                            return f;
                        }
                    })
                    .filter(function(f) { return f; });

                let roomInfo = {
                    width: playerRoom.width,
                    height: playerRoom.height,
                    teleportPortals: null,
                    playZone: playerRoom.playZone,
                    id: playerRoom.id,
                };

                roomInfo.teleportPortals = playerRoom.teleportPortals.map(function(f) {
                    if (f.portalType === 'roomStart' || f.portalType === 'roomEnd') {
                        return f;
                    }

                    if (objectInPlayerFOV(f, u)) {
                            return f;
                        }
                    })
                    .filter(function(f) { return f; });

                if (game.sendLeaderboard) {
                    u.socketEmit('leaderboard', game.leaderboard);
                }

                u.socketEmitVolatileNoBin('serverTellPlayerMove', roomInfo, visibleCells, visibleEnemies, visibleFood);
            });
            game.sendLeaderboard = false;
        }
    }
}

function updateLeaderboards() {
    for (let gameId in games) {
        if (!(games[gameId].inQueue)) {
            games[gameId].updateLeaderboard();
        }
    }
}

function trySendUpdates() {
    try {
        sendUpdates();
    }
    catch (err) {
        util.error(err);
    }
}

setInterval(moveloop, 1000 / 60);
setInterval(updateLeaderboards, 1000);
setInterval(trySendUpdates, 1000 / config.networkUpdateFactor);

// Ip configs   
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, function() {
    util.log('Listening on ' + ipaddress + ':' + serverport);
});

process.on('SIGTERM', () => {
    safeShutdown();
  });

process.on('SIGINT', () => {
    safeShutdown();
});

function safeShutdown() {
    util.log('SIGTERM signal received, closing server');
    io.emit('serverShutdown');

    timeTrialDBHandler.shutdown().then(() => {
        analyticsDBHandler.shutdown().then(() => {
            process.exit(0);
        });
    });
}
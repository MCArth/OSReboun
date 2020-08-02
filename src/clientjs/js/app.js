var ChatClient = require('./chatClient');
var Canvas = require('./canvas');
require('./clientAdminFunctions');
var drawAmountBar = require('./drawAmountBar');
var util = require('../../server/lib/util');

// var defaultBorderColour = 'hsl(0, 5%, 10%)';

const foodSettings = {
    border: 4,
    sides: 10,
    // borderColour: defaultBorderColour
}

const enemySettings = {
    border: 20,
    sides: 3,
    // borderColour: defaultBorderColour
}

const playerSettings = {
    sides: 40,
    border: 10,
    // borderColour: defaultBorderColour
}

const portalSettings = {
    border: 15,
    sides: 40,
    // borderColour: defaultBorderColour
}

var global = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    mobile: false,

    playZoneBackgroundColour: '#CBCBCB',
    playZone: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    },

    drawSettings: {
        textColor: '#FFFFFF',
        textBorder: '#000000',
        textBorderSize: 3,
        defaultSize: 30
    },

    // Canvas
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    gameWidth: 0,
    gameHeight: 0,
    xoffset: -0,
    yoffset: -0,
    gameStart: true,
    disconnected: false,
    died: false,
    kicked: false,
    startPingTime: 0,
    backgroundColor: '#f2fbff',
    outsideBackgroundColor: '#333333',
    lineColor: '#000000',
};

var DBServer = 'https://reboun.io'; 
window.DBServer = DBServer; // used in other files
const servers = ['/', "https://nasf1.reboun.io/"]
let chosenServer = '/';
let serverTextStr = {
    '/': 'EU (Amsterdam)',
    'https://nasf1.reboun.io/': 'NA (San Francisco)',
}

let pingSockets = [];
function initiallyPingServers() {
    let responsesLeft = servers.length;
    for (let i = 0; i < servers.length; i++) {
        let pingSocket = io(servers[i]);
        pingSocket.emit('pingcheck');
        pingSockets[i] = pingSocket;
        pingSocket.on('pongcheck', () => {
            if (--responsesLeft) {
                return;
            }
            chooseServer();
        });
    }
}

function chooseServer() { // need to update as io() will ruin it
    let responsesLeft = servers.length;
    let responseTimes = [];
    for (let i = 0; i < servers.length; i++) {
        let pingSocket = pingSockets[i];
        let t1 = new Date().getTime();
        pingSocket.emit('pingcheck');
        pingSocket.on('pongcheck', () => {
            responseTimes[i] = new Date().getTime()-t1;
            if (--responsesLeft) {
                return;
            }
            let lowestPing = 1000000000;
            let lowestIdx = 0;
            for (let j = 0; j < responseTimes.length; j++) {
                if (responseTimes[j] < lowestPing) {
                    lowestPing = responseTimes[j]
                    lowestIdx = j;
                }
            }
            chosenServer = servers[lowestIdx];
            let toServer = servers[Math.abs(lowestIdx-1)]; // hack, change when more servers added
            setSwapServerText(serverTextStr[chosenServer], serverTextStr[toServer]);
            console.log(responseTimes);
        });
    }
}
initiallyPingServers();


function hslToString(hue, saturation, lightness) {
    return "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";
}

function radiusToNumSidesMedRes(radius) {
    return Math.ceil(enemy.radius/2);
}

function radiusToNumSidesHighRes(radius) {
    return Math.ceil(enemy.radius);
}

function cookieStrToJSON(cookieString) {
    let output = {};
    cookieString.split(/\s*;\s*/).forEach( (pair) => {
        pair = pair.split(/\s*=\s*/);
        output[pair[0]] = pair.splice(1).join('=');
    });
    return output;
}

function addCookie(strKey, strVal) {
    document.cookie = `${strKey}=${strVal};expires=${cookieExpDate};path=/`;
}

const cookieExpDate = "Fri, 19 Jan 2038, 04:14:07 GMT"

let myCookies = cookieStrToJSON(document.cookie);

let player = {
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
    target: {x: 0, y: 0},
    expInCurrLvl: 0,
    expToNextLvl: 1,
};

global.player = player;

let foods = [];
let users = [];
let enemies = [];
let portals = [];
let leaderboard = [];

window.canvas = new Canvas(global);
window.chat = new ChatClient();

let c = window.canvas.cv;
let graph = c.getContext('2d', { alpha: false });

let offScreenCanvases = {};

let playerNameInput = document.getElementById('playerNameInput');
var socket; // used in other files

let debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

function preJoinQueue() {
    // do ads stuff here
    joinQueue();
}

function joinQueue() {

    socket = io(chosenServer);
    setupSocket(socket);

    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    global.screenWidth = window.innerWidth;
    global.screenHeight = window.innerHeight;

    player.analytics = analytics;
    player.name = global.playerName;
    player.screenWidth = window.innerWidth;
    player.screenHeight = window.innerHeight;
    player.target = window.canvas.target;
    global.player = player;
    window.chat.player = player;
    socket.emit('queue', player);

    window.canvas.socket = socket;
    global.socket = socket;
    window.chat.socket = socket;
}

var serverPlayers;

function resetQueueScreen() {
    if (modeCurrVote) {
        document.getElementById(modeCurrVote + "Count").style.color = "white";
    }
    if (mapCurrVote) {
        document.getElementById("map" + mapCurrVote + "Count").style.color = "white";
    }
    modeCurrVote = null;
    mapCurrVote = null;
    startNowClicked = false;
}

function startGame() {
    global.died = false;

    // Reset the queue screen to default state
    resetQueueScreen();

    queueWrapper.style.display = 'none';
    document.getElementById('gameAreaWrapper').style.display = "block";

    makeUI();

    if (!global.animLoopHandle) {
        animloop();
    }

    c.focus();

    window.chat.registerFunctions();
    global.gameStart = true;

    document.getElementById('spawn_cell').play();
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    return regex.exec(playerNameInput.value) !== null;
}

let mapCurrVote = null, modeCurrVote = null, startNowClicked = false;
window.onload = function() {
    document.getElementById("otherServer").onclick = swapServers;
    document.getElementById("lbMap1").onclick = () => {changeLeaderboardMapClick('lbMap1')};
    document.getElementById("lbMap2").onclick = () => {changeLeaderboardMapClick('lbMap2')};
    document.getElementById("lbMap3").onclick = () => {changeLeaderboardMapClick('lbMap3')};
    let startWrapper = document.getElementById('startMenuWrapper');
    let startButton = document.getElementById('startButton');
    let nickErrorText = document.querySelector('#startMenu .input-error');

    let queueWrapper = document.getElementById('queueWrapper');
    let startNowButton = document.getElementById('startNowButton');

    startButton.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startButtonUsed();
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        let key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startButtonUsed();
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });

    function startButtonUsed() {
        startWrapper.style.display = "none";
        queueWrapper.style.display = "table-cell";
        preJoinQueue();
    }

    startNowButton.onclick = () => {
        startNowClicked = !startNowClicked;
        
        socket.emit('changeStartVote', startNowClicked);
    };

    let modeVoteButtonCallback = (button) => {
        if (modeCurrVote) {
            document.getElementById(modeCurrVote + "Count").style.color = "white";
        }
        if (modeCurrVote === button) {
            modeCurrVote = null;
        }
        else {
            modeCurrVote = button;
            document.getElementById(modeCurrVote + "Count").style.color = "#2ecc71";
        }
        socket.emit('changeModeVote', modeCurrVote);
    };

    //For mode voting
    document.getElementById('soloButton').onclick = () => {
        modeVoteButtonCallback("solo");
    };
    document.getElementById('teamButton').onclick = () => {
        modeVoteButtonCallback("team");
    };
    document.getElementById('co-opButton').onclick = () => {
        modeVoteButtonCallback("co-op");
    };

    let mapVoteButtonCallback = (voteFor) => {
        // just an if will return false for the 0th map
        if (typeof mapCurrVote === "number") {
            document.getElementById("map" + mapCurrVote + "Count").style.color = "white";
        }
        if (mapCurrVote === voteFor) {
            // User is deselcting his vote
            mapCurrVote = null;
        }
        else {
            // user voted for a different map to the previous vote
            mapCurrVote = voteFor;
            document.getElementById("map" + mapCurrVote + "Count").style.color = "#2ecc71";
        }
        socket.emit('changeMapVote', mapCurrVote);
    };

    //For map voting
    document.getElementById('map0Button').onclick = () => {
        socket.emit('changeMapVote', 0);
        mapVoteButtonCallback(0);
    };
    document.getElementById('map1Button').onclick = () => {
        mapVoteButtonCallback(1);
    };
    document.getElementById('map2Button').onclick = () => {
        mapVoteButtonCallback(2);
    };

    document.getElementById('homeScreenButton').onclick = () => {
        document.getElementById('gameOverWrapper').style.display = 'none';
        startWrapper.style.display = "table-cell";
    };

    document.getElementById('playAgainButton').onclick = () => {
        document.getElementById('gameOverWrapper').style.display = 'none';
        queueWrapper.style.display = "table-cell";
        preJoinQueue();
    };

    document.getElementById('leaderboardBackground').onclick = () => {
        let target = event.target || event.srcElement;
        // filter event handling when the event bubbles
        if (target.id === 'leaderboardBackground') {
            document.getElementById('leaderboardBackground').style.display = "none";
        }
    };

    document.getElementById('leaderboardExit').onclick = () => {
        document.getElementById('leaderboardBackground').style.display = 'none';
    };

    let firstMapDisplayed = "initial 1";
    document.getElementById('bestTimeButton').onclick = () => {
        document.getElementById('leaderboardBackground').style.display = "block";
        event.stopPropagation();

        socket = io(DBServer);
        socket.emit('bestTimes');
        socket.on('bestTimesResponse', (bestTimesList) => {
            bestTimesAllMaps = bestTimesList;
            changeLeaderboardMapClick('lbMap1');
            socket.disconnect(true);
        });
    };
};

let bestTimesAllMaps;
let currEle = document.getElementById('lbMap1');
let lbEleNameMappings = {
    "lbMap1": "initial 1",
    "lbMap2": "Original Remastered",
    "lbMap3": "Original but Long",
}
function changeLeaderboardMapClick(toClick) {
    currEle.className = "mapLeaderboardName";
    currEle = document.getElementById(toClick);
    currEle.className = "selectedMapLBButton";
    displayLBTimesForMap(lbEleNameMappings[toClick]);
}

function displayLBTimesForMap(mapName) {
    let bestTimes = bestTimesAllMaps[mapName];
    const table = document.getElementById('leaderboardTable');
    table.textContent = '';
    let innerHTML = "<tr><th>#</th><th>Name</th><th>⌛</th></tr>".split('');
    if (bestTimes) { 
        for (let i = 0; i < bestTimes.length; i++) {
            let time = bestTimes[i].time;
            let mins = Math.floor(time/60);
            let secs = (time%60).toString().split('.')[0];
            if (secs.length === 1) {
                secs = `0${secs}`;
            }
            let formattedTime = `${mins}:${secs}`;
            let newEntry = `<tr class="leaderboardEntry"><td>${i+1}</td><td>${bestTimes[i].name}</td><td>${formattedTime}</td></tr>`;
            innerHTML.push(...newEntry.split(''));
        }
    }
    innerHTML = innerHTML.join('');
    table.innerHTML = innerHTML;
}

function swapServers() {
    let notChosen;
    let chosen;
    for (let i = 0; i < servers.length; i++) {
        if (servers[i] !== chosenServer) {
            chosen = servers[i];
        }
        if (servers[i] === chosenServer) {
            notChosen = servers[i];
        }
    }
    chosenServer = chosen;
    setSwapServerText(serverTextStr[chosen], serverTextStr[notChosen]);
}

function setSwapServerText(currServerText, otherServerText) {
    document.getElementById("currServer").innerText = `You are connected to: ${currServerText} `;
    document.getElementById("otherServer").innerText = `Connect to ${otherServerText} instead`;
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on('gameSetup', function(data) {
        global.gameWidth = data.gameWidth;
        global.gameHeight = data.gameHeight;
        player.id = data.yourId;
        global.defaultRatio = data.defaultRatio;
        global.ratioBound = data.ratioBound;
        resize();
    });

    let gameMode, inQueue = true;
    let currMap;
    socket.on('gameStart', (gamemode, mapName) => {
        player.roomId = undefined; // set for smoothing
        gameMode = gamemode;
        startGame();
        inQueue = false;
        currMap = mapName;
    });

    socket.on('send3Maps', function(possibleMaps){
        document.getElementById("map0Button").textContent = possibleMaps[0].officialName;
        document.getElementById("map1Button").textContent = possibleMaps[1].officialName;
        document.getElementById("map2Button").textContent = possibleMaps[2].officialName;
    });

    socket.on('playerDied', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? '_' : data.name) + '</b> was eaten.');
    });

    socket.on('playerDisconnect', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? '_' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? '_' : data.name) + '</b> joined.');
    });

    let lobbyInfo = {
        numPlayers: 0,
        // startVoteCount: 0,
        // typeVotes: {solo: 0, team: 0, 'co-op': 0},
    }

    socket.on('numPlayersChanged', (newNum) => {
        document.getElementById('numPlayers').textContent = newNum + " of 12";
        document.getElementById('startNowButton').textContent = "Start Now " + startVoteCount + "/" + Math.ceil(newNum/2);
        lobbyInfo.numPlayers = newNum;
    });

    let startVoteCount = 0;
    socket.on('startVotesChanged', (newVoteCount) => {
        document.getElementById('startNowButton').textContent = "Start Now " + newVoteCount + "/" + Math.ceil((lobbyInfo.numPlayers+1)/2);
        startVoteCount = newVoteCount;
    });

    socket.on('modeVotesChanged', (newVotes) => {
        document.getElementById('soloCount').textContent = newVotes.solo;
        document.getElementById('teamCount').textContent = newVotes.team;
        document.getElementById('co-opCount').textContent = newVotes["co-op"];
    });

    socket.on('mapVotesChanged', (newVotes) => {
        document.getElementById('map0Count').textContent = newVotes[0];
        document.getElementById('map1Count').textContent = newVotes[1];
        document.getElementById('map2Count').textContent = newVotes[2];
    });

    socket.on('startingInSecs', (startingIn) => {
        if (startingIn < 10) {
            startingIn = "0" + parseInt(startingIn);
        } 
        document.getElementById('gameStartingIn').textContent = "Game automatically starting in 0:" + startingIn;
    });

    let results;
    socket.on('leaderboard', function (leaderboard) {
        results = leaderboard;

        let status = '<span class="title">Position</span>';
        for (let i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0) {
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + ": " + leaderboard[i].score +  "</span>";
                }
                else {
                    status += '<span class="me">' + (i + 1) + ". _" + ": " + leaderboard[i].score + "</span>";
                }
            } else {
                if(leaderboard[i].name.length !== 0) {
                    status += (i + 1) + '. ' + leaderboard[i].name  + ": " + leaderboard[i].score;
                }
                else {
                    status += (i + 1) + ". _: " + leaderboard[i].score;
                }
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (roomInfo, userData, enemiesData, foodsList) {
        let playerData;
        for(var i = 0; i < userData.length; i++) {
            if(userData[i].id === player.id) {
                playerData = userData[i];
                i = userData.length;
            }
        }
        var xoffset = player.x - playerData.x;
        var yoffset = player.y - playerData.y;

        if (player.expInCurrLvl !== playerData.expInCurrLvl || player.expToNextLvl !== playerData.expToNextLvl) {
            player.expInCurrLvl = playerData.expInCurrLvl;
            player.expToNextLvl = playerData.expToNextLvl;
            player.level = playerData.level;
            makeUI();
        }

        let notNewRoom = player.roomId === playerData.roomId;

        global.room = roomInfo;
        global.gameWidth = roomInfo.width;
        global.gameHeight = roomInfo.height;
        global.playZone = roomInfo.playZone;
        global.roomId = roomInfo.id;

        let ticksToDiscardServerPos = 5;

        if (notNewRoom) {
            for (let i = 0; i < userData.length; i++) {
                let thisUser = userData[i];
                let currI = findIndex(users, thisUser.id);
                if (currI !== -1) {
                    let clientUser = users[currI];
                    thisUser.serverLocation = {
                        x: thisUser.x, 
                        y: thisUser.y,
                        ticksLeft: ticksToDiscardServerPos,
                        target: thisUser.target,
                    };
                    thisUser.x = clientUser.x;
                    thisUser.y = clientUser.y;
                }
            }

            for (let i = 0; i < enemiesData.length; i++) {
                let thisEnemy = enemiesData[i];
                let currI = findIndex(enemies, thisEnemy.id);
                if (currI !== -1) {
                    let clientEnemy = enemies[currI];
                    thisEnemy.serverLocation = {
                        x: thisEnemy.x, 
                        y: thisEnemy.y,
                        ticksLeft: ticksToDiscardServerPos,
                    };
                    thisEnemy.x = clientEnemy.x;
                    thisEnemy.y = clientEnemy.y;
                }
            }
        }
        player = playerData;
        users = userData;
        foods = foodsList;
        enemies = enemiesData;
        portals = roomInfo.teleportPortals;
        serverGaveUpdate = true;

        player.xoffset = xoffset;
        player.yoffset = yoffset;

        player.xoffset = isNaN(xoffset) ? 0 : xoffset;
        player.yoffset = isNaN(yoffset) ? 0 : yoffset;

        player.target = window.canvas.target; // Updated for local movement
    });

    socket.on('youDied', function () {
        global.gameStart = false;
        global.died = true;
        cancelAnimLoop();
        endGame();
    });

    socket.on('gameOver', () => {
        global.gameStart = true;
        cancelAnimLoop();
        endGame();
    });

    socket.on('kick', function (data) {
        global.gameStart = false;
        reason = data;
        global.kicked = true;
        socket.disconnect();
        endGame();
        socket = undefined;
    });

    let serverShutdown = false;
    socket.on('serverShutdown', () => {
        if (inQueue) {
            document.getElementById('queueWrapper').style.display = 'none';
            document.getElementById('startMenuWrapper').style.display = 'table-cell';
        }
        else {
            serverShutdown = true;
            endGame();
        }
    });

    function endGame() {

        if (global.roomId === "win1") {
            // client side win stuff goes here
        }

        document.getElementById('gameAreaWrapper').style.display = 'none';
        document.getElementById('gameOverWrapper').style.display = 'table-cell';
        socket.disconnect();
        let position = null;
        let teamsSeen = [];
        for (let i = 0; i < results.length; i++) {
            if (gameMode === "team") {
                if (teamsSeen.indexOf(results[i].team) === -1) {
                    teamsSeen.push(results[i].team);
                }
                if (results[i].team === player.team && !position) {
                    position = teamsSeen.length;
                }
            }
            else if (results[i].id === player.id) {
                position = i+1;
                break;
            }
        }

        let headerMessage;
        if (serverShutdown) {
            headerMessage = "Server restart, sorry :("
            document.getElementById('playAgainButton').style.display = 'none';
        }
        else if (global.died) {
            headerMessage = "You Died";
        }
        else if (position === 1) {
            headerMessage = "You Win!";
        }
        else {
            headerMessage = "You Finished!"
        }
        document.getElementById('gameOverTitle').innerText = headerMessage;

        let positionTitle = "";
        if (gameMode === "team") {
            positionTitle += "Team ";
        }
        positionTitle += "Position";
        if (global.died) {
            positionTitle += " at Time of Death"
        }
        document.getElementById('positionTitle').innerText = positionTitle;

        let numOutOf;
        if (gameMode === "team") {
            numOutOf = teamsSeen.length;
        }
        else {
            numOutOf = results.length;
        }
        document.getElementById('position').innerText = position + "/" + numOutOf;

        socket = undefined;
    }
}

function makeUI() {
    let uiCanvas = document.createElement('canvas');
    uiCanvas.width = player.screenWidth;
    uiCanvas.height = player.screenHeight;
    let context = uiCanvas.getContext('2d');
    offScreenCanvases.ui = uiCanvas;

    drawAmountBar(
        player.screenWidth*0.22, 
        player.screenHeight*0.027,
        context, 
        undefined, undefined, 
        player.screenWidth/2, 
        player.screenHeight*0.97,
        player.expInCurrLvl/player.expToNextLvl,
        "black",
        "gold",
        0.75,
        "Lvl " + player.level,
        global.drawSettings,
        );
}

function drawUI() {
    graph.drawImage(offScreenCanvases.ui, 0, 0);
}

function convertGameCoordToCanvasCoord(x, y) {
    return {
        'x': x-player.x+global.screenWidth/2,
        'y': y-player.y+global.screenHeight/2
    }
}

function drawCircle(centerX, centerY, radius, numSides) {
    var theta = 0;
    var x = 0;
    var y = 0;

    graph.beginPath();

    for (var i = 0; i < numSides; i++) {
        theta = (i / numSides) * 2 * Math.PI;
        x = centerX + radius * Math.sin(theta);
        y = centerY + radius * Math.cos(theta);
        graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

function drawObjWithA(obj, numSides, lineWidth, a) {
    graph.strokeStyle = obj.borderColour;
    graph.fillStyle = 'hsla(' + obj.hue + ',' + obj.saturation + '%,' + obj.lightness + '%, ' + a + ')';
    graph.lineWidth = lineWidth;
    let canvasCoord = convertGameCoordToCanvasCoord(obj.x, obj.y);
    drawCircle(
        canvasCoord.x,
        canvasCoord.y,
        obj.radius-lineWidth/2,
        numSides
    );
}

function drawObj(obj, numSides, lineWidth) {
    drawObjWithA(obj, numSides, lineWidth, 1);
}

function drawPlayers() {

    for(var i=0; i<users.length; i++)
    {   
        let user = users[i];
        let numSides = playerSettings.sides;
        if (user.id === player.id) {
            user.hue = 195;
        }
        else if (user.team === player.team) {
            user.hue = 120;
        }
        else {
            user.hue = 40;
        }

        if (user.state === 'dead') {
            drawObjWithA(user, numSides, 1, 0.5);
            drawTextOnObj(user, Math.ceil(user.timeTillDeath));
        }
        else if (user.state === 'alive') {
            drawObj(user, numSides, playerSettings.border);
            drawTextOnObj(user, user.name);
        }
    }
}

function drawPortal(portal) {
    graph.fillStyle = hslToString(portal.hue, portal.saturation, portal.lightness);

    if (portal.portalType === "circle") {
        drawObj(portal, portalSettings.sides, portalSettings.border);
        if (portal.roomTo === "win1") {
            portal.roomTo = "win";
        }
    }
    else if (portal.portalType === "roomStart") {
        if (player.x <= global.screenWidth/2 + portal.width) {
            graph.fillRect(
                global.screenWidth/2 - player.x,
                global.screenHeight/2 - player.y,
                portal.width,
                global.gameHeight
            );
            drawLine(
                portal.borderColour,
                portalSettings.border,
                global.screenWidth/2 - player.x + portal.width - portalSettings.border/2,
                global.screenHeight/2 - player.y,
                global.screenWidth/2 - player.x + portal.width - portalSettings.border/2,
                global.screenHeight/2 - player.y + global.gameHeight
            );
            if (portal.roomTo.toString().length === 1) {
                portal.radius = 200;
            }
            else {
                portal.radius = 150;
            }
        }
        portal.x = portal.width/2;
        portal.y = global.gameHeight/2;
    }
    else if (portal.portalType === "roomEnd") {
        if (global.gameWidth - player.x - portal.width <= global.screenWidth/2) {
            graph.fillRect(global.gameWidth + global.screenWidth/2 - player.x - portal.width,
                global.screenHeight/2 - player.y,
                portal.width,
                global.gameHeight
            );
            drawLine(
                portal.borderColour,
                portalSettings.border,
                global.gameWidth + global.screenWidth/2 - player.x - portal.width + portalSettings.border/2,
                global.screenHeight/2 - player.y,
                global.gameWidth + global.screenWidth/2 - player.x - portal.width + portalSettings.border/2,
                global.screenHeight/2 - player.y + global.gameHeight
            );
            if (portal.roomTo.toString().length === 1) {
                portal.radius = 200;
            }
            else {
                portal.radius = 150;
            }
        }
        portal.x = global.gameWidth - portal.width/2;
        portal.y = global.gameHeight/2;
    }
    drawTextOnObj(portal, portal.text);
}

function drawLine(colour, width, startX, startY, endX, endY) {
    graph.beginPath();
    graph.strokeStyle = colour;
    graph.lineWidth = width;
    graph.lineCap = "butt";
    graph.moveTo(startX, startY);
    graph.lineTo(endX, endY);
    graph.stroke();
    graph.lineCap = "round";
}

function drawTextOnObj(obj, text) {
    let fontSize = Math.max(obj.radius / 3, 12);
    graph.lineWidth = global.drawSettings.textBorderSize;
    graph.fillStyle = global.drawSettings.textColor;
    graph.strokeStyle = global.drawSettings.textBorder;
    graph.miterLimit = 1;
    graph.lineJoin = 'round';
    graph.textAlign = 'center';
    graph.textBaseline = 'middle';
    graph.font = 'bold ' + fontSize + 'px Ubuntu';

    let canvasPos = convertGameCoordToCanvasCoord(obj.x, obj.y)
    graph.strokeText(text, canvasPos.x, canvasPos.y);
    graph.fillText(text, canvasPos.x, canvasPos.y);
}

function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawgrid() {
     graph.lineWidth = 1;
     graph.strokeStyle = global.lineColor;
     graph.globalAlpha = 0.15;
     graph.beginPath();

    for (let x = global.xoffset - player.x; x < global.screenWidth; x += global.screenHeight / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, global.screenHeight);
    }

    for (let y = global.yoffset - player.y ; y < global.screenHeight; y += global.screenHeight / 18) {
        graph.moveTo(0, y);
        graph.lineTo(global.screenWidth, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
}

function drawBackgrounds() {
    graph.lineWidth = 0;
    graph.strokeStyle = global.drawSettings.borderColor;

    graph.fillStyle = global.outsideBackgroundColor;

    // Left-vertical.
    if (player.x <= global.screenWidth/2) {
        graph.fillRect(0, 0, global.screenWidth/2 - player.x, global.screenHeight);
    }

    // Top-horizontal.
    if (player.y <= global.screenHeight/2) {
        graph.fillRect(0, 0, global.screenWidth, global.screenHeight/2 - player.y);
    }

    // Right-vertical.
    if (global.gameWidth - player.x <= global.screenWidth/2) {
        graph.fillRect(global.gameWidth + global.screenWidth/2 - player.x, 0, global.screenWidth, global.screenHeight);
    }

    // Bottom-horizontal.
    if (global.gameHeight - player.y <= global.screenHeight/2) {
        graph.fillRect(0, global.gameHeight + global.screenHeight/2 - player.y, global.screenWidth, global.screenHeight);
    }

    // todo: could be inefficient to draw this every time given cases where you can't see a playzone?
    graph.lineWidth = 0;
    graph.fillStyle = global.playZoneBackgroundColour;
    let pzInfo = global.playZone;
    graph.fillRect(global.screenWidth/2+pzInfo.x-player.x, global.screenHeight/2+pzInfo.y-player.y, pzInfo.width, pzInfo.height)
}

window.requestAnimFrame = (function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.moequestAnimationFrame     ||
            function( callback ) {
                window.setTimeout(callback, 1000 / 60);
            };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame     ||
            window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function cancelAnimLoop() {
    window.cancelAnimationFrame(global.animLoopHandle);
    global.animLoopHandle = undefined;
}

var clientDoesUpdates = true;
var serverGaveUpdate = false;
function gameLoop() {

    player.target = window.canvas.target;
    if (clientDoesUpdates) {
        clientMoveObjects();
    }

    graph.fillStyle = global.backgroundColor;
    graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

    //drawgrid();
    drawBackgrounds();
    foods.forEach((food) => {
        drawObj(food, foodSettings.sides, foodSettings.border);
    });

    portals.forEach((portal) => {
        drawPortal(portal);
    });

    enemies.forEach( (enemy) => {
        let numSides = Math.ceil(enemy.radius/2);
        drawObj(enemy, numSides, enemySettings.border);
    });

    drawPlayers();
    drawUI();
    socket.emit('heartbeatAndTarget', window.canvas.target); // playerSendTarget "Heartbeat".
    serverGaveUpdate = false;
}

function clientMoveObjects() {
    users.forEach ((user) => {
        movePlayer(user);
    });
    enemies.forEach((enemy) => {
        moveEnemy(enemy);
    });
}

function interpolateIfNeeded(obj) {
    if (obj.serverLocation) {
        obj.x += (obj.serverLocation.x - obj.x)/10;
        obj.y += (obj.serverLocation.y - obj.y)/10;
        obj.serverLocation.ticksLeft--;
        if (obj.serverLocation.ticksLeft === 0) {
            delete obj.serverLocation;
        }
    }
}

function movePlayer(p) {
    if (p.state === "dead") {
        interpolateIfNeeded(p);
        return;
    }
    if (p.serverLocation) {
        let newServerPos = movePlayerFromGivenTargetXY(p, p.serverLocation.x, p.serverLocation.y, p.serverLocation.target);
        p.serverLocation.x = newServerPos.x;
        p.serverLocation.y = newServerPos.y;
    }
    let newClientPos = movePlayerFromGivenTargetXY(p, p.x, p.y, p.target);
    p.x = newClientPos.x;
    p.y = newClientPos.y;
    interpolateIfNeeded(p);
}

function movePlayerFromGivenTargetXY(p, x, y, target) {
    let dist = Math.sqrt(Math.pow(target.x, 2) + Math.pow(target.y, 2));
    let distScaleFrom = 200;
    if (dist < distScaleFrom) {
        p.speed = p.maxSpeed*(dist/distScaleFrom);
    }
    else {
        p.speed = p.maxSpeed;
    }
    let deg = Math.atan2(target.y, target.x);

    let deltaY = p.speed * Math.sin(deg);
    let deltaX = p.speed * Math.cos(deg);

    if (!isNaN(deltaY)) {
        y += deltaY;
    }
    if (!isNaN(deltaX)) {
        x += deltaX;
    }
    if (x > global.room.width - p.radius) {
        x = global.room.width - p.radius;
    }
    if (y > global.room.height - p.radius) {
        y = global.room.height - p.radius;
    }
    if (x < p.radius) {
        x = p.radius;
    }
    if (y < p.radius) {
        y = p.radius;
    }
    return {
        x: x,
        y: y,
    }
}

function moveEnemy(e) {
    let direction = e.direction;
    let radDirection = degToRad(direction);
    let deltaY = e.speed * Math.sin(radDirection);
    let deltaX = e.speed * Math.cos(radDirection);

    interpolateIfNeeded(e);

    let x = e.x+deltaX;
    let y = e.y+deltaY;
    let newMoveInfo = bounceIfNeeded(x, y, direction, e);
    e.direction = newMoveInfo.direction;
    e.x = newMoveInfo.x;
    e.y = newMoveInfo.y;

}

function bounceIfNeeded(x, y, direction, obj) {
    let room = global.room;
    let radius = obj.radius;
    if (x >= room.playZone.x+room.playZone.width-radius) {
        x = room.playZone.x+room.playZone.width-radius;
        direction = 180-direction;;
    }
    if (y >= room.playZone.y+room.playZone.height-radius) {
        y = room.playZone.y+room.playZone.height-radius;
        direction = -direction;
    }
    if (x <= room.playZone.x+radius) {
        x = room.playZone.x+radius;
        direction = 180-direction;
    }
    if (y <= room.playZone.y+radius) {
        y = room.playZone.y+radius;
        direction = -direction;
    }

    if (direction < 0) {
        direction = 360+direction;
    }

    return {
        x: x,
        y: y,
        direction: direction,
    }
}

function degToRad(deg) {
    return Math.PI*deg/180;
}

function findIndex(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }
    return -1;
};

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    c.width = window.innerWidth;
    c.height = window.innerHeight;
    let ratio = calculateServerToClientRatio(c.width, c.height);
    setRatioTransform(ratio);
    player.screenWidth = global.screenWidth = window.innerWidth*(ratio**-1);
    player.screenHeight = global.screenHeight = window.innerHeight*(ratio**-1);

    socket.emit('windowResized', { screenWidth: window.innerWidth, screenHeight: window.innerHeight });

    makeUI();
}


// could be updated from server at gamestart
let defaultRatio = {
    big: 1920,
    small: 1080,
}
let ratioBound = 16/9;
function calculateServerToClientRatio(width, height) {
    if (height < width) {
        return getRatio(width, height);
    }
    else {
        return getRatio(height, width);
    }
}

function getRatio(bigNum, smallNum) {
    if (bigNum/smallNum < ratioBound) {
        return smallNum/defaultRatio.small;
    } 
    else {
        let adjustedSmall = bigNum*(ratioBound**-1);
        return adjustedSmall/defaultRatio.small;
    }
}

function setRatioTransform(ratio) {
    graph.setTransform(1, 0, 0, 1, 0, 0);
    graph.scale(ratio, ratio);
}

socket = io(DBServer);
socket.emit('newVisit');

let analytics = {};
player.analytics = analytics;

if (myCookies.firstTimePlayer === "false") {
    player.analytics.newPlayer = false;
}
else {
    socket.emit("firstTimePlayer");
    player.analytics.newPlayer = true;
    addCookie("firstTimePlayer", "false");
}

window.onbeforeunload = function (event) {
    // add stuff to do before the window is closed
};
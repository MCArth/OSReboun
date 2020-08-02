let util = require('../lib/util');
let getRooms = require('../createRooms').getRooms;
let getMapNames = require('../createRooms').getMapNames;
let ttDBHandler = require('../timeTrialDBHandler');
let ttUtil = require('../timeTrialUtils');
let player = require('./player');
let config = require('../../../config.json');
let botNameHandler = require('../botNameHandler');

let io, sockets;

exports.Game = class Game {
    constructor(params) {
        io = params.io;
        sockets = params.sockets;

        let mustHaveArgs = ["id"];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        this.rooms = getRooms();
        let optionalArgsDefaults = {
            users: [],
            type: undefined,
            typeVotes: {solo: 0, team: 0, "co-op": 0},
            mapVotes: [0,0,0],
            startVotes: 0,
            inQueue: true,
            maxPlayers: 12,
            startAutoIn: 57,
            timeTillDeath: null // Set once gametime chosen
        };
        util.assignCouldHaveArgs(this, optionalArgsDefaults, params);

        this.startedAt = new Date().getTime();
        this.startingIn = 57;

        this.numActiveRealPlayers = 0;
        this.numPlayersInclBots = 0;

        this.winners = [];
        this.sendLeaderboard = false;

        this.map = "initial 1";
        this.gameStartTime = null;

        this.existingBotPaths = [];

        this.shutDown = false;

        this.possibleMaps = this.getRandomMaps();
    }

    addPlayer(player) {
        this.numPlayersInclBots++;
        if (player.playerType === 'player') {
            player.socket.join(this.id);
            this.numActiveRealPlayers += 1;
        }

        this.users.push(player);
        io.in(this.id).emit('numPlayersChanged', this.users.length);
        player.socketEmit('startVotesChanged', this.startVotes);
        player.socketEmit('modeVotesChanged', this.typeVotes);
        player.socketEmit('startingInSecs', this.startingIn);
        player.socketEmit('mapVotesChanged', this.mapVotes);

        if (this.users.length === this.maxPlayers) {
            this.startedAt = new Date().getTime();
            this.startAutoIn = 0;
        }

    }

    tick() {
        if (this.inQueue === false) {
            for (let roomId in this.rooms) {
                let room = this.rooms[roomId];
                if (room.users.length !== 0) {
                    room.tick(this.rooms);
                    this.movePlayers(room);
                }
            }
        }
        else {
            this.updatingStartingIn();
        }
    }

    updatingStartingIn() {
        let sinceStarted = util.differenceInSeconds(new Date().getTime(), this.startedAt);
        let startingIn = Math.ceil(this.startAutoIn - sinceStarted);
        if (sinceStarted > this.startAutoIn) {
            if (this.numActiveRealPlayers > 0) {
                this.startGame();
            }
            else {
                util.pubSub.publish('gameClosed', this);
                this.shutDown = true;
            }
        }
        else if (this.startingIn !== startingIn) {
            this.startingIn = startingIn;
            io.in(this.id).emit('startingInSecs', startingIn);
        }
        io.in(this.id).emit('send3Maps', this.possibleMaps);
    }

    startGame() {
        this.inQueue = false;
        this.setMap();

        // Put the players at the start of the first room
        for (let i = 0; i < this.users.length; i++) {
            if(this.users[i].playerType.localeCompare("bot") == 0){
                this.setBotsPath(i);
            }

            this.users[i].roomId = this.map + "1";
            this.users[i].enterRoom(this.rooms[this.map + "1"]);
        }

        this.setMode();
        this.setTeams(this.type);
        io.in(this.id).emit('gameStart', this.type, this.map);
        this.updateLeaderboard();

        util.log("Game " + this.id + " started");
        util.pubSub.publish('printNumPlayers');
        this.gameStartTime = new Date().getTime();
    }

    setMode() {
        let maxType = null;
        let maxTypeAmount = -1;
        for (let type in this.typeVotes) {
            if (this.typeVotes[type] > maxTypeAmount) {
                maxTypeAmount = this.typeVotes[type];
                maxType = type;
            }
        }
        this.type = maxType;

        if (this.type === 'solo') {
            this.timeTillDeath = 0;
        }
        else {
            this.timeTillDeath = 10;
        }
    }

    setMap(){
        let max = 0;
        for(let i = 0; i < this.mapVotes.length; i++){
            if(this.mapVotes[i] > this.mapVotes[max]){
                max = i;
            }
        }
        this.map = this.possibleMaps[max].internalName;
    }

    setTeams(gamemode) {
        if (gamemode === 'solo') {
            for (let i = 0; i<this.users.length; i++) {
                this.users[i].team = i;
            }
        }
        else if (gamemode === 'team') {
            let teamSize = this.getTeamSize();
            // making sure players go on teams together as much as possible
            this.users.sort((a, b) => {
                if (a.playerType === b.playerType) {
                    return 0;
                }
                else if (a.playerType === "player") {
                    return 1;
                }
                return -1;
            });
            for (let i = 0; i<this.users.length; i++) {
                this.users[i].team = Math.floor(i/teamSize);
            }
        }
        else if (gamemode === 'co-op') {
            for (let i = 0; i<this.users.length; i++) {
                this.users[i].team = 0;
            }
        }
    }

    //Gets the name of 3 maps from the possible list of maps
    getRandomMaps(){
        let mapNames = getMapNames();
        let rand;
        let maps = [];

        if(mapNames.length < 3){
            throw "Needs at least 3 maps to run";
        }

        for(let i = 0; i < 3; i++){
            rand = parseInt(Math.random()*mapNames.length);

            maps.push(mapNames[rand]);
            mapNames.splice(rand, 1);
        }
        return maps;
    }

    getTeamSize() {
        return 2;
    }

    disconnectPlayer(player) {
        if (player.disconnected) {
            return;
        }

        player.disconnected = true;
        if (this.inQueue) {
            util.removeIdFromList(player.id, this.users);
            io.in(this.id).emit('numPlayersChanged', this.users.length);
            this.changeStartVote(player.startVote, false);
            this.changeModeVote(player.modeVote, null);
        }
        else {
            util.removeIdFromList(player.id, this.rooms[player.roomId].users);
            if (player.playerType === 'player') {
                if (player.won) {
                    ttUtil.submitNewLeaderboardTime(player, this);
                }
                ttUtil.submitPlayerTimeTrial(player, this);
            }
        }

        this.numPlayersInclBots--;
        if (player.playerType === 'player') {
            this.numActiveRealPlayers -= 1;
            player.disconnect();
            player.disconnectSocket(true);
            delete sockets[player.id];
            util.log('Player ', player.name, ' disconnected from game ' + this.id);
        }
        if (player.playerType === 'bot' && (player.won || player.died)) {
            botNameHandler.nameFinished(player.name);
        }


        if (this.numActiveRealPlayers === 0 && !this.inQueue && !this.shutDown) {
            util.pubSub.publish('gameClosed', this);
            this.shutDown = true;
            this.gameOver();
        }
    }

    movePlayers(room) {
        for (let user of room.users) {
            if (user.state === 'dead'){
                user.timeTillDeath = this.timeTillDeath-util.differenceInSeconds(user.deathTime, new Date().getTime());
                if (user.timeTillDeath < 0) {
                    user.die();
                }
                continue;
            }
            user.move(room);
        }
    }

    changeStartVote(oldVote, newVote) {
        if (oldVote === true) {
            this.startVotes -= 1;
        }
        if (newVote === true) {
            this.startVotes += 1;
        }

        if (this.startVotes >= Math.ceil((this.users.length+1)/2)  && this.numActiveRealPlayers !== 0) {
            this.startGame();
            return;
        }
        io.in(this.id).emit('startVotesChanged', this.startVotes);
    }

    changeModeVote(oldVote, newVote) {
        this.typeVotes[oldVote] -= 1;
        this.typeVotes[newVote] += 1;
        io.in(this.id).emit('modeVotesChanged', this.typeVotes);
    }

    changeMapVote(oldVote, newVote) {
        this.mapVotes[oldVote] -= 1;
        this.mapVotes[newVote] += 1;
        io.in(this.id).emit('mapVotesChanged', this.mapVotes);
    }

    close() {
        for (let i = 0; i < this.users.length; i++) {
            this.disconnectPlayer(this.users[i]);
        }
    }

    updateLeaderboard() {
        let gameKeepGoing = false;

        let leaderboard = [];
        for (let i = 0; i < this.winners.length; i++) {
            leaderboard.push({
                name: this.winners[i].name,
                score: "WIN",
                team: this.winners[i].team,
                id: this.winners[i].id,
            });
        }
        let notFinished = [];
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].won === false) {
                notFinished.push({
                    name: this.users[i].name, 
                    score: parseInt(this.rooms[this.users[i].roomId].number), 
                    x: this.users[i].x,
                    team: this.users[i].team,
                    id: this.users[i].id,
                });
                if (!(this.users[i].disconnected) && this.users[i].playerType === "player") {
                    gameKeepGoing = true;
                }
            }
        }

        notFinished.sort((p1, p2) => {
            if (p1.score !== p2.score) {
                return p2.score - p1.score;
            }
            else {
                return p2.x - p1.x;
            }
        });
        leaderboard.push(...notFinished);
        this.sendLeaderboard = true;
        this.leaderboard = leaderboard;

        if (!gameKeepGoing) {
            this.gameOver();
        }
    }

    gameOver() {
        io.in(this.id).emit('gameOver');
        for (let i = 0; i < this.users.length; i++) {
            this.disconnectPlayer(this.users[i]);
        }
    }

    setBotsPath(index){
        let result = ttDBHandler.getTimeTrialInfoAndPromise(this, this.map);

        if(result == null){
            this.users[index].botTargetList = null;
            this.users[index].ttTickEvery = 2;
            return;
        }

        // Returns a promise which resolves to the bot object
        return result.promise.then((targetList) => { 
            this.users[index].botTargetList = targetList;
            this.users[index].ttTickEvery = result.info.ttTickEvery;
        });
    }

    addBot() {
        let playerConfig = {
            playerType: "bot",
            name: botNameHandler.getNextName(),
            radius: config.initialPlayerRadius,
            id: ++p, //,id: result.info.id + (++p),
            x: 50,
            y: 500,
            roomId: "1",
            screenWidth: 0,
            screenHeight: 0,
            lastHeartbeat: new Date().getTime(),
            rooms: this.rooms,
            io: io,
            gameId: this.id,
            game: this,
            socket: null,
            ttTickEvery: null,
            botTargetList: null,
        };
        return new Promise((resolve, reject) => {
            let timeToJoin = Math.random()*1000*4+ 1; // 1 sec to 5 sec till bot joins
            setTimeout(() => {
                if (!this.inQueue) {
                    reject();
                    return;
                }
                let newBot = new player.Player(playerConfig);
                this.addPlayer(newBot);
                // util.log("Added bot " + playerConfig.name + " in game " + this.id);
                resolve(newBot);
            }, timeToJoin);
        });
    }
}

let p = 0;
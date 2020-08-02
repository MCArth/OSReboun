'use strict'

var config = require('../../../config.json');
var util = require('../lib/util');
var ttUtil = require('../timeTrialUtils');
var qtUtil = require('../lib/quadTreeUtil');

let io;

exports.Player = class Player {

    /**
     * 
     * @param {*} params
     *      params must contain radius, id, x, y, roomId, screenWidth, screenHeight, name, analytics
     *      could contain score, target, saturation, lightness, borderColour, lastHeartbeat, state, maxSpeed, timeTillDeath, deathTime
     */
    constructor(params) {
        if (!('io' in params))
            throw "err"

        io = params.io;

        this.type = 'player';
        let mustHaveArgs = ['name', 'radius', 'id', 'x', 'y', 'gameId', 'game', 'screenWidth', 'screenHeight', 'playerType'];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        let defaultOptionalArgs = {
            score: 0,
            expInCurrLvl: 0,
            target: {x: 0, y: 0},
            lastHeartbeat: new Date().getTime(),
            state: 'alive',
            level: 1,
            expToNextLvl: 2,
            maxSpeed: 3,
            saturation: 100,
            lightness: 45,
            borderColour: config.defaultBorderColour,
            timeTillDeath: null, // Not used till player dies
            deathTime: null, // Not used till player dies
            modeVote: null,
            startVote: false,
            team: null,
            won: false,
            shape: "circle",
            disconnected: false,
            ttTickEvery: 2,
            botTargetList: null,
            socket: null,
            analytics: null,
            bot1Promise: null,
            bot2Promise: null,
            bot1: null,
            bot2: null,
            seesRatio: 1,
            ratio: 1,
            roomId: null,
        };
        util.assignCouldHaveArgs(this, defaultOptionalArgs, params);

        if (!(this.name) || this.name === "") {
            this.name = "_";
        }

        this.numOfTicksPassed = this.ttTickEvery-1;
        this.ttMoves = []
        this.botListPointer = 0;

        this.finishTime = null;
        this.deathRoom = null;

        if (this.bot1Promise) {
            this.bot1Promise.then((bot1) => {
                if (!this.game.inQueue) {
                    return;
                }
                this.bot1 = bot1;
                bot1.botChangeStartVote(true);
                bot1.botChangeModeVote(this.modeVote);
            }).catch(() => {
                // game already started
            });
        }
        if (this.bot2Promise) {
            this.bot2Promise.then((bot2) => {
                if (!this.game.inQueue) {
                    return;
                }
                this.bot2 = bot2;
            }).catch(() => {
                // game already started
            });
        }
    }

    move(room) {
        ttUtil.updateTargetIfBot(this);
        
        let oldPlayer = util.shallowClone(this);
    
        let target = {
            x: this.target.x,
            y: this.target.y
        };

        let dist = Math.sqrt(Math.pow(target.x, 2) + Math.pow(target.y, 2));
        let distScaleFrom = 200;
        if (dist < distScaleFrom) {
            this.speed = this.maxSpeed*(dist/distScaleFrom);
        }
        else {
            this.speed = this.maxSpeed;
        }
        let deg = Math.atan2(target.y, target.x);
    
        let deltaY = this.speed * Math.sin(deg);
        let deltaX = this.speed * Math.cos(deg);
    
        if (!isNaN(deltaY)) {
            this.y += deltaY;
        }
        if (!isNaN(deltaX)) {
            this.x += deltaX;
        }
        if (this.x > room.width - this.radius) {
            this.x = room.width - this.radius;
        }
        if (this.y > room.height - this.radius) {
            this.y = room.height - this.radius;
        }
        if (this.x < this.radius) {
            this.x = this.radius;
        }
        if (this.y < this.radius) {
            this.y = this.radius;
        }
        qtUtil.updateQuadTree(room, oldPlayer, this);

        ttUtil.storePlayerMoveIfNeeded(this);
    }

    feint() {
        if (this.state === 'alive') {
            this.state = 'dead';
            this.deathTime = new Date().getTime();
        }
    }

    die() {
        this.deathRoom = this.roomId;
        if (this.playerType === "player") {
            util.log("Player", this.name, "died");
        }
        this.socketEmit('youDied');
        this.game.disconnectPlayer(this);
    }

    disconnect() {
        io.emit('playerDisconnect', { name: this.name });
    }

    leaveRoom(room) {
        util.removeIdFromList(this.id, room.users);
    
        if (room.users.length === 0) {
            room.foods = [];
            room.quadTree.clear();
        }
    }

    enterRoom(room) {
        if (room.users.length === 0) {
            util.pubSub.publish("generateNewRoomQuadTree", room);
        }
        room.users.push(this);
        this.roomId = room.id;

        if(room.winnerRoom && !(this.won)) {
            this.finishMap();
        }
    }

    finishMap() {
        this.game.winners.push(this);
        this.won = true;
        this.finishTime = new Date().getTime();
        this.socketEmit('gameOver');
        this.game.disconnectPlayer(this);
    }

    moveRooms(roomFrom, roomTo, toX, toY) {
        this.leaveRoom(roomFrom);
        this.enterRoom(roomTo);
        this.x = toX;
        this.y = toY;
    }

    eatFood(room, food) {
        food.beEaten(room);
        this.increaseExp(1);
    }

    increaseExp(expAmount) {
        this.score += expAmount;
        this.expInCurrLvl += expAmount;
        while (this.expInCurrLvl >= this.expToNextLvl) {
            this.expInCurrLvl = this.expInCurrLvl-this.expToNextLvl;
            this.levelUp();
        } 
    }

    levelUp() {
        this.maxSpeed += 1
        this.expToNextLvl = this.expToNextLvl*1.3;
        this.level++;
    }

    tick() {
        if(this.playerType === 'player' && util.differenceInSeconds(this.lastHeartbeat, new Date().getTime()) > config.maxHeartbeatIntervalSeconds) {
            let kickMessage = 'Last heartbeat received over ' + config.maxHeartbeatIntervalSeconds + ' seconds ago.';
            this.kickWithEvent(kickMessage);
            util.log("kicking " + this.name + "due to not receiving heartbeat")
        }
    
        this.move();
        this.checkCollisions();
    }

    kickWithEvent(message) {
        this.socketEmit('kick', message);
        this.game.disconnectPlayer(this);
    }

    socketEmit(event, ...data) {
        if (this.playerType !== 'player') {
            return;
        }
        this.socket.binary('false').emit(event, ...data);
    }

    disconnectSocket(closeUnderlyingConnectionBool) {
        if (this.playerType !== 'player') {
            return;
        }
        this.socket.disconnect(closeUnderlyingConnectionBool);
    }

    socketEmitVolatileNoBin(event, ...data) {
        if (this.playerType !== 'player') {
            return;
        }
        this.socket.binary('false').volatile.emit(event, ...data);
    }

    botChangeStartVote(newStartVote) {
        if (this.startVoteTimeout) {
            clearTimeout(this.startVoteTimeout);
        }
        this.startVoteTimeout = setTimeout(() => {
            if (!this.game.inQueue) {
                return;
            }
            this.game.changeStartVote(this.startVote, newStartVote);
            this.startVote = newStartVote;
        }, this.botTimeToChangeVote());
    }

    botChangeModeVote(newModeVote) {
        if (this.modeVoteTimeout) {
            clearTimeout(this.modeVoteTimeout);
        }
        this.modeVoteTimeout = setTimeout(() => {
            if (!this.game.inQueue) {
                return;
            }
            this.game.changeModeVote(this.modeVote, newModeVote);
            this.modeVote = newModeVote;
        }, this.botTimeToChangeVote());
    }

    botChangeMapVote(newMapVote){
        if (this.mapVoteTimeout) {
            clearTimeout(this.mapVoteTimeout);
        }
        this.mapVoteTimeout = setTimeout(() => {
            if (!this.game.inQueue) {
                return;
            }
            this.game.changeMapVote(this.mapVote, newMapVote);
            this.mapVote = newMapVote;
        }, this.botTimeToChangeVote());
    }

    botTimeToChangeVote() {
        return Math.random()*5*1000+1 // 1-6 seconds (1000 because in ms)
    }
}
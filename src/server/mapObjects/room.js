let util = require('../lib/util');
var qtUtil = require('../lib/quadTreeUtil');

exports.Room = class Room {

    /**
     * Requires id, height, width, numFood, playZone
     * optional winnerRoom, teleportPortals, enemySetups
     */
    constructor(params) {
        let mustHaveArgs = ["id", "height", "width", "numFood", "playZone", "foodSetups", "number"];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        let optionalArgsDefaults = {
            winnerRoom: false,
            teleportPortals: [],
            enemySetups: [],
        };
        util.assignCouldHaveArgs(this, optionalArgsDefaults, params);

        this.quadTree = null;
        this.users = [];
        this.foods = [];
        this.enemies = [];
    }

    moveEnemies() {
        for (let enemy of this.enemies) {
            enemy.move(this);
        }
    }

    checkCollisions(rooms) {
        let quadTree = this.quadTree;
        for (let player of this.users) {
            let qtPlayer = qtUtil.realObjToQuadTreeObj(player);
            let result = quadTree.get(qtPlayer);
            for (let i = 0; i < result.length; i++) {
                let potColl = result[i];
                let obj = potColl.obj; // potential collisions

                if (obj.shape === "circle" && util.getDistance(obj, player) < 0) {
                    if (obj.type === 'food') {
                        let food = obj;
                        player.eatFood(this, food);
                    }
                    else if (obj.type === 'portal') {
                        let portal = obj;
                        portal.playerUsePortal(player, rooms);
                    }
                    else if (obj.type === 'enemy') {
                        player.feint();
                        break;
                    }
                    else if (obj.type === 'player' && obj.id !== player.id) {
                        let otherPlayer = obj;
                        if (otherPlayer.state === 'dead' && player.team === otherPlayer.team) {
                            otherPlayer.state = 'alive';
                        }
                    }
                }
                // need to write a doesCollideRectangle method for this if have rectangles that don't touch top/bottom of game
                else if (obj.shape === "rectangle") {
                    if (obj.type === "portal") {
                        let portal = obj;
                        portal.playerUsePortal(player, rooms);
                    }
                }
            }
        }
    }

    tick(rooms) {
        this.moveEnemies();
        this.checkCollisions(rooms);
    }
}
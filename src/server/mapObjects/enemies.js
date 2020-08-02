'use strict'

let util = require('../lib/util');
let qtUtil = require('../lib/quadTreeUtil');
let config = require("../../../config.json");

/**
 * Requires radius, initialSpeed, roomId, rooms in params 
 * Could have x and y, direction, hue, saturation, lightness, borderColour in params
 */
exports.StandardEnemy = class StandardEnemy {
    constructor(params) {
        if (!('room' in params))
            throw "room not in params"

        this.type = "enemy";

        let mustHaveArgs = ["id", "radius", "maxSpeed", "x", "y", "direction"];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        this.speed = this.maxSpeed;

        let defaultCouldHaveArgs = {
            hue: 0,
            saturation: 100,
            lightness: 45,
            borderColour: config.defaultBorderColour,
            shape: "circle",
        };

        util.assignCouldHaveArgs(this, defaultCouldHaveArgs, params);
    }

    getRadius() { util.validateVal(this.radius); return this.radius; }
    getX() { util.validateVal(this.x); return this.x; }
    getY() { util.validateVal(this.y); return this.y; }
    getDirection() { util.validateVal(this.direction); return this.direction; }
    getType() { util.validateVal(this.type); return this.type; }
    getSpeed() { util.validateVal(this.speed); return this.speed; }

    move(room) {
        let clonedThis = util.shallowClone(this);
        let direction = this.getDirection();
        let radDirection = util.degToRad(direction);
        let deltaY = this.speed * Math.sin(radDirection);
        let deltaX = this.speed * Math.cos(radDirection);

        let x = this.x+deltaX;
        let y = this.y+deltaY;

        let newMoveInfo = bounceIfNeeded(x, y, direction, this, room);
        this.direction = newMoveInfo.direction;
        this.x = newMoveInfo.x;
        this.y = newMoveInfo.y;

        qtUtil.updateQuadTree(room, clonedThis, this);
    }
}

function bounceIfNeeded(x, y, direction, obj, room) {
    let radius = obj.getRadius();
    if (x > room.playZone.x+room.playZone.width-radius) {
        x = room.playZone.x+room.playZone.width-radius;
        direction = 180-direction;;
    }
    if (y > room.playZone.y+room.playZone.height-radius) {
        y = room.playZone.y+room.playZone.height-radius;
        direction = -direction;
    }
    if (x < room.playZone.x+radius) {
        x = room.playZone.x+radius;
        direction = 180-direction;
    }
    if (y < room.playZone.y+radius) {
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
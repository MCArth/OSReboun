'use strict'

let config = require("../../../config.json");
let util = require('../lib/util');

/**
 * Requires x, y, roomFrom, roomTo, toX, toY in params
 * Could have hue, saturation, lightness, borderColour
 */
exports.Portal = class {
    constructor(params) {
        this.type = "portal";

        let mustHaveArgs = ["roomFrom", "roomTo"];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        let defaultOptargs = {
            x: null,
            y: null,
            toX: null,
            toY: null,
            radius: config.portalRadius,
            hue: config.portalColour,
            saturation: 100,
            lightness: 45,
            borderColour: config.defaultBorderColour,
            portalType: "circle",
            width: null,
            shape: "circle",
            text: "",
        };
        util.assignCouldHaveArgs(this, defaultOptargs, params);
    }

    // getRadius() { util.validateVal(this.radius); this.radius; }
    // getX() { util.validateVal(this.x); return this.x; }
    // getY() { util.validateVal(this.y); return this.y; }
    // getType() { util.validateVal(this.type); return this.type; }
    // getRoomFrom() { util.validateVal(this.roomFrom); return this.roomFrom; }
    // getRoomTo() { util.validateVal(this.roomTo); return this.roomTo; }
    // getToX() { util.validateVal(this.toX); return this.toX; }
    // getToY() { util.validateVal(this.toY); return this.toY; }

    playerUsePortal(player, rooms) {
        if (this.portalType === 'circle') {
            player.moveRooms(rooms[this.roomFrom], rooms[this.roomTo], this.toX, this.toY);
        }
        else if (this.portalType === "roomStart") {
            player.moveRooms(rooms[this.roomFrom], rooms[this.roomTo], rooms[this.roomTo].width-150, this.getYinBound(player, rooms[this.roomTo]));
        }
        else if (this.portalType === "roomEnd") {
            player.moveRooms(rooms[this.roomFrom], rooms[this.roomTo], 150, this.getYinBound(player, rooms[this.roomTo]));
        }
    }

    getYinBound(player, room) {
        return Math.min(player.y, room.height-player.radius/2)
    }
}
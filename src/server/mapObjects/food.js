var config = require('../../../config.json');
var util = require('../lib/util');
var qtUtil = require('../lib/quadTreeUtil');

exports.Food = class Food {
    /**
     * 
     * @param {Objecff} params
     *      Must have room, id (idx in list).
     *      Could have x, y, radius, hue, saturation, lightness, borderColour
     */
    constructor(params) {
        this.type = "food";

        let mustHaveArgs = ["id", "positions"];
        util.assignMustHaveArgs(this, mustHaveArgs, params);

        let optionalCouldHaveArgs = {
            radius: config.foodRadius,
            hue: util.randDegree(),
            saturation: 100,
            lightness: 45,
            borderColour: config.defaultBorderColour,
            shape: "circle",
        };
        util.assignCouldHaveArgs(this, optionalCouldHaveArgs, params);

        this.x = this.positions[0].x;
        this.y = this.positions[0].y;
        this.currPosPointer = 0;
    }

    beEaten(room) {
        qtUtil.removeFromQuadTree(room, this);
        if (this.positions.length > 1) {
            // Food type is cycle
            this.nextPosition(room);
        }
        else {
            // Food only has 1 position so is food type timed
            this.x = undefined; this.y = undefined;
            // Will wait 2 seconds before respawning (in the same spot)
            setTimeout(() => this.nextPosition(room), 2000);
        }
    }

    nextPosition(room) {
        if (++this.currPosPointer >= this.positions.length) {
            this.currPosPointer = 0;
        }
        let newPos = this.positions[this.currPosPointer];
        this.x = newPos.x;
        this.y = newPos.y;
        qtUtil.putInQuadTree(room, this);
        this.setNewRandomColour();
    }

    setNewRandomColour() {
        this.hue = util.randDegree();
    }
}
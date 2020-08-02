'use strict';

var cfg = require('../../../config.json');

function realObjToQuadTreeObj(obj) {
    return {
        x: obj.x-obj.radius,
        y: obj.y-obj.radius,
        w: obj.radius*2,
        h: obj.radius*2,
        obj: obj
    };
}
exports.realObjToQuadTreeObj = realObjToQuadTreeObj;

exports.putInQuadTree = function(room, obj) {
    room.quadTree.put(realObjToQuadTreeObj(obj));
}

exports.updateQuadTree = function(room, oldObj, newObj) {
    exports.removeFromQuadTree(room, oldObj);
    exports.putInQuadTree(room, newObj);
}

exports.removeFromQuadTree = function(room, obj) {
    room.quadTree.remove(realObjToQuadTreeObj(obj));
}
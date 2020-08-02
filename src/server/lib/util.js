/* jslint node: true */

'use strict';

var cfg = require('../../../config.json');

exports.validNick = function(nickname) {
    var regex = /^\w*$/;
    return regex.exec(nickname) !== null;
};

// determine mass from radius of circle
exports.massToRadius = function (mass) {
    return 4 + Math.sqrt(mass) * 6;
};

// overwrite Math.log function
exports.log = (function () {
    var log = Math.log;
    return function (n, base) {
        return log(n) / (base ? log(base) : 1);
    };
})();

// get the Euclidean distance between the edges of two shapes
exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = function (from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
};

// generate a random position within the field of play
exports.randomPositionInPlayZone = function (radius, room) {
    return {
        x: exports.randomInRange(room.playZone.x+radius, room.playZone.width+room.playZone.x-radius),
        y: exports.randomInRange(room.playZone.y+radius, room.playZone.height+room.playZone.y-radius)
    };
};

exports.timeToSeconds = function(time) {
    return time*10e-4;
}

exports.differenceInSeconds = function(time1, time2) {
    return Math.abs(exports.timeToSeconds(time2)-exports.timeToSeconds(time1));
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

exports.findIndex = findIndex;

exports.eleIn = (array, ele) => {
    for (let i = 0; i < array.length; i++) {
        if (array[i] === ele) {
            return true;
        }
    }
    return false;
}

exports.randomColor = function() {
    var color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
    var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    var r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
    var g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
    var b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

    return {
        fill: color,
        border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    };
};

exports.degToRad = function(deg) {
    return Math.PI*deg/180;
}

exports.shallowClone = function(obj) {
    return {...obj};
}

exports.randDegree = function() {
    return Math.round(Math.random() * 360);
}

/**
 * Throws an error if val is undefined or NaN
 */
exports.validateVal = function(val) {
    if (val === undefined) 
        throw "value from getter is undefined"
    if (Number.isNaN(val))
        throw "value from getter is NaN"
}

exports.assignMustHaveArgs = function(mapObject, listOfArgs, argumentObject) {
    for (let arg of listOfArgs) {
        if (!(arg in argumentObject)) {
            throw `${arg} not in ${mapObject.constructor.name} arguments`
        }
        mapObject[arg] = argumentObject[arg];
    }
}

exports.assignCouldHaveArgs = function(mapObject, defaultArgumentObject, argumentObject) {
    for (let arg in defaultArgumentObject) {
        if (arg in argumentObject) {
            mapObject[arg] = argumentObject[arg];
        }
        else {
            mapObject[arg] = defaultArgumentObject[arg];
        }
    }
}

let subscribers = {};

exports.pubSub = {
    publish(event, ...data) {
        if (!subscribers[event]) return;
        
        subscribers[event].forEach(subscriberCallback => subscriberCallback(...data));
      },
      subscribe(event, callback) {
        let index;
    
        if (!subscribers[event]) {
            subscribers[event] = [];
        }
    
        index = subscribers[event].push(callback) - 1;
    
        return {
            unsubscribe() {
            subscribers[event].splice(index, 1);
          }
        };
    }
};

exports.removeIdFromList = function(id, list) {
    let player_index = findIndex(list, id);
    if (player_index >= 0) list.splice(player_index, 1);
}

exports.log = function(...message) {
    let t = new Date();
    let secs = t.getUTCSeconds().toString();
    if (secs.length === 1) {
        secs = '0' + secs;
    }
    process.stdout.write('[' + t.getUTCFullYear() + '-' + t.getUTCMonth() + '-' + t.getUTCDate() 
        + ' ' +
        t.getUTCHours() + ':' + t.getUTCMinutes() + ':' + t.getUTCSeconds() + "] ");
    console.log(...message);
}

exports.error = function(...message) {
    let t = new Date();
    let secs = t.getUTCSeconds().toString();
    if (secs.length === 1) {
        secs = '0' + secs;
    }
    process.stderr.write('[' + t.getUTCFullYear() + '-' + t.getUTCMonth() + '-' + t.getUTCDate() 
        + ' ' +
        t.getUTCHours() + ':' + t.getUTCMinutes() + ':' + t.getUTCSeconds() + "] ");
    console.error(...message);
}
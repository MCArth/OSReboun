var util = require('./lib/util');
var level = require('level');

var analDB = level('data/analyticsData');
var encOptions = {valueEncoding: "json"};

let uniquePlayers = 0;
let visitCount = 0;
let playCount = 0;

analDB.get('uniquePlayers', encOptions, function (err, value) {
    if (err) {
        if (err.notFound) {
            return util.log("uniquePlayers not found")
        }
        return util.error(err);
    }
    uniquePlayers = value;
});
analDB.get('visitCount', encOptions, function (err, value) {
    if (err) {
        if (err.notFound) {
            return util.log("visitCount not found")
        }
        return util.error(err);
    }
    visitCount = value;
});
analDB.get('playCount', encOptions, function (err, value) {
    if (err) {
        if (err.notFound) {
            return util.log("playCount not found")
        }
        return util.error(err);
    }
    playCount = value;
});


exports.newUniquePlayer = () => {
    uniquePlayers++;
    putInDB('uniquePlayers', uniquePlayers);
}
exports.getUniquePlayerCount = () => {
    return uniquePlayers;
}

exports.newVisit = () => {
    visitCount++;
    putInDB('visitCount', visitCount);
}
exports.getVisitCount = () => {
    return visitCount;
}

exports.newPlay = () => {
    playCount++;
    putInDB('playCount', playCount);
}
exports.getPlayCount = () => {
    return playCount;
}


exports.shutdown = () => {
    return analDB.close();
}


function putInDB(key, value) {
    analDB.put(key, value, encOptions);
}
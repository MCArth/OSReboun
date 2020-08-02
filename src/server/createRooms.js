const fs = require('fs');
const util = require('./lib/util');
const config = require('../../config.json');

var portal = require('./mapObjects/portal');
var room = require('./mapObjects/room');

var spawnInfo = require('./rooms/spawn.json');
var hardMapInfo = require('./rooms/hardMap.json');
var firstMapInfo = require('./rooms/initial 1.json');
var winnersRoomInfo = require('./rooms/winnersRoom.json');

var originalRemastered = require('./rooms/Original Remastered.json');
var originalButLong = require('./rooms/Original but Long.json');


const roomStartWidth = 350;
const portalWidth = 100;


//const infos = [firstMapInfo, winnersRoomInfo];
const infos = [firstMapInfo, winnersRoomInfo, originalRemastered, originalButLong];

const foodPositionCountForCycle = 3;

for (let i = 0; i < infos.length; i++) {
    let newInfo;
    let localFilePath = './rooms/generatedRooms/' + infos[i].name + 'generated.json'; // used for require
    let projectPath = './src/server/' + localFilePath; // used for fs operations
    if (fs.existsSync(projectPath)) {
        newInfo = require(localFilePath);
    }
    else {
        let mapInfo = infos[i];
        let roomsInfo = mapInfo["rooms"];
        for (let i = 0; i < roomsInfo.length; i++) {
            let room = roomsInfo[i];
            let enemySetups = room.enemySetups;
            let newEnemySetups = [];
            let realRoomSetup = {playZone: {...room.playZone, x: roomStartWidth, y: 0}};
            enemySetups.forEach((setupAndNum) => {
                for (let i = 0; i < setupAndNum.count; i++) {
                    let setup = {...setupAndNum.config};
                    let randPos = util.randomPositionInPlayZone(setup.radius, realRoomSetup);
                    setup.x = randPos.x;
                    setup.y = randPos.y;
                    setup.direction = util.randDegree();
                    newEnemySetups.push(setup);
                }
            });
            room.enemySetups = newEnemySetups;
            let foodSetups = [];
            if (!(room.numFood)) {
                room.numFood = 0;
            }
            let numPositionsToChoose;
            if (mapInfo.foodRespawnType === "cycle") {
                numPositionsToChoose = foodPositionCountForCycle;
            }
            else if (mapInfo.foodRespawnType === "timed") {
                numPositionsToChoose = 1;
            }
            for (let foodId = 0; foodId < room.numFood; foodId++) {
                let positions = [];
                for (let foodPosIdx = 0; foodPosIdx < numPositionsToChoose; foodPosIdx++) {
                    let randPos = util.randomPositionInPlayZone(config.foodRadius, realRoomSetup);
                    positions.push(randPos);
                }
                foodSetups.push({id: foodId, positions: positions});
            }
            room.foodSetups = foodSetups;
        }
        newInfo = mapInfo;
        fs.writeFile(projectPath, JSON.stringify(newInfo, null, 4), (err) => {
            if (err) {
                util.error("error here" + err);
            }
        });
    }
    infos[i] = newInfo;
}

exports.getMapNames = function getMapNames() {
    let mapNames = [];
    infos.forEach( (mapInfo) => {
        if (mapInfo.name === "win") {
            return;
        }
        mapInfo = {...mapInfo};
        mapNames.push(
            {
                internalName: mapInfo.name,
                officialName: mapInfo.officialName,
            }
        );
    });
    return mapNames;
}

exports.getRooms = function getRooms() {
    // todo: return only a given set map for arena matches
    let rooms = {}; 
    infos.forEach( (mapInfo) => {
        mapInfo = {...mapInfo};
        let roomsInfo = mapInfo["rooms"];
        for (let i = 0; i < roomsInfo.length; i++) {
            let roomInfo = {...roomsInfo[i]};
            roomInfo.id = mapInfo["name"] + (i+1);
            let portalObjs = [];
            roomInfo.teleportPortals.forEach( (tpSetup) => {
                tpSetup = {...tpSetup};
                tpSetup.roomFrom = roomInfo.id;
                if (tpSetup.roomTo == 'next room') {
                    tpSetup.roomTo = mapInfo["name"] + (i+2);
                    tpSetup.text = i+2;
                    tpSetup.portalType = "roomEnd";
                    tpSetup.width = portalWidth;
                    tpSetup.shape = "rectangle";
                }
                else if (tpSetup.roomTo == 'previous room') {
                    tpSetup.roomTo = mapInfo["name"] + i;
                    tpSetup.text = i;
                    tpSetup.portalType = "roomStart";
                    tpSetup.width = portalWidth;
                    tpSetup.shape = "rectangle";
                }
                else {
                    tpSetup.portalType = "circle";
                }
                portalObjs.push(new portal.Portal(tpSetup));
            });
            roomInfo.teleportPortals = portalObjs;
            if (!('playZone' in roomInfo)) {
                roomInfo.playZone = {
                    "x": 0,
                    "y": 0,
                    "width": 0,
                    "height": 0
                };
                roomInfo.numFood = 0;
            }
            else {
                roomInfo.playZone = {...roomInfo.playZone};
            }
            if (!('height' in roomInfo)) { // only playzone is defined, and playZone only defined with a width and height
                roomInfo.width = roomInfo.playZone.width+roomStartWidth*2;
                roomInfo.height = roomInfo.playZone.height;
                roomInfo.playZone.x = roomStartWidth;
                roomInfo.playZone.y = 0;
            }
            if (!('winnerRoom' in roomInfo)) {
                roomInfo.winnerRoom = false;
            }
            roomInfo.number = i+1;
            rooms[roomInfo.id] =  new room.Room(roomInfo);
        }
    });
    return rooms;
}
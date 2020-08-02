let adminPassword = require("../../config.json").adminPassword;
exports.setupAdminPlayer = (player) => {
    let socket = player.socket;
    socket.on('login', (password) => { 
        if (password === adminPassword) {
            player.admin = true;
            setupAdminSocket(player);
        }
    });
}

function setupAdminSocket(player) {
    const socket = player.socket;
    const rooms = player.game.rooms;
    socket.on('goToRoomStart', (roomId) => {
        if (!(roomId in rooms)) {
            return;
        }
        player.moveRooms(rooms[player.roomId], rooms[roomId], 250, 250);
    });

    socket.on('goToRoomEnd', (roomId) => {
        if (!(roomId in rooms)) {
            return;
        }
        player.moveRooms(rooms[player.roomId], rooms[roomId], rooms[roomId].width-250, 250);
    });
}
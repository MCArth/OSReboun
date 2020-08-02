let analyticsDBHandler = require('./analyticsDBHandler');
let adminPassword = require("../../config.json").adminPassword;

exports.setupAdminSocket = (socket) => {
    socket.on('analyticsLogin', (password) => { 
        if (password === adminPassword) {
            setupAdminSocket(socket);
        }
    });
}

function setupAdminSocket(socket) {
    socket.on('getUniquePlayers', (callback) => {
        // socket.emit('uniquePlayerCount', analyticsDBHandler.getUniquePlayerCount());
        callback(analyticsDBHandler.getUniquePlayerCount());
    });

    socket.on('getVisitCount', (callback) => {
        // socket.emit('visitCount', analyticsDBHandler.getVisitCount());
        callback(analyticsDBHandler.getVisitCount());
    });

    socket.on('getPlayCount', (callback) => {
        // socket.emit('visitCount', analyticsDBHandler.getPlayCount());
        callback(analyticsDBHandler.getPlayCount());
    });
}
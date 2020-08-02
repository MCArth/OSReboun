let analSocket;
window.analyticsLogin = function analyticsLogin(pw) {
    analSocket = io(window.DBServer);
    analSocket.emit('analyticsLogin', pw);
}
window.getUniquePlayers = function getUniquePlayers() {
    analSocket.emit('getUniquePlayers', (count) => {
        console.log(count);
    });
}
window.getVisitCount = function getVisitCount() {
    analSocket.emit('getVisitCount', (count) => {
        console.log(count);
    });
}
window.getPlayCount = function getPlayCount() {
    analSocket.emit('getPlayCount', (count) => {
        console.log(count);
    });
}

window.login = function login(pw) {
    window.socket.emit('login', pw);
}

window.toRoomStart = function toRoomStart(roomId) {
    window.socket.emit('goToRoomStart', roomId);
}

window.toRoomEnd = function toRoomEnd(roomId) {
    window.socket.emit('goToRoomEnd', roomId);
}
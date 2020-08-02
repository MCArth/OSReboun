const fs = require('fs');
const util = require('./lib/util');

let names = ["okgogo"]
fs.readFile('./names.txt', 'utf8', (err, data) => {
    if (err) {
        util.error(err);
        return;
    }
    names = data.split('\n');
});

let stack = [];
exports.getNextName = () => {
    if (stack.length > 0) {
        let botPlayAgain = Math.random();
        if (botPlayAgain > 0.3) {
            return stack.pop();
        }
        else if (botPlayAgain > 0.1) {
            stack.pop();
            return getRandomName();
        }
        else {
            return getRandomName();
        }
    }
    return getRandomName();
}

exports.nameFinished = (name) => {
    stack.push(name);
}

function getRandomName() {
    let i = Math.floor(Math.random()*names.length);
    return names[i];
}


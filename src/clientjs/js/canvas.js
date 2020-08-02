let myGlobal;
module.exports = exports = class {
    constructor(globalObj) {
		myGlobal = globalObj;
        this.directionLock = false;
        this.reenviar = true;
        this.socket = myGlobal.socket;
        this.directions = [];
        var self = this;

        this.cv = document.getElementById('cvs');
        this.cv.width = myGlobal.screenWidth;
        this.cv.height = myGlobal.screenHeight;
        this.cv.addEventListener('mousemove', this.gameInput, false);
        this.cv.addEventListener('mouseout', this.outOfBounds, false);
        this.cv.addEventListener('keypress', this.keyInput, false);
        this.cv.addEventListener('keyup', function(event) {
            self.reenviar = true;
            self.directionUp(event);
        }, false);
        this.cv.addEventListener('keydown', this.directionDown, false);
        this.cv.addEventListener('touchstart', this.touchInput, false);
        this.cv.addEventListener('touchmove', this.touchInput, false);
        this.cv.parent = self;
        myGlobal.canvas = this;
        this.target = {x: 0, y: 0};
    }

    // Function called when a key is pressed, will change direction if arrow key.
    directionDown(event) {
		var key = event.which || event.keyCode;

		// have to do this so we are not using the cv object
		//The addEventListener which calls this function reassigns this to the canvas itself not this class
		// which is why we have 'this.cv.parent = self' in the constructor
		var self = this.parent; 

    	if (self.directional(key)) {
    		self.directionLock = true;
    		if (self.newDirection(key, self.directions, true)) {
    			self.updateTargetUsingKeys(self.directions);
    			self.socket.emit('0', self.target);
    		}
    	}
    }

    // Function called when a key is lifted, will change direction if arrow key.
    directionUp(event) {
    	var key = event.which || event.keyCode;
		if (this.directional(key)) { // this == the actual class, unsure why it's different from directionDown tho
    		if (this.newDirection(key, this.directions, false)) {
    			this.updateTargetUsingKeys(this.directions);
    			if (this.directions.length === 0) this.directionLock = false;
    			this.socket.emit('0', this.target);
    		}
    	}
    }

    // Updates the direction array including information about the new direction.
    newDirection(direction, list, isAddition) {
    	var result = false;
    	var found = false;
    	for (var i = 0, len = list.length; i < len; i++) {
    		if (list[i] == direction) {
    			found = true;
    			if (!isAddition) {
    				result = true;
    				// Removes the direction.
    				list.splice(i, 1);
    			}
    			break;
    		}
    	}
    	// Adds the direction.
    	if (isAddition && found === false) {
    		result = true;
    		list.push(direction);
    	}

    	return result;
    }

    // Updates the target according to the directions in the directions array.
    updateTargetUsingKeys(list) {
    	this.target = { x : 0, y: 0 };
    	var directionHorizontal = 0;
    	var directionVertical = 0;
    	for (var i = 0, len = list.length; i < len; i++) {
    		if (directionHorizontal === 0) {
    			if (list[i] == myGlobal.KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
    			else if (list[i] == myGlobal.KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
    		}
    		if (directionVertical === 0) {
    			if (list[i] == myGlobal.KEY_UP) directionVertical -= Number.MAX_VALUE;
    			else if (list[i] == myGlobal.KEY_DOWN) directionVertical += Number.MAX_VALUE;
    		}
		}
    	this.target.x += directionHorizontal;
    	this.target.y += directionVertical;
        myGlobal.target = this.target;
    }

    directional(key) {
    	return this.horizontal(key) || this.vertical(key);
    }

    horizontal(key) {
    	return key == myGlobal.KEY_LEFT || key == myGlobal.KEY_RIGHT;
    }

    vertical(key) {
    	return key == myGlobal.KEY_DOWN || key == myGlobal.KEY_UP;
    }

    // Register when the mouse goes off the canvas.
    outOfBounds() {
        this.parent.target = { x : 0, y: 0 };
        myGlobal.target = this.parent.target;
    }

    gameInput(mouse) {
    	if (!this.directionLock) {
			this.parent.target = {x: mouse.clientX - this.width / 2, y: mouse.clientY - this.height / 2};
            myGlobal.target = this.parent.target;
    	}
    }

    touchInput(touch) {
        touch.preventDefault();
		touch.stopPropagation();
    	if (!this.directionLock) {
			this.parent.target = {
				x: touch.touches[0].clientX - this.width / 2,
				y: touch.touches[0].clientY - this.height / 2,
			};
            myGlobal.target = this.parent.target;
    	}
    }

    // Chat command callback functions.
    keyInput(event) {
    	var key = event.which || event.keyCode;
        if (key === myGlobal.KEY_CHAT) {
            document.getElementById('chatInput').focus();
        }
    }
}
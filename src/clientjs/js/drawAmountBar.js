module.exports = exports = (width, height, context, x=undefined, y=undefined, midX=undefined, midY=undefined, percentFull=0, backgroundColour="grey", foregroundColour="yellow", alpha=0.7, text="", drawSettings) => {
    if ((x===undefined || y===undefined) && (midX===undefined || midY===undefined)) {
        throw "Must pass one pair of x, y/midX, midY when constructing AmountBar"
    }
    else if ((x!==undefined || y!==undefined) && (midX!==undefined || midY!==undefined)) {
        throw "Must pass either x and y OR midX and midY. Cannot pass both."
    }
    if (height===undefined || width===undefined) {
        throw "height and width must be passed as the first two arguments to AmountBar"
    }
    if (x !== undefined && y !== undefined) {
        midX = x+width/2;
        midY = y+height/2;
    }
    else if (midX !== undefined && midY !== undefined) {
        x = midX-width/2;
        y = midY-height/2;
    }

    let radius = height/2;

    context.globalAlpha = alpha;
    context.beginPath();

    // Clockwise outer round

    // Left semi-circle
    context.arc(x+radius, y+radius, radius, Math.PI/2, 3*Math.PI/2);
    // Top line
    context.lineTo(x+width-radius, y);
    // Right semi-circle
    context.arc(x+width-radius, y+radius, radius, 3*Math.PI/2, Math.PI/2);
    // Bottom line
    context.lineTo(x+radius, y+height);

    // Anti-Clockwise inner round to make hole
    let xFactor = 0.13;
    let yFactor = 0.13;
    x = x+height*xFactor;
    y = y+height*yFactor;
    width = height*(1-2*xFactor)+(width-height)*percentFull;
    height = height*(1-2*yFactor);
    radius = height/2;

    // Left semi-circle
    context.arc(x+radius, y+radius, radius, 3*Math.PI/2, Math.PI/2, true);
    // Bottom line
    context.lineTo(x+width-radius, y+height);
    // Right semi-circle
    context.arc(x+width-radius, y+radius, radius, Math.PI/2, 3*Math.PI/2, true);
    // Top line
    context.lineTo(x+radius, y);

    context.fillStyle = backgroundColour;
    context.fill();

    // Coloured inner hole

    context.beginPath();

    // Left semi-circle
    context.arc(x+radius, y+radius, radius, Math.PI/2, 3*Math.PI/2);
    // Right semi-circle
    context.arc(x+width-radius, y+radius, radius, 3*Math.PI/2, Math.PI/2);
    // Top line
    context.moveTo(x+radius, y);
    context.lineTo(x+width-radius, y);
    // Bottom line
    context.moveTo(x+radius, y+height);
    context.lineTo(x+width-radius, y+height);
    
    context.fillStyle = foregroundColour;
    context.fill();

    context.globalAlpha = 1;
    // Drawing font

    let fontSize = radius*2;
    context.lineWidth = drawSettings.textBorderSize;
    context.fillStyle = drawSettings.textColor;
    context.strokeStyle = backgroundColour;
    context.lineJoin = 'round';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = fontSize + 'px Ubuntu';

    context.strokeText(text, midX, midY+radius/8);
    context.fillText(text, midX, midY+radius/8); 
}
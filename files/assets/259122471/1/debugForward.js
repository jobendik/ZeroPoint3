var DebugForward = pc.createScript('debugForward');

// initialize code called once per entity
DebugForward.prototype.initialize = function() {
    // We will draw a 3-meter long white line
    this.forwardVec = new pc.Vec3();
    this.lineColor = new pc.Color(1, 1, 1, 1); // White
};

// update code called every frame
DebugForward.prototype.update = function(dt) {
    var start = this.entity.getPosition();

    // Get the entity's forward vector (its -Z axis) and make it 3 meters long
    this.forwardVec.copy(this.entity.forward).scale(3).add(start);

    // Draw the line from the entity's center out to the forward point
    // ✅ CORRECTED: Use this.app.drawLine()
    this.app.drawLine(start, this.forwardVec, this.lineColor, {
        depthTest: false // Draw on top of everything so it's visible
    });
};
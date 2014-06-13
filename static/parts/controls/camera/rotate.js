var inputMultiplier = 2;

var left = -1;
var right = 1;

var isRotatingLeft = false;
var isRotatingRight = false;

function buildActions(camera) {
    return {
        rotateLeft: function(){ isRotatingLeft = true },
        rotateRight: function(){ isRotatingRight = true },
        stopRotateRight: function(){ isRotatingRight = false },
        stopRotateLeft: function(){ isRotatingLeft = false }
    }
}

function stopRotateAction(dir, camera) {
    if ( camera.rotationValue != undefined &&
        ((dir > 0 && camera.rotationValue > 0) ||
         (dir < 0 && camera.rotationValue < 0 ))) {

        camera.rotationValue *= .35;

    }
}

function rotateAction(dir, camera) {
    if ( camera.rotationValue == undefined ) {
        camera.rotationValue = new THREE.Vector3();
    }
    camera.rotationValue += dir * inputMultiplier;
}

function updateRotation(cam) {
    if ( isRotatingLeft ) {
        rotateAction(left, cam);
    } else {
        stopRotateAction(left, cam);
    }
    if ( isRotatingRight ) {
        rotateAction(right, cam);
    } else {
        stopRotateAction(right, cam);
    }

    var v3 = THREE.Vector3;
    var up = new v3(0,1,0);
    if ( cam.rotationValue != undefined && Math.abs(cam.rotationValue) > .5 ) {
        var cp = new v3().copy(cam.position);
        var center = new v3().copy(cam.target);
        center.y = cp.y;
        var distance = new v3().subVectors(cp, center);
        var len = distance.length();
        var directionFromCenter = distance.normalize();
        var dirXZ = directionFromCenter.cross(up);
        var displacement = dirXZ.multiplyScalar(cam.rotationValue);
        var newPos = new v3().addVectors(cp, displacement);
        var adjustedPos = new v3().subVectors(newPos, center).setLength(len);
        cam.position = new v3().addVectors(center, adjustedPos);

        cam.rotationValue *= .98;
    }
    else {
        cam.rotationValue = 0;
    }
}

module.exports = {
    buildActions: buildActions,
    updateRotation: updateRotation
};


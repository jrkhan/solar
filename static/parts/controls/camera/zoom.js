Solar.Controls.Camera.Zoom = (function(){

    var isZoomingIn = false,
        isZoomingOut = false;

    var inputMultiplier = 1.5;

    function buildActions(camera) {
        return {
            zoomIn: function(){ isZoomingIn = true },
            zoomOut: function(){ isZoomingOut = true },
            stopZoomIn: function(){ isZoomingIn = false },
            stopZoomOut: function(){ isZoomingOut = false }
        }
    }

    function stopZoom(camera) {
        if ( camera.zoomValue != undefined ) {
            camera.zoomValue *= .35;
        }
    }

    function zoomAction(dir, camera) {
        if ( camera.zoomValue == undefined ) {
            camera.zoomValue = 0;
        }
        camera.zoomValue += dir * inputMultiplier;
    }


    function updateZoomValue(cam) {
        if ( isZoomingIn && !isZoomingOut ) {
            zoomAction(1, cam);
        } else if ( isZoomingOut && !isZoomingIn ) {
            zoomAction(-1, cam);
        } else {
            stopZoom(cam);
        }
    }

    function changeCamPosition(cam) {
        var v3 = THREE.Vector3;
        var up = new v3(0,1,0);
        if ( cam.zoomValue != undefined && Math.abs(cam.zoomValue) > .5 ) {
            var cp = new v3().copy(cam.position);
            var offset = new v3().copy(cam.target).sub(cp).normalize().multiplyScalar(cam.zoomValue);
            var adjustedPos = new v3().addVectors(offset, cam.position);
            cam.position = adjustedPos;
            cam.zoomValue *= .98;
        }
        else {
            cam.zoomValue = 0;
        }
    }

    function updateZoom(cam) {
        updateZoomValue(cam);
        changeCamPosition(cam);
    }

    return {
        buildActions: buildActions,
        updateZoom: updateZoom
    }

})();

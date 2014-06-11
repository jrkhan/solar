Solar.MoveCamera = (function(){

    var numFrames = 20;

    function cameraMovementAction(camera){
        var handler = function(intersection){
            var target = new THREE.Vector3(intersection.x, camera.position.y, intersection.z);
            camera.transition = {
                original: camera.position,
                target: target,
                duration: numFrames,
                elapsed: 0
            }
        }
        return handler;
    }

    return {
        cameraMovementAction: cameraMovementAction
    }
})();
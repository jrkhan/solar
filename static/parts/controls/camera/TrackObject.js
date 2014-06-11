Solar.Controls.Camera.TrackObject = (function(){

    function setTarget(camera, target) {
        camera.trackedObject = target;
    }

    function buildActions(camera, orbitList) {
        return {
            trackNext: function() {
                setTarget(camera, orbitList.nextItem());
            },
            trackPrevious: function() {
                setTarget(camera, orbitList.previousItem());
            }
        }
    }

    function update(cam) {
        if ( cam.trackedObject != undefined ) {
            cam.target = cam.trackedObject.position;
        }
    }

    return {
        buildActions: buildActions,
        update: update
    };
})();
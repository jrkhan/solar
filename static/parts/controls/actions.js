Solar.Controls.Actions = (function(){

    var cameraAction;
    var satelliteAction;
    var rotationActions, zoomActions;
    var trackObjectActions;
    var onReadyCallbacks = [];
    var isReady = false;

    function getCameraAction() {
        return cameraAction;
    }

    function getSatelliteAction() {
        return satelliteAction;
    }

    function buildActions(camera, star, addMoon, clickHandler) {
        //add controls

        satelliteAction = Solar.AddSatellite.configSatellite(star, addMoon);
        cameraAction = Solar.MoveCamera.cameraMovementAction(camera);
        rotationActions = Solar.Controls.Camera.Rotate.buildActions(camera);
        trackObjectActions = Solar.Controls.Camera.TrackObject.buildActions(camera, star.orbitList);
        zoomActions = Solar.Controls.Camera.Zoom.buildActions(camera);

        var actions = [
            {
                id: 'action-placeSatellite',
                handler: function(){clickHandler.setAction(satelliteAction)},
                color: 'rgba(255, 0, 0, 0.5)',
                name: 'Place Satellite'
            },
            {
                id: 'action-moveCamera',
                handler: function(){clickHandler.setAction(cameraAction)},
                color: 'rgba(0, 255, 0, 0.5)',
                name: 'Reposition Camera'
            }
        ];

        isReady = true;
        for ( var i = 0; i < onReadyCallbacks.length; i++) {
            onReadyCallbacks[i]();
        }

        return actions;
    }

    return {
        init: buildActions,
        getCameraAction: getCameraAction,
        getSatelliteAction: getSatelliteAction,
        trackObjectActions: function() { return trackObjectActions },
        rotationActions: function(){ return rotationActions },
        zoomActions: function(){ return zoomActions },
        onReady: function(callback){
            if ( isReady ) {
                callback();
            } else {
                onReadyCallbacks.push(callback);
            }
        }
    }
})();
var addSatellite    = require('./AddSatellite'),
    moveCamera      = require('./MoveCamera'),
    rotate          = require('./camera/rotate'),
    zoom            = require('./camera/zoom'),
    track           = require('./camera/TrackObject');

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

    satelliteAction     = addSatellite.configSatellite(star, addMoon);
    cameraAction        = moveCamera.cameraMovementAction(camera);
    rotationActions     = rotate.buildActions(camera);
    trackObjectActions  = track.buildActions(camera, star.orbitList);
    zoomActions         = zoom.buildActions(camera);

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

module.exports = {
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
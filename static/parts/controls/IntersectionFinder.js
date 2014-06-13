var intersectionHandler;
var projector = new THREE.Projector();

function setAction(handler) {
    intersectionHandler = handler;
}

function init(domContainer, camera, normal) {

    if ( !normal ) {
        normal = new THREE.Vector3(0,-1,0);
    }
    var handler = function(event) {
        event.preventDefault();

        var vector = new THREE.Vector3(
            ( event.clientX / domContainer.width() ) * 2 - 1,
            - ( event.clientY / domContainer.height() ) * 2 + 1,
            0.5
        );
        projector.unprojectVector( vector, camera );

        var ray = new THREE.Ray( camera.position,
            vector.sub( camera.position ).normalize() );
        var plane = new THREE.Plane(normal, 0);

        var intersection = ray.intersectPlane(plane);
        if ( intersection ) {
            intersectionHandler(intersection);
        }
    }

    domContainer[0].addEventListener('mousedown', handler, false );
    return {
        setAction: setAction,
        disable: function(){
            domContainer[0].removeEventListener('mousedown', handler);
        }
    }

}

module.exports = {

    init: init
};
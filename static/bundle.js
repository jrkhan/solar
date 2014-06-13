(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = (function() {

    var shadersInProgress = 0;
    var readyHandlers = [];
    function gotShader() {
        shadersInProgress--;
        if ( shadersInProgress == 0) {
            ready();
        }
    }

    function getShader(path, callback) {
        gettingShader();
        $.get(path, function(data){
            callback(data);
            gotShader();
        });
    }

    function gettingShader() {
        shadersInProgress++;
    }

    function addReadyHandler(f) {
        if ( shadersInProgress == 0 ) {
            f();
        } else {
            readyHandlers.push(f);
        }
    }

    function ready() {
        for ( var i = 0; i < readyHandlers.length; i++ ) {
            readyHandlers[i]();
        }
    }

    return {
        addReadyHandler: addReadyHandler,
        gotShader: gotShader,
        gettingShader: gettingShader,
        getShader: getShader
    }
})();

},{}],2:[function(require,module,exports){
var COMPOSER = THREE.EffectComposer;
var Actions             = require('./parts/controls/actions');
var keybinds            = require('./parts/controls/keybinds');
var rotate              = require('./parts/controls/camera/rotate');
var track               = require('./parts/controls/camera/TrackObject');
var zoom                = require('./parts/controls/camera/zoom');
var intersectionFactory = require('./parts/controls/IntersectionFinder');
var orbit               = require('./parts/orbit/orbit');
var planetFactory       = require('./parts/things/planet/planetFactory');
var planetViewFactory   = require('./parts/things/planet/planetView');
var starFactory         = require('./parts/things/star/starFactory');
var starViewFactory     = require('./parts/things/star/starView');
var actionSelection     = require('./parts/ui/components/actionSelection');
var assets              = require('./assets');
var bloomShaderFactory  = require('./parts/shaders/bloom/bloom');
var blurShaderFactory   = require('./parts/shaders/blur/blur');

var camera, scene, renderer, composer;
var depthMaterial;
var star;
var width, height;
var starEffect, bloomEffect;
var physicsBackedViews = [];
var initNear = 10;
var initFar = 10000;

function log(message){
    $('#console').text(message);
}

function init(domContainer) {
    log("init");
    renderer = new THREE.WebGLRenderer();
    renderer.antialias = true;
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    width = domContainer.width();
    height = domContainer.height();

    renderer.setSize( width, height );
    domContainer.append( renderer.domElement );

    camera = new THREE.PerspectiveCamera( 65, window.innerWidth / window.innerHeight, initNear, initFar );
    camera.position.y = 250;
    camera.position.z = 400;

    scene = new THREE.Scene();

    loadSkybox();

    star = starViewFactory.makeStarView(starFactory.getStar());
    orbit.addAbilityToBeOrbited(star);
    scene.add(star);

    addPlanet(new THREE.Vector3(300,0,0), star);

    scene.add(star.light);
    scene.add(star.backgroundParticles);
    for ( var i = 0; i < star.radialParticlesEmitters.length; i++) {
        var sys = star.radialParticlesEmitters[i];
        scene.add(sys);
    }

    setupPostprocessingEffects(render);

    onWindowResize(null);

    setupActions(domContainer);

    camera.trackedObject = star;
}

function setupPostprocessingEffects(){
    composer = new COMPOSER( renderer );
    var cameraPass = new THREE.RenderPass( scene, camera );
    composer.addPass(cameraPass);

    //we write depth to a texture so we can use it later
    var depthShader = THREE.ShaderLib[ "depthRGBA" ];
    var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );

    depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
    depthMaterial.blending = THREE.NoBlending;

    var depthParams = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
    depthTarget = new THREE.WebGLRenderTarget( width, height, depthParams );

    var bloomShader = bloomShaderFactory.instance();
    bloomEffect = new THREE.ShaderPass( bloomShader );
    bloomEffect.uniforms['tSize'].value = new THREE.Vector2(width, height);

    var shader = blurShaderFactory.instance();

    var effect = new THREE.ShaderPass( shader );
    effect.uniforms['tDepth'].value = depthTarget;
    effect.uniforms['scale'].value = 4;
    effect.uniforms['tSize'].value = new THREE.Vector2(width, height);
    effect.uniforms['cameraNear'].value = camera.near;
    effect.uniforms['cameraFar'].value = camera.far;

    var order = [
        bloomEffect,
        effect,
    ];

    for ( var i = 0; i < order.length; i++ ) {
        composer.addPass(order[i]);
    }

    order[order.length-1].renderToScreen = true;

    starEffect = effect;
}


function setupActions(domContainer){
    var intersectionFinder = intersectionFactory.init($(renderer.domElement), camera);
    var actions = Actions.init(camera, star, addPlanet, intersectionFinder);
    intersectionFinder.setAction(actions[0].handler);

    actionSelection.enable(domContainer, actions);
}


function loadSkybox() {
    var sky = 'images/sky/sky_';
    var urls = [
        sky+'right1.png',
        sky+'left2.png',
        sky+'top3.png',
        sky+'bottom4.png',
        sky+'front5.png',
        sky+'back6.png'
    ];

    var cubemap = THREE.ImageUtils.loadTextureCube(urls); // load textures
    cubemap.format = THREE.RGBFormat;

    var shader = THREE.ShaderLib['cube']; // init cube shader from built-in lib
    shader.uniforms['tCube'].value = cubemap; // apply textures to shader

    // create shader material
    var skyBoxMaterial = new THREE.ShaderMaterial( {
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });

    // create skybox mesh
    var skybox = new THREE.Mesh(
        new THREE.CubeGeometry(60000, 60000, 60000),
        skyBoxMaterial
    );

    scene.add(skybox);
}

function makePlanetView(planet) {
    var view = planetViewFactory.makePlanetView(planet);
    physicsBackedViews.push(view);
    scene.add(view);
}

function addPlanet(position, thingToOrbit) {
    var planet = planetFactory.getPlanet(position, thingToOrbit);
    makePlanetView(planet);
    for (var i = 0; i < planet.moons.length; i++) {
        makePlanetView(planet.moons[i]);
    }
    return planet;
}

function onWindowResize( event ) {

renderer.setSize( width, height );

camera.aspect = width / height;
camera.updateProjectionMatrix();

}

function animate() {
requestAnimationFrame( animate );
render();
}

function render() {

  var dt = 1;//clock.getDelta();

  star.recursivePhysicsUpdate(dt);
  for ( var i = 0; i < physicsBackedViews.length; i++ ) {
      physicsBackedViews[i].update();
  }

  var color = star.viewUpdate(dt, camera, new THREE.Vector2(width,height), starEffect);
  starEffect.uniforms["starColor"].value = color;
  bloomEffect.uniforms["bloomColor"].value = color;

  if ( camera.transition ) {
    var t = camera.transition;
    var o = camera.transition.original;
    camera.position = new THREE.Vector3(o.x, o.y, o.z).lerp(camera.transition.target, t.elapsed/ t.duration);
    t.elapsed++;
    if ( t.elapsed > t.duration ) {
        camera.transition = null;
    }
  }

  rotate.updateRotation(camera);
  track.update(camera);
  zoom.updateZoom(camera);

  camera.lookAt(camera.target);

  scene.overrideMaterial = depthMaterial;
  renderer.render( scene, camera, depthTarget);
  scene.overrideMaterial = null;
  starEffect.uniforms["time"].value += .001;

  composer.render();
}

assets.addReadyHandler(function(){
    init($('#game'));
    animate();

});
},{"./assets":1,"./parts/controls/IntersectionFinder":4,"./parts/controls/actions":6,"./parts/controls/camera/TrackObject":7,"./parts/controls/camera/rotate":8,"./parts/controls/camera/zoom":9,"./parts/controls/keybinds":10,"./parts/orbit/orbit":11,"./parts/shaders/bloom/bloom":13,"./parts/shaders/blur/blur":14,"./parts/things/planet/planetFactory":16,"./parts/things/planet/planetView":17,"./parts/things/star/starFactory":18,"./parts/things/star/starView":19,"./parts/ui/components/actionSelection":20}],3:[function(require,module,exports){
exports.configSatellite = function(thingToOrbit, satelliteFactory){
    var handler = function(intersection){
        satelliteFactory(intersection, thingToOrbit);
    }
    return handler;
};


},{}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
var numFrames = 20;

exports.cameraMovementAction = function(camera){
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
};
},{}],6:[function(require,module,exports){
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
},{"./AddSatellite":3,"./MoveCamera":5,"./camera/TrackObject":7,"./camera/rotate":8,"./camera/zoom":9}],7:[function(require,module,exports){
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

module.exports = {
    buildActions: buildActions,
    update: update
};
},{}],8:[function(require,module,exports){
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


},{}],9:[function(require,module,exports){
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

module.exports = {
    buildActions: buildActions,
    updateZoom: updateZoom
};

},{}],10:[function(require,module,exports){
var actions = require('./actions');

actions.onReady(function(){

    var listener = new window.keypress.Listener();
    var ra = actions.rotationActions();
    listener.register_combo({
        keys: "left",
        on_keydown: ra.rotateLeft,
        on_keyup: ra.stopRotateLeft
    });

    listener.register_combo({
        keys: "right",
        on_keydown: ra.rotateRight,
        on_keyup: ra.stopRotateRight
    });

    var trackActions = actions.trackObjectActions();
    listener.register_combo({
        keys: "tab",
        on_keyup: trackActions.trackNext,
        is_solitary: true,
        prevent_default: true
    });
    listener.register_combo({
        keys: "shift tab",
        on_keyup: trackActions.trackPrevious,
        prevent_default: true
    });

    var zoomActions = actions.zoomActions();
    listener.register_combo({
        keys: "up",
        on_keydown: zoomActions.zoomIn,
        on_keyup: zoomActions.stopZoomIn
    });

    listener.register_combo({
        keys: "down",
        on_keydown: zoomActions.zoomOut,
        on_keyup: zoomActions.stopZoomOut
    });

});
},{"./actions":6}],11:[function(require,module,exports){
var V3 = THREE.Vector3;
var OrbitList = require('../things/orbitList');
var physics = require('../physics/physics');

//set the object into immediate circular orbit
//should be useful for initial setup of moons and planets
//v = sqrt(G(m1+m2)/r)
function orbitImmediately(self, other, planeNormal) {
    if ( planeNormal == null ) {
        planeNormal = new V3(0,1,0);
    }

    var tempA = {};
    tempA.position = new V3().copy(self.position);
    physics.addPhysicsProperties(tempA);
    tempA.setMass(self.mass());

    var tempB = {};
    tempB.position = new V3().copy(other.position);
    physics.addPhysicsProperties(tempB);
    tempB.setMass(other.mass());

    physics.applyGravity(tempB, tempA, true);
    tempA.verlet(tempA, 1);

    var displacement = new V3();
    displacement.subVectors(self.position, other.position);

    var rSq = displacement.lengthSq();
    var n = tempA.n;
    //how much must we be moving in order for us to cover this change

    var direction = displacement.cross(planeNormal).normalize();

    //the next position will need to be just as far away as the current distance;
    //next position
    var p = self.position;
    var nextPosition = tempA.x[n + 1];
    var midPoint = nextPosition.lerp(tempA.position, .5);
    var shortR = midPoint.distanceTo(other.position);

    //x * x + shortR * shortR = r * r
    var cSquaredMinusASquared = (rSq)-(shortR * shortR);
    var mag = Math.sqrt(cSquaredMinusASquared);

    var previousPosition = midPoint.add(direction.multiplyScalar(mag));

    if ( other.orbitTarget != undefined ) {
        var dis = new THREE.Vector3().copy(other.x[other.n-1]).sub(other.x[other.n]);
        previousPosition.add(dis);
    }

    self.x[n-1] = previousPosition;

    self.orbitTarget = other;

    if ( self.orbitList != undefined ) {
        var dis = new THREE.Vector3().copy(self.x[self.n-1]).sub(self.x[self.n]);
        for ( var i = 0; i < self.orbitList.length(); i++ ) {
            var item = self.orbitList.getItem(i);
            item.x[n-1].add(dis);
        }
    }

    return new V3().copy(self.x[n]).sub(previousPosition);
}

function tryToOrbit() {


}

function addAbilityToBeOrbited(physicsObject) {
    if ( physicsObject.orbitList == undefined ) {
        physicsObject.orbitList = OrbitList.initList(physicsObject);
    }
    physicsObject.recursivePhysicsUpdate = function(dt) {
        for ( var i = 0; i < physicsObject.orbitList.length(); i++ ) {
            var item = physicsObject.orbitList.getItem(i);
            physics.applyGravity(physicsObject, item, true);
            item.recursivePhysicsUpdate(dt);
        }
        physicsObject.physicsUpdate(dt);
    }
}

function addAbilityToOrbit(physicsObject) {
    physicsObject.orbit = function(other, planeNormal){
        orbitImmediately(physicsObject, other, planeNormal);
        if ( other.orbitList != undefined ) {
            other.orbitList.addItem(physicsObject);
        }
    }
    if ( physicsObject.recursivePhysicsUpdate == undefined ) {
        physicsObject.recursivePhysicsUpdate = physicsObject.physicsUpdate;
    }
}


module.exports = {
    makeOrbital: function(o){addAbilityToOrbit(o); addAbilityToBeOrbited(o); },
    addAbilityToOrbit: addAbilityToOrbit,
    addAbilityToBeOrbited: addAbilityToBeOrbited
};
},{"../physics/physics":12,"../things/orbitList":15}],12:[function(require,module,exports){
var G = .000005;
var C = 1; //the speed at which information travels
var OneSixth = 1/6;

function addPhysicsProperties(object, keepHistory) {
    if ( keepHistory == undefined ) {
        keepHistory = true;
    }
    if ( !object.position ) {
        object.position = new THREE.Vector3();
    }

    object.invMass;
    object.setMass = function(value){
        object.invMass = 1/value;
    }
    object.setMass(1);

    object.mass = function(){return 1/object.invMass; }

    object.n = 1;
    object.x = [object.position, object.position];      //array of positions
    object.v = [new THREE.Vector3(), new THREE.Vector3()];      //array of velocities
    object.a = [new THREE.Vector3(), new THREE.Vector3()];  //array of accelerations
    object.dt = [1, 1];

    object.isKeepingHistory = keepHistory;

    object.verlet =  verlet;

    object.velocity = function(){
        return object.v[object.n];
    };

    object.previousPosition = function(){
        return object.x[object.n-1];
    }

    object.acceleration = function(){
        return object.a[object.n];
    };

    object.physicsUpdate = function(dt){
        if ( dt > 0 ) {

            verlet(object, dt);

            if ( object.isKeepingHistory ) {
                object.n++;
            } else {
                var n = object.n;
                object.x[n-1] = object.x[n];
                object.a[n-1] = object.a[n];
                object.x[n] = object.x[n+1];
                object.a[n] = object.a[n+1];
            }
            object.position = object.x[object.n];
        }
    };
}

function addAmount(solarObject, accel) {
    solarObject.acceleration().add(accel);
    if ( solarObject.orbitList != undefined ) {
        var ol = solarObject.orbitList;
        var len = ol.length();
        for ( var i = 0; i < len; i++) {
            addAmount(ol.getItem(i), accel);
        }
    }
}

function applyGravity(objectA, objectB, lockA, lockB) {
    //f = G(M1 + M2)/rsqr
    var a = copy(objectA.position);
    var b = copy(objectB.position);
    var dis = new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z);

    var rsqr = copy(objectA.position).distanceToSquared(copy(objectB.position));
    var f = G * (objectA.mass() + objectB.mass())/rsqr;

    var bToA = copy(dis).multiplyScalar(G * objectA.mass()/rsqr);
    var aToB = copy(dis).multiplyScalar(-G * objectB.mass()/rsqr);

    if ( !lockB ) {
        addAmount(objectB, bToA);
    }
    if ( !lockA ) {
        addAmount(objectA, aToB.negate());
    }
}

function copy(v) {
    return new THREE.Vector3(v.x, v.y, v.z);
}

function verlet(o, dt) {
    var a = o.a;
    var x = o.x;
    var n = o.n;
    a[n+1] = new THREE.Vector3();
    o.dt[n] = dt;

    var lastX = copy(x[n - 1]);
    var cx = copy(x[n]);
    var accel = copy(a[n]);
    var lastDt = o.dt[n-1];
    x[n+1] = cx.add(
        copy(cx).sub(lastX).multiplyScalar(dt/lastDt)
    ).add(
        accel.multiplyScalar(dt * (lastDt + lastDt)/2)
    );
}

module.exports = {
    G: G,
    addPhysicsProperties: addPhysicsProperties,
    applyGravity: applyGravity
};
},{}],13:[function(require,module,exports){
module.exports = (function(assets){
    var vertex;
    var fragment;

    var kernel = [];

    var span = 2;

    for ( var i = -span; i < span; i++ ) {
        for ( var j = -span; j < span; j++) {
            var max = .05;
            var len = max*new THREE.Vector2(i,j).lengthSq()/(2 * span * span);
            kernel.push(new THREE.Vector3(i,j,len));
        }
    }

    assets.getShader('parts/shaders/postProcessing.vs', function(data){
        vertex = data;
    });
    assets.getShader('parts/shaders/bloom/bloom.fs', function(data){
        fragment = "#define KERNEL_SIZE_INT " + kernel.length + "\n" + data;
    });

    function instance() {
        return {
            uniforms: {
                "tDiffuse":     { type: "t",    value: null                     },
                "triggerColor": { type: "v3",   value: new THREE.Vector3(1,1,1) },
                "bloomColor":   { type: "v3",   value: new THREE.Vector3(1,1,1) },
                "kernel":       { type: "v3v",  value: kernel                   },
                "tSize":        { type: "v2",   value: new THREE.Vector2(100,100)}
            },
            vertexShader: vertex,
            fragmentShader: fragment
        };
    }

    return {
        instance: instance
    }

})(require('../../../assets'));
},{"../../../assets":1}],14:[function(require,module,exports){

module.exports = (function(assets){

    var vertex;
    var fragment;
    assets.getShader('parts/shaders/postProcessing.vs', function(data){
        vertex = data;
    });
    assets.getShader('parts/shaders/blur/blur.fs', function(data){
       fragment = data;
    });

    function instance() {
        return {
            uniforms: {

                "tDiffuse":       { type: "t",  value: null },
                "tSize":          { type: "v2", value: new THREE.Vector2( 256, 256 ) },
                "center":         { type: "v2", value: new THREE.Vector2( 0.5, 0.5 ) },
                "angle":          { type: "f",  value: 1.57 },
                "scale":          { type: "f",  value: 1.0 },
                "starColor":      { type: "v3", value: new THREE.Vector3(1,1,1)},
                "tDepth":         { type: "t",  value: null },
                "time":           { type: "f",  value: 0 },
                "cameraNear":     { type: "f",  value: 5 },
                "cameraFar":      { type: "f",  value: 100 },
                "maxDistance":    { type: "f",  value: 10000 },
                "distanceToStar": { type: "f",  value: 0 }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
        };
    }


    return {
        instance: instance
    }
})(require('../../../assets'));

},{"../../../assets":1}],15:[function(require,module,exports){
function nextItem(list) {
    var i = list.distanceIndex.indexOf(list.currentEntry);
    if ( i < list.distanceIndex.length - 1) {
        list.currentEntry = list.distanceIndex[i+1];
    }
    return list.currentEntry.item;
}

function previousItem(list) {
    var i = list.distanceIndex.indexOf(list.currentEntry);
    if ( i > 0 ) {
        list.currentEntry = list.distanceIndex[i-1];
    }
    return list.currentEntry.item;
}

function distanceSort(a,b) {
    return a.distance - b.distance;
}

function length(items) {
    return items.length;
}

function getItem(items, i) {
    return items[i];
}

function addItem(list, newItem, items) {
    var distance = new THREE.Vector3().copy(list.centerItem.position).sub(newItem.position).lengthSq();
    if ( newItem != list.centerItem ) {
        items.push(newItem);
    }
    var entry  = {
        item: newItem,
        distance: distance
    }

    list.distanceIndex.push(entry);
    list.distanceIndex.sort(distanceSort)

    return entry;
}

function initList(item){
    var items = [];
    var list = {
        centerItem: item,
        distanceIndex: [],
        addItem: function(newItem){ return addItem(list, newItem, items) },
        nextItem: function() {return nextItem(list); },
        previousItem: function() {return previousItem(list); },
        currentEntry: null,
        length: function(){return length(items);},
        getItem: function(i){return getItem(items,i);}
    };
    list.currentEntry = list.addItem(item);
    return list;
}
module.exports = {
    initList: initList
};
},{}],16:[function(require,module,exports){
var Physics = require('../../physics/physics');
var Random = Math;
var orbitFactory = require('../../orbit/orbit');
var V3 = THREE.Vector3;

function getOffset(up) {
    if ( up == undefined ) {
        up = new V3(0,1,0);
    }
    return new V3(25 + Random.random() * 10, 0, 15 + Random.random() * 10);
}
function getPlanet(position, thingToOrbit, mass, maxMoons) {
    if (maxMoons == undefined) {
        maxMoons = 3;
    }
    if (mass == undefined) {
        mass = 100000;
    }

    var planet = {};
    Physics.addPhysicsProperties(planet);
    planet.x[planet.n].copy(position);
    planet.setMass(mass);
    planet.moons = [];
    orbitFactory.makeOrbital(planet);
    planet.orbit(thingToOrbit);
    var numMoons = maxMoons;
    for (var i = 0; i < numMoons; i++ ) {
        planet.moons.push(
            getPlanet(
                new V3().addVectors(position, getOffset()),
                planet,10,0
            )
        );
    }
    return planet;
}
module.exports = {
    getPlanet: getPlanet
};
},{"../../orbit/orbit":11,"../../physics/physics":12}],17:[function(require,module,exports){
function makePlanetView(planet) {
    var geometry = new THREE.IcosahedronGeometry(2 + .0001 * planet.mass(), 2);
    var texture = THREE.ImageUtils.loadTexture( 'images/water.jpg' );
    var mat = new THREE.MeshPhongMaterial({
        ambient: 0x55FF55,
        color: 0xCCFFCC,
        specular: 0xCCCCCC,
        shininess: 5,
        emissive: 0x001133,
        shading: THREE.SmoothShading,
        map: texture
    });

    var planetView = new THREE.Mesh( geometry, mat );

    planetView.update = function() {
        planetView.position.copy(planet.x[planet.n]);
    }
    return planetView;
}

module.exports = {
    makePlanetView: makePlanetView
};
},{}],18:[function(require,module,exports){
var physics = require('../../physics/physics');


var StarTypes = [
    {
        starType: 'o',
        color: 0x0000FF,
        secondaryColor: 0x000033,
        temp: 25000,
        avgMass: 60,
        avgRadius: 15,
        avgLum: 1400000
    },
    {
        starType: 'b',
        color: 0x2222FF,
        secondaryColor: 0x000033,
        temp: 18000,
        avgMass: 18,
        avgRadius: 7,
        avgLum: 20000
    },
    {
        starType: 'a',
        color: 0x2222FF,
        secondaryColor: 0x000033,
        temp: 9250,
        avgMass: 3.2,
        avgRadius: 2.5,
        avgLum: 80
    },
    {
        starType: 'f',
        color: 0xEFEFFF,
        secondaryColor: 0xA6A6FF,
        temp: 6750,
        avgMass: 1.7,
        avgRadius: 1.3,
        avgLum: 6
    },
    {
        starType: 'g',
        color: 0xffE566,
        secondaryColor: 0xf6bd7c,
        temp: 5500,
        avgMass: 1.1,
        avgRadius: 1.1,
        avgLum: 1.2
    },
    {
        starType: 'k',
        color: 0xffE566,
        secondaryColor: 0xf6bd7c,
        temp: 4250,
        avgMass: .8,
        avgRadius:.9 ,
        avgLum: .4
    },
    {
        starType: 'm',
        color: 0xFF6666,
        secondaryColor: 0xDD3333,
        temp: 3000,
        avgMass: .3,
        avgRadius:.4,
        avgLum: .04
    }

];

var StarFactory = (function(types){

    var massOfTheSun = 50000;//2 * Math.pow(10, 30); //kg
    var radiusOfTheSun = 20;//695500; //km
    var base = 100;

    var variance = .05;

    //index types
    var byStarType = {};
    var letters = [];
    var numbers = [0,1,2,3,4,5,6,7,8,9];
    for ( var i = 0; i < types.length; i++) {
        byStarType[types[i].starType] = types[i];
        letters[i] = types[i].starType;
    }


    function randomLetter() {
        var hl = letters.length/2;
        return letters[Math.floor(Math.random() * hl + Math.random() * hl)];
    }

    function randomNumber() {
        return numbers[Math.floor(Math.random() * numbers.length)];
    }

    function vary(value, multiplier) {
        var base = value * multiplier;
        var offset = base * (Math.random() * variance) - (Math.random() * variance);
        return base + offset;
    }
    function getStar(type) {
        if (!type) {
            type = randomLetter() + randomNumber();

        }
        var spectralType = type.charAt(0);
        var spectralNumber = type.charAt(1);

        var proto = byStarType[spectralType];

        var multiplier = 1 + spectralNumber/5;

        var star = {};

        physics.addPhysicsProperties(star);

        star.setMass(vary(proto.avgMass * massOfTheSun, multiplier));
        star.color = proto.color;
        star.secondaryColor = proto.secondaryColor;
        star.temp = vary(proto.temp, multiplier);
        star.radius = vary(proto.avgRadius * radiusOfTheSun, multiplier);
        star.lum = Math.log(base + vary(proto.avgLum, multiplier))/Math.log(base);

        return star;
    }

    return {
        getStar: getStar
    }
})(StarTypes);

module.exports = {
    starTypes: StarTypes,
    getStar: StarFactory.getStar
};
},{"../../physics/physics":12}],19:[function(require,module,exports){
module.exports = (function(
    Geo,
    ParticleMaterial,
    Vertex,
    Vector3,
    ParticleSystem,
    rng,
    utils,
    assets,
    physics,
    vectorUtils){

    var sunFrag, sunVert;
    assets.getShader('parts/shaders/noise.fs', function(data){
        sunFrag = data;
    });
    assets.getShader('parts/shaders/default.vs', function(data){
        sunVert = data;
    });

    var texture = THREE.ImageUtils.loadTexture( 'images/water.jpg' );

    function hexToVector(hex) {
        var red = (hex >> 16)/255;
        var blue = (hex >> 8 & 0xFF)/255;
        var green = (hex & 0xFF)/255;
        var color = new Vector3(red, blue, green);
        return color;
    }

    function makeStarView(star) {
        var geometry = new THREE.IcosahedronGeometry(star.radius, 3);

        var mat = new THREE.MeshPhongMaterial({
            ambient: 0x55FF55,
            color: 0xCCFFCC,
            specular: 0xCCCCCC,
            shininess: 5,
            emissive: star.color,
            shading: THREE.SmoothShading,
            map: texture
        });

        var color = hexToVector(star.color);
        var secondaryColor = hexToVector(star.secondaryColor);

        var scaleValue = .0065 * star.radius;

        var uniforms = {
            time: 	{ type: "f", value: 1.0 },
            scale: 	{ type: "f", value: .02 },
            color:  { type: "v3", value: color },
            secondaryColor: { type: "v3", value: secondaryColor },
            camera: { type: "v3", value: new Vector3() }
        };


        var material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: sunVert,
            fragmentShader: sunFrag
        } );

        var starView = new THREE.Mesh( geometry, material );

        physics.addPhysicsProperties(starView);
        starView.invMass = star.invMass;

        starView.light = new THREE.PointLight(star.color);
        starView.light.position = starView.position;
        starView.light.intensity = star.lum;
        starView.backgroundParticles = buildBackgroundParticles(star);
        starView.radialParticlesEmitters = buildRadialParticleEmitters(star);
        starView.uniforms = uniforms;


        //what we need to do each frame to update the view of the star
        starView.viewUpdate = function(dt, camera, size, starEffect ){
            starView.uniforms.time.value += .25 * dt;

            var df = 4500;
            starEffect.uniforms.maxDistance.value = df * df;
            var sp = new Vector3().copy(starView.position);
            starEffect.uniforms.distanceToStar.value = sp.sub(camera.position).lengthSq();


            animateRadialParticles(starView, dt);

            var vector = new Vector3();
            var projector = new THREE.Projector();
            projector.projectVector( vector.setFromMatrixPosition( starView.matrixWorld ), camera );

            var widthHalf = size.x/2;
            var heightHalf = size.y/2;
            vector.x = ( vector.x * widthHalf ) + widthHalf;
            vector.y = ( vector.y * heightHalf ) + heightHalf;
            starEffect.uniforms["center"].value = vector;

            return hexToVector(star.color);
        }

        return starView;
    }


    function animateRadialParticles(star, dt) {

        var emitters = star.radialParticlesEmitters;
        for ( var j = 0; j < emitters.length; j++ ) {
            var particles = star.radialParticlesEmitters[j];
            var emitter = particles.sunSpotEmitter;
            var vertices = particles.geometry.vertices;

            for ( var i = 0; i < vertices.length; i++ ) {
                var p = vertices[i];
                if (p.isActive) {
                    physics.applyGravity(star, p.physics, true);
                    p.physics.physicsUpdate(dt);
                    p.copy(p.physics.position);

                    if (emitter.isInside(p)) {
                        p.isActive = false;
                        p.copy(star.position);
                        emitter.undeployed.push(p);
                        if ( emitter.undeployed.length == emitter.particleCount ) {

                        }
                    }
                }
            }
            if ( emitter.undeployed.length > 0 && emitter.currentWait == 0) {
                //spawn the particle
                var particle = emitter.undeployed.pop();
                var pp = particle.physics;
                pp.position.copy(emitter.position);
                pp.previousPosition().copy(emitter.position);

                var accel = new Vector3().copy(particle.physics.position).sub(star.position).setLength(emitter.baseAcceleration).add(
                    vectorUtils.randomVector(emitter.baseAcceleration/4)
                );
                particle.physics.acceleration().add(accel);
                particle.isActive = true;

                if ( emitter.undeployed.length == 0 ) {
                    emitter.pickNewPosition();
                    emitter.currentWait = emitter.randomWait();
                }
            }

            if ( emitter.currentWait > 0 ) {
                emitter.currentWait--;
            }
        }
    }

    function randMinusRand() {
        return rng.random() - rng.random();
    }

    function buildBackgroundParticles(star) {
        var particleCount = 400;
        var particles = new Geo();
        var mat = new ParticleMaterial({
            color: star.color,
            map: utils.loadTexture('/images/particles/dust.png'),
            size: 150,
            opacity:.025,
            transparent: true,
            blendDst: THREE.SrcAlphaFactor,
            blending: THREE.AdditiveBlending
        });
        mat.depthWrite = false;
        var pos = star.position;
        var max = pos.x + star.radius + 600;
        var min = pos.x + star.radius + 50;
        for (var i = 0; i < particleCount; i++) {
            var dist = rng.random() * (max - min) + min;
            var v = new Vector3(randMinusRand(),randMinusRand(), randMinusRand());
            v.setLength(dist);
            particles.vertices.push(v);
        }

        var particleSystem = new ParticleSystem(
            particles,
            mat
        );

        particleSystem.sortParticles = true;
        return particleSystem;
    }

    function randomPointOnSurface(star) {
        return new Vector3(randMinusRand(),randMinusRand(), randMinusRand()).setLength(star.radius).add(star.position);
    }

    function buildRadialParticleEmitters(star) {
        var emitters = [];

        for ( var i = 0; i < 15; i++ ) {
            emitters.push(buildRadialParticleEmitter(star));
        }
        return emitters;
    }

    function radialParticleMaterial(star) {
        return new ParticleMaterial({
            color: star.color,
            map: utils.loadTexture('/images/particles/dust.png'),
            size: 7 +.025 * star.radius,
            opacity: .25,
            transparent: true,
            blendDst: THREE.SrcAlphaFactor,
            blending: THREE.AdditiveBlending
        });
    }

    function buildRadialParticleEmitter(star) {
        var particleCount = 35;
        var particles = new Geo();

        var emitter = {};
        emitter.position = new Vector3();
        emitter.pickNewPosition = function(){
            emitter.position = randomPointOnSurface(star);
        };

        emitter.maxWait = 550;
        emitter.randomWait = function(){
            return rng.round(rng.random() * emitter.maxWait);
        }
        emitter.currentWait = emitter.randomWait();

        emitter.isInside = function(pos){
            return new Vector3().copy(pos).sub(star.position).lengthSq() < (star.radius * star.radius);
        };

        emitter.baseAcceleration = Math.sqrt(star.mass())/550;
        emitter.particleCount = particleCount;
        emitter.pickNewPosition();
        emitter.undeployed = [];

        for (var i = 0; i < particleCount; i++) {
            var v = new Vector3();
            var phy = v.physics = {};
            physics.addPhysicsProperties(v.physics, false); //don't keep history

            var pPos = phy.position;
            pPos.copy(v);

            phy.mass(.001);
            emitter.undeployed.push(v);
            particles.vertices.push(v);
        }

        var particleSystem = new ParticleSystem(
            particles,
            radialParticleMaterial(star)
        );

        particleSystem.sunSpotEmitter = emitter;
        particleSystem.sortParticles = true;
        return particleSystem;
    }

    return {
        makeStarView: makeStarView
    }

})(THREE.Geometry,
   THREE.ParticleSystemMaterial,
   THREE.Vertex,
   THREE.Vector3,
   THREE.ParticleSystem,
   Math,
   THREE.ImageUtils,
   require('../../../assets'),
   require('../../physics/physics'),
   require('../../utils/vectorUtils'));
},{"../../../assets":1,"../../physics/physics":12,"../../utils/vectorUtils":21}],20:[function(require,module,exports){
var jquery = $;
var url = 'parts/ui/components/actionSelection.mustache';

function enable(parent, actions) {
    isEnabled = true;

    jquery.get(url, function(data){
        var actionTemplate = Handlebars.compile(data);
        var action = actionTemplate({actions: actions});
        parent.append(action);

        for ( var i = 0; i < actions.length; i++ ) {
            var action = actions[i];
            var id = action.id;
            var handler = action.handler;
            jquery('#'+id).click(handler);
        }
    });
}

function disable() {

}

module.exports = {
    enable: enable,
    disable: disable
}
},{}],21:[function(require,module,exports){
module.exports = (function(Vector3, rng){
    function randomComp() {
        return rng.random() - rng.random();
    }

    return {
        randomVector: function(size){
            var x = randomComp();
            var y = randomComp();
            var z = randomComp();
            return new Vector3(x,y,z).setLength(size);
        }
    }
})(THREE.Vector3, Math);
},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXEphbWlsXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9hc3NldHMuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL2dhbWUuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL0FkZFNhdGVsbGl0ZS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvY29udHJvbHMvSW50ZXJzZWN0aW9uRmluZGVyLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9jb250cm9scy9Nb3ZlQ2FtZXJhLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9jb250cm9scy9hY3Rpb25zLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9jb250cm9scy9jYW1lcmEvVHJhY2tPYmplY3QuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS9yb3RhdGUuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS96b29tLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9jb250cm9scy9rZXliaW5kcy5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvb3JiaXQvb3JiaXQuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3BoeXNpY3MvcGh5c2ljcy5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvc2hhZGVycy9ibG9vbS9ibG9vbS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvc2hhZGVycy9ibHVyL2JsdXIuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3RoaW5ncy9vcmJpdExpc3QuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3RoaW5ncy9wbGFuZXQvcGxhbmV0RmFjdG9yeS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRWaWV3LmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy90aGluZ3Mvc3Rhci9zdGFyRmFjdG9yeS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvdGhpbmdzL3N0YXIvc3RhclZpZXcuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3VpL2NvbXBvbmVudHMvYWN0aW9uU2VsZWN0aW9uLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy91dGlscy92ZWN0b3JVdGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcclxuXHJcbiAgICB2YXIgc2hhZGVyc0luUHJvZ3Jlc3MgPSAwO1xyXG4gICAgdmFyIHJlYWR5SGFuZGxlcnMgPSBbXTtcclxuICAgIGZ1bmN0aW9uIGdvdFNoYWRlcigpIHtcclxuICAgICAgICBzaGFkZXJzSW5Qcm9ncmVzcy0tO1xyXG4gICAgICAgIGlmICggc2hhZGVyc0luUHJvZ3Jlc3MgPT0gMCkge1xyXG4gICAgICAgICAgICByZWFkeSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXRTaGFkZXIocGF0aCwgY2FsbGJhY2spIHtcclxuICAgICAgICBnZXR0aW5nU2hhZGVyKCk7XHJcbiAgICAgICAgJC5nZXQocGF0aCwgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xyXG4gICAgICAgICAgICBnb3RTaGFkZXIoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXR0aW5nU2hhZGVyKCkge1xyXG4gICAgICAgIHNoYWRlcnNJblByb2dyZXNzKys7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkUmVhZHlIYW5kbGVyKGYpIHtcclxuICAgICAgICBpZiAoIHNoYWRlcnNJblByb2dyZXNzID09IDAgKSB7XHJcbiAgICAgICAgICAgIGYoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZWFkeUhhbmRsZXJzLnB1c2goZik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJlYWR5KCkge1xyXG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHJlYWR5SGFuZGxlcnMubGVuZ3RoOyBpKysgKSB7XHJcbiAgICAgICAgICAgIHJlYWR5SGFuZGxlcnNbaV0oKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGRSZWFkeUhhbmRsZXI6IGFkZFJlYWR5SGFuZGxlcixcclxuICAgICAgICBnb3RTaGFkZXI6IGdvdFNoYWRlcixcclxuICAgICAgICBnZXR0aW5nU2hhZGVyOiBnZXR0aW5nU2hhZGVyLFxyXG4gICAgICAgIGdldFNoYWRlcjogZ2V0U2hhZGVyXHJcbiAgICB9XHJcbn0pKCk7XHJcbiIsInZhciBDT01QT1NFUiA9IFRIUkVFLkVmZmVjdENvbXBvc2VyO1xudmFyIEFjdGlvbnMgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL2FjdGlvbnMnKTtcbnZhciBrZXliaW5kcyAgICAgICAgICAgID0gcmVxdWlyZSgnLi9wYXJ0cy9jb250cm9scy9rZXliaW5kcycpO1xudmFyIHJvdGF0ZSAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS9yb3RhdGUnKTtcbnZhciB0cmFjayAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9wYXJ0cy9jb250cm9scy9jYW1lcmEvVHJhY2tPYmplY3QnKTtcbnZhciB6b29tICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9wYXJ0cy9jb250cm9scy9jYW1lcmEvem9vbScpO1xudmFyIGludGVyc2VjdGlvbkZhY3RvcnkgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL0ludGVyc2VjdGlvbkZpbmRlcicpO1xudmFyIG9yYml0ICAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL29yYml0L29yYml0Jyk7XG52YXIgcGxhbmV0RmFjdG9yeSAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRGYWN0b3J5Jyk7XG52YXIgcGxhbmV0Vmlld0ZhY3RvcnkgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRWaWV3Jyk7XG52YXIgc3RhckZhY3RvcnkgICAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3N0YXIvc3RhckZhY3RvcnknKTtcbnZhciBzdGFyVmlld0ZhY3RvcnkgICAgID0gcmVxdWlyZSgnLi9wYXJ0cy90aGluZ3Mvc3Rhci9zdGFyVmlldycpO1xudmFyIGFjdGlvblNlbGVjdGlvbiAgICAgPSByZXF1aXJlKCcuL3BhcnRzL3VpL2NvbXBvbmVudHMvYWN0aW9uU2VsZWN0aW9uJyk7XG52YXIgYXNzZXRzICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vYXNzZXRzJyk7XG52YXIgYmxvb21TaGFkZXJGYWN0b3J5ICA9IHJlcXVpcmUoJy4vcGFydHMvc2hhZGVycy9ibG9vbS9ibG9vbScpO1xudmFyIGJsdXJTaGFkZXJGYWN0b3J5ICAgPSByZXF1aXJlKCcuL3BhcnRzL3NoYWRlcnMvYmx1ci9ibHVyJyk7XG5cbnZhciBjYW1lcmEsIHNjZW5lLCByZW5kZXJlciwgY29tcG9zZXI7XG52YXIgZGVwdGhNYXRlcmlhbDtcbnZhciBzdGFyO1xudmFyIHdpZHRoLCBoZWlnaHQ7XG52YXIgc3RhckVmZmVjdCwgYmxvb21FZmZlY3Q7XG52YXIgcGh5c2ljc0JhY2tlZFZpZXdzID0gW107XG52YXIgaW5pdE5lYXIgPSAxMDtcbnZhciBpbml0RmFyID0gMTAwMDA7XG5cbmZ1bmN0aW9uIGxvZyhtZXNzYWdlKXtcbiAgICAkKCcjY29uc29sZScpLnRleHQobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIGluaXQoZG9tQ29udGFpbmVyKSB7XG4gICAgbG9nKFwiaW5pdFwiKTtcbiAgICByZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCk7XG4gICAgcmVuZGVyZXIuYW50aWFsaWFzID0gdHJ1ZTtcbiAgICByZW5kZXJlci5zaGFkb3dNYXBFbmFibGVkID0gdHJ1ZTtcbiAgICByZW5kZXJlci5zaGFkb3dNYXBTb2Z0ID0gdHJ1ZTtcbiAgICB3aWR0aCA9IGRvbUNvbnRhaW5lci53aWR0aCgpO1xuICAgIGhlaWdodCA9IGRvbUNvbnRhaW5lci5oZWlnaHQoKTtcblxuICAgIHJlbmRlcmVyLnNldFNpemUoIHdpZHRoLCBoZWlnaHQgKTtcbiAgICBkb21Db250YWluZXIuYXBwZW5kKCByZW5kZXJlci5kb21FbGVtZW50ICk7XG5cbiAgICBjYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDY1LCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgaW5pdE5lYXIsIGluaXRGYXIgKTtcbiAgICBjYW1lcmEucG9zaXRpb24ueSA9IDI1MDtcbiAgICBjYW1lcmEucG9zaXRpb24ueiA9IDQwMDtcblxuICAgIHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cbiAgICBsb2FkU2t5Ym94KCk7XG5cbiAgICBzdGFyID0gc3RhclZpZXdGYWN0b3J5Lm1ha2VTdGFyVmlldyhzdGFyRmFjdG9yeS5nZXRTdGFyKCkpO1xuICAgIG9yYml0LmFkZEFiaWxpdHlUb0JlT3JiaXRlZChzdGFyKTtcbiAgICBzY2VuZS5hZGQoc3Rhcik7XG5cbiAgICBhZGRQbGFuZXQobmV3IFRIUkVFLlZlY3RvcjMoMzAwLDAsMCksIHN0YXIpO1xuXG4gICAgc2NlbmUuYWRkKHN0YXIubGlnaHQpO1xuICAgIHNjZW5lLmFkZChzdGFyLmJhY2tncm91bmRQYXJ0aWNsZXMpO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHN0YXIucmFkaWFsUGFydGljbGVzRW1pdHRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHN5cyA9IHN0YXIucmFkaWFsUGFydGljbGVzRW1pdHRlcnNbaV07XG4gICAgICAgIHNjZW5lLmFkZChzeXMpO1xuICAgIH1cblxuICAgIHNldHVwUG9zdHByb2Nlc3NpbmdFZmZlY3RzKHJlbmRlcik7XG5cbiAgICBvbldpbmRvd1Jlc2l6ZShudWxsKTtcblxuICAgIHNldHVwQWN0aW9ucyhkb21Db250YWluZXIpO1xuXG4gICAgY2FtZXJhLnRyYWNrZWRPYmplY3QgPSBzdGFyO1xufVxuXG5mdW5jdGlvbiBzZXR1cFBvc3Rwcm9jZXNzaW5nRWZmZWN0cygpe1xuICAgIGNvbXBvc2VyID0gbmV3IENPTVBPU0VSKCByZW5kZXJlciApO1xuICAgIHZhciBjYW1lcmFQYXNzID0gbmV3IFRIUkVFLlJlbmRlclBhc3MoIHNjZW5lLCBjYW1lcmEgKTtcbiAgICBjb21wb3Nlci5hZGRQYXNzKGNhbWVyYVBhc3MpO1xuXG4gICAgLy93ZSB3cml0ZSBkZXB0aCB0byBhIHRleHR1cmUgc28gd2UgY2FuIHVzZSBpdCBsYXRlclxuICAgIHZhciBkZXB0aFNoYWRlciA9IFRIUkVFLlNoYWRlckxpYlsgXCJkZXB0aFJHQkFcIiBdO1xuICAgIHZhciBkZXB0aFVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5jbG9uZSggZGVwdGhTaGFkZXIudW5pZm9ybXMgKTtcblxuICAgIGRlcHRoTWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoIHsgZnJhZ21lbnRTaGFkZXI6IGRlcHRoU2hhZGVyLmZyYWdtZW50U2hhZGVyLCB2ZXJ0ZXhTaGFkZXI6IGRlcHRoU2hhZGVyLnZlcnRleFNoYWRlciwgdW5pZm9ybXM6IGRlcHRoVW5pZm9ybXMgfSApO1xuICAgIGRlcHRoTWF0ZXJpYWwuYmxlbmRpbmcgPSBUSFJFRS5Ob0JsZW5kaW5nO1xuXG4gICAgdmFyIGRlcHRoUGFyYW1zID0geyBtaW5GaWx0ZXI6IFRIUkVFLk5lYXJlc3RGaWx0ZXIsIG1hZ0ZpbHRlcjogVEhSRUUuTmVhcmVzdEZpbHRlciwgZm9ybWF0OiBUSFJFRS5SR0JBRm9ybWF0IH07XG4gICAgZGVwdGhUYXJnZXQgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJUYXJnZXQoIHdpZHRoLCBoZWlnaHQsIGRlcHRoUGFyYW1zICk7XG5cbiAgICB2YXIgYmxvb21TaGFkZXIgPSBibG9vbVNoYWRlckZhY3RvcnkuaW5zdGFuY2UoKTtcbiAgICBibG9vbUVmZmVjdCA9IG5ldyBUSFJFRS5TaGFkZXJQYXNzKCBibG9vbVNoYWRlciApO1xuICAgIGJsb29tRWZmZWN0LnVuaWZvcm1zWyd0U2l6ZSddLnZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIod2lkdGgsIGhlaWdodCk7XG5cbiAgICB2YXIgc2hhZGVyID0gYmx1clNoYWRlckZhY3RvcnkuaW5zdGFuY2UoKTtcblxuICAgIHZhciBlZmZlY3QgPSBuZXcgVEhSRUUuU2hhZGVyUGFzcyggc2hhZGVyICk7XG4gICAgZWZmZWN0LnVuaWZvcm1zWyd0RGVwdGgnXS52YWx1ZSA9IGRlcHRoVGFyZ2V0O1xuICAgIGVmZmVjdC51bmlmb3Jtc1snc2NhbGUnXS52YWx1ZSA9IDQ7XG4gICAgZWZmZWN0LnVuaWZvcm1zWyd0U2l6ZSddLnZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIod2lkdGgsIGhlaWdodCk7XG4gICAgZWZmZWN0LnVuaWZvcm1zWydjYW1lcmFOZWFyJ10udmFsdWUgPSBjYW1lcmEubmVhcjtcbiAgICBlZmZlY3QudW5pZm9ybXNbJ2NhbWVyYUZhciddLnZhbHVlID0gY2FtZXJhLmZhcjtcblxuICAgIHZhciBvcmRlciA9IFtcbiAgICAgICAgYmxvb21FZmZlY3QsXG4gICAgICAgIGVmZmVjdCxcbiAgICBdO1xuXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgb3JkZXIubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGNvbXBvc2VyLmFkZFBhc3Mob3JkZXJbaV0pO1xuICAgIH1cblxuICAgIG9yZGVyW29yZGVyLmxlbmd0aC0xXS5yZW5kZXJUb1NjcmVlbiA9IHRydWU7XG5cbiAgICBzdGFyRWZmZWN0ID0gZWZmZWN0O1xufVxuXG5cbmZ1bmN0aW9uIHNldHVwQWN0aW9ucyhkb21Db250YWluZXIpe1xuICAgIHZhciBpbnRlcnNlY3Rpb25GaW5kZXIgPSBpbnRlcnNlY3Rpb25GYWN0b3J5LmluaXQoJChyZW5kZXJlci5kb21FbGVtZW50KSwgY2FtZXJhKTtcbiAgICB2YXIgYWN0aW9ucyA9IEFjdGlvbnMuaW5pdChjYW1lcmEsIHN0YXIsIGFkZFBsYW5ldCwgaW50ZXJzZWN0aW9uRmluZGVyKTtcbiAgICBpbnRlcnNlY3Rpb25GaW5kZXIuc2V0QWN0aW9uKGFjdGlvbnNbMF0uaGFuZGxlcik7XG5cbiAgICBhY3Rpb25TZWxlY3Rpb24uZW5hYmxlKGRvbUNvbnRhaW5lciwgYWN0aW9ucyk7XG59XG5cblxuZnVuY3Rpb24gbG9hZFNreWJveCgpIHtcbiAgICB2YXIgc2t5ID0gJ2ltYWdlcy9za3kvc2t5Xyc7XG4gICAgdmFyIHVybHMgPSBbXG4gICAgICAgIHNreSsncmlnaHQxLnBuZycsXG4gICAgICAgIHNreSsnbGVmdDIucG5nJyxcbiAgICAgICAgc2t5Kyd0b3AzLnBuZycsXG4gICAgICAgIHNreSsnYm90dG9tNC5wbmcnLFxuICAgICAgICBza3krJ2Zyb250NS5wbmcnLFxuICAgICAgICBza3krJ2JhY2s2LnBuZydcbiAgICBdO1xuXG4gICAgdmFyIGN1YmVtYXAgPSBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlQ3ViZSh1cmxzKTsgLy8gbG9hZCB0ZXh0dXJlc1xuICAgIGN1YmVtYXAuZm9ybWF0ID0gVEhSRUUuUkdCRm9ybWF0O1xuXG4gICAgdmFyIHNoYWRlciA9IFRIUkVFLlNoYWRlckxpYlsnY3ViZSddOyAvLyBpbml0IGN1YmUgc2hhZGVyIGZyb20gYnVpbHQtaW4gbGliXG4gICAgc2hhZGVyLnVuaWZvcm1zWyd0Q3ViZSddLnZhbHVlID0gY3ViZW1hcDsgLy8gYXBwbHkgdGV4dHVyZXMgdG8gc2hhZGVyXG5cbiAgICAvLyBjcmVhdGUgc2hhZGVyIG1hdGVyaWFsXG4gICAgdmFyIHNreUJveE1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKCB7XG4gICAgICAgIGZyYWdtZW50U2hhZGVyOiBzaGFkZXIuZnJhZ21lbnRTaGFkZXIsXG4gICAgICAgIHZlcnRleFNoYWRlcjogc2hhZGVyLnZlcnRleFNoYWRlcixcbiAgICAgICAgdW5pZm9ybXM6IHNoYWRlci51bmlmb3JtcyxcbiAgICAgICAgZGVwdGhXcml0ZTogZmFsc2UsXG4gICAgICAgIHNpZGU6IFRIUkVFLkJhY2tTaWRlXG4gICAgfSk7XG5cbiAgICAvLyBjcmVhdGUgc2t5Ym94IG1lc2hcbiAgICB2YXIgc2t5Ym94ID0gbmV3IFRIUkVFLk1lc2goXG4gICAgICAgIG5ldyBUSFJFRS5DdWJlR2VvbWV0cnkoNjAwMDAsIDYwMDAwLCA2MDAwMCksXG4gICAgICAgIHNreUJveE1hdGVyaWFsXG4gICAgKTtcblxuICAgIHNjZW5lLmFkZChza3lib3gpO1xufVxuXG5mdW5jdGlvbiBtYWtlUGxhbmV0VmlldyhwbGFuZXQpIHtcbiAgICB2YXIgdmlldyA9IHBsYW5ldFZpZXdGYWN0b3J5Lm1ha2VQbGFuZXRWaWV3KHBsYW5ldCk7XG4gICAgcGh5c2ljc0JhY2tlZFZpZXdzLnB1c2godmlldyk7XG4gICAgc2NlbmUuYWRkKHZpZXcpO1xufVxuXG5mdW5jdGlvbiBhZGRQbGFuZXQocG9zaXRpb24sIHRoaW5nVG9PcmJpdCkge1xuICAgIHZhciBwbGFuZXQgPSBwbGFuZXRGYWN0b3J5LmdldFBsYW5ldChwb3NpdGlvbiwgdGhpbmdUb09yYml0KTtcbiAgICBtYWtlUGxhbmV0VmlldyhwbGFuZXQpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGxhbmV0Lm1vb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG1ha2VQbGFuZXRWaWV3KHBsYW5ldC5tb29uc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBwbGFuZXQ7XG59XG5cbmZ1bmN0aW9uIG9uV2luZG93UmVzaXplKCBldmVudCApIHtcblxucmVuZGVyZXIuc2V0U2l6ZSggd2lkdGgsIGhlaWdodCApO1xuXG5jYW1lcmEuYXNwZWN0ID0gd2lkdGggLyBoZWlnaHQ7XG5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuXG59XG5cbmZ1bmN0aW9uIGFuaW1hdGUoKSB7XG5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGFuaW1hdGUgKTtcbnJlbmRlcigpO1xufVxuXG5mdW5jdGlvbiByZW5kZXIoKSB7XG5cbiAgdmFyIGR0ID0gMTsvL2Nsb2NrLmdldERlbHRhKCk7XG5cbiAgc3Rhci5yZWN1cnNpdmVQaHlzaWNzVXBkYXRlKGR0KTtcbiAgZm9yICggdmFyIGkgPSAwOyBpIDwgcGh5c2ljc0JhY2tlZFZpZXdzLmxlbmd0aDsgaSsrICkge1xuICAgICAgcGh5c2ljc0JhY2tlZFZpZXdzW2ldLnVwZGF0ZSgpO1xuICB9XG5cbiAgdmFyIGNvbG9yID0gc3Rhci52aWV3VXBkYXRlKGR0LCBjYW1lcmEsIG5ldyBUSFJFRS5WZWN0b3IyKHdpZHRoLGhlaWdodCksIHN0YXJFZmZlY3QpO1xuICBzdGFyRWZmZWN0LnVuaWZvcm1zW1wic3RhckNvbG9yXCJdLnZhbHVlID0gY29sb3I7XG4gIGJsb29tRWZmZWN0LnVuaWZvcm1zW1wiYmxvb21Db2xvclwiXS52YWx1ZSA9IGNvbG9yO1xuXG4gIGlmICggY2FtZXJhLnRyYW5zaXRpb24gKSB7XG4gICAgdmFyIHQgPSBjYW1lcmEudHJhbnNpdGlvbjtcbiAgICB2YXIgbyA9IGNhbWVyYS50cmFuc2l0aW9uLm9yaWdpbmFsO1xuICAgIGNhbWVyYS5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKG8ueCwgby55LCBvLnopLmxlcnAoY2FtZXJhLnRyYW5zaXRpb24udGFyZ2V0LCB0LmVsYXBzZWQvIHQuZHVyYXRpb24pO1xuICAgIHQuZWxhcHNlZCsrO1xuICAgIGlmICggdC5lbGFwc2VkID4gdC5kdXJhdGlvbiApIHtcbiAgICAgICAgY2FtZXJhLnRyYW5zaXRpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJvdGF0ZS51cGRhdGVSb3RhdGlvbihjYW1lcmEpO1xuICB0cmFjay51cGRhdGUoY2FtZXJhKTtcbiAgem9vbS51cGRhdGVab29tKGNhbWVyYSk7XG5cbiAgY2FtZXJhLmxvb2tBdChjYW1lcmEudGFyZ2V0KTtcblxuICBzY2VuZS5vdmVycmlkZU1hdGVyaWFsID0gZGVwdGhNYXRlcmlhbDtcbiAgcmVuZGVyZXIucmVuZGVyKCBzY2VuZSwgY2FtZXJhLCBkZXB0aFRhcmdldCk7XG4gIHNjZW5lLm92ZXJyaWRlTWF0ZXJpYWwgPSBudWxsO1xuICBzdGFyRWZmZWN0LnVuaWZvcm1zW1widGltZVwiXS52YWx1ZSArPSAuMDAxO1xuXG4gIGNvbXBvc2VyLnJlbmRlcigpO1xufVxuXG5hc3NldHMuYWRkUmVhZHlIYW5kbGVyKGZ1bmN0aW9uKCl7XG4gICAgaW5pdCgkKCcjZ2FtZScpKTtcbiAgICBhbmltYXRlKCk7XG5cbn0pOyIsImV4cG9ydHMuY29uZmlnU2F0ZWxsaXRlID0gZnVuY3Rpb24odGhpbmdUb09yYml0LCBzYXRlbGxpdGVGYWN0b3J5KXtcclxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24oaW50ZXJzZWN0aW9uKXtcclxuICAgICAgICBzYXRlbGxpdGVGYWN0b3J5KGludGVyc2VjdGlvbiwgdGhpbmdUb09yYml0KTtcclxuICAgIH1cclxuICAgIHJldHVybiBoYW5kbGVyO1xyXG59O1xyXG5cclxuIiwidmFyIGludGVyc2VjdGlvbkhhbmRsZXI7XHJcbnZhciBwcm9qZWN0b3IgPSBuZXcgVEhSRUUuUHJvamVjdG9yKCk7XHJcblxyXG5mdW5jdGlvbiBzZXRBY3Rpb24oaGFuZGxlcikge1xyXG4gICAgaW50ZXJzZWN0aW9uSGFuZGxlciA9IGhhbmRsZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGluaXQoZG9tQ29udGFpbmVyLCBjYW1lcmEsIG5vcm1hbCkge1xyXG5cclxuICAgIGlmICggIW5vcm1hbCApIHtcclxuICAgICAgICBub3JtYWwgPSBuZXcgVEhSRUUuVmVjdG9yMygwLC0xLDApO1xyXG4gICAgfVxyXG4gICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgICAgIHZhciB2ZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMyhcclxuICAgICAgICAgICAgKCBldmVudC5jbGllbnRYIC8gZG9tQ29udGFpbmVyLndpZHRoKCkgKSAqIDIgLSAxLFxyXG4gICAgICAgICAgICAtICggZXZlbnQuY2xpZW50WSAvIGRvbUNvbnRhaW5lci5oZWlnaHQoKSApICogMiArIDEsXHJcbiAgICAgICAgICAgIDAuNVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgcHJvamVjdG9yLnVucHJvamVjdFZlY3RvciggdmVjdG9yLCBjYW1lcmEgKTtcclxuXHJcbiAgICAgICAgdmFyIHJheSA9IG5ldyBUSFJFRS5SYXkoIGNhbWVyYS5wb3NpdGlvbixcclxuICAgICAgICAgICAgdmVjdG9yLnN1YiggY2FtZXJhLnBvc2l0aW9uICkubm9ybWFsaXplKCkgKTtcclxuICAgICAgICB2YXIgcGxhbmUgPSBuZXcgVEhSRUUuUGxhbmUobm9ybWFsLCAwKTtcclxuXHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvbiA9IHJheS5pbnRlcnNlY3RQbGFuZShwbGFuZSk7XHJcbiAgICAgICAgaWYgKCBpbnRlcnNlY3Rpb24gKSB7XHJcbiAgICAgICAgICAgIGludGVyc2VjdGlvbkhhbmRsZXIoaW50ZXJzZWN0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZG9tQ29udGFpbmVyWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGhhbmRsZXIsIGZhbHNlICk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHNldEFjdGlvbjogc2V0QWN0aW9uLFxyXG4gICAgICAgIGRpc2FibGU6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGRvbUNvbnRhaW5lclswXS5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHJcbiAgICBpbml0OiBpbml0XHJcbn07IiwidmFyIG51bUZyYW1lcyA9IDIwO1xyXG5cclxuZXhwb3J0cy5jYW1lcmFNb3ZlbWVudEFjdGlvbiA9IGZ1bmN0aW9uKGNhbWVyYSl7XHJcbiAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uKGludGVyc2VjdGlvbil7XHJcbiAgICAgICAgdmFyIHRhcmdldCA9IG5ldyBUSFJFRS5WZWN0b3IzKGludGVyc2VjdGlvbi54LCBjYW1lcmEucG9zaXRpb24ueSwgaW50ZXJzZWN0aW9uLnopO1xyXG4gICAgICAgIGNhbWVyYS50cmFuc2l0aW9uID0ge1xyXG4gICAgICAgICAgICBvcmlnaW5hbDogY2FtZXJhLnBvc2l0aW9uLFxyXG4gICAgICAgICAgICB0YXJnZXQ6IHRhcmdldCxcclxuICAgICAgICAgICAgZHVyYXRpb246IG51bUZyYW1lcyxcclxuICAgICAgICAgICAgZWxhcHNlZDogMFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBoYW5kbGVyO1xyXG59OyIsInZhciBhZGRTYXRlbGxpdGUgICAgPSByZXF1aXJlKCcuL0FkZFNhdGVsbGl0ZScpLFxyXG4gICAgbW92ZUNhbWVyYSAgICAgID0gcmVxdWlyZSgnLi9Nb3ZlQ2FtZXJhJyksXHJcbiAgICByb3RhdGUgICAgICAgICAgPSByZXF1aXJlKCcuL2NhbWVyYS9yb3RhdGUnKSxcclxuICAgIHpvb20gICAgICAgICAgICA9IHJlcXVpcmUoJy4vY2FtZXJhL3pvb20nKSxcclxuICAgIHRyYWNrICAgICAgICAgICA9IHJlcXVpcmUoJy4vY2FtZXJhL1RyYWNrT2JqZWN0Jyk7XHJcblxyXG52YXIgY2FtZXJhQWN0aW9uO1xyXG52YXIgc2F0ZWxsaXRlQWN0aW9uO1xyXG52YXIgcm90YXRpb25BY3Rpb25zLCB6b29tQWN0aW9ucztcclxudmFyIHRyYWNrT2JqZWN0QWN0aW9ucztcclxudmFyIG9uUmVhZHlDYWxsYmFja3MgPSBbXTtcclxudmFyIGlzUmVhZHkgPSBmYWxzZTtcclxuXHJcbmZ1bmN0aW9uIGdldENhbWVyYUFjdGlvbigpIHtcclxuICAgIHJldHVybiBjYW1lcmFBY3Rpb247XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFNhdGVsbGl0ZUFjdGlvbigpIHtcclxuICAgIHJldHVybiBzYXRlbGxpdGVBY3Rpb247XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkQWN0aW9ucyhjYW1lcmEsIHN0YXIsIGFkZE1vb24sIGNsaWNrSGFuZGxlcikge1xyXG4gICAgLy9hZGQgY29udHJvbHNcclxuXHJcbiAgICBzYXRlbGxpdGVBY3Rpb24gICAgID0gYWRkU2F0ZWxsaXRlLmNvbmZpZ1NhdGVsbGl0ZShzdGFyLCBhZGRNb29uKTtcclxuICAgIGNhbWVyYUFjdGlvbiAgICAgICAgPSBtb3ZlQ2FtZXJhLmNhbWVyYU1vdmVtZW50QWN0aW9uKGNhbWVyYSk7XHJcbiAgICByb3RhdGlvbkFjdGlvbnMgICAgID0gcm90YXRlLmJ1aWxkQWN0aW9ucyhjYW1lcmEpO1xyXG4gICAgdHJhY2tPYmplY3RBY3Rpb25zICA9IHRyYWNrLmJ1aWxkQWN0aW9ucyhjYW1lcmEsIHN0YXIub3JiaXRMaXN0KTtcclxuICAgIHpvb21BY3Rpb25zICAgICAgICAgPSB6b29tLmJ1aWxkQWN0aW9ucyhjYW1lcmEpO1xyXG5cclxuICAgIHZhciBhY3Rpb25zID0gW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWQ6ICdhY3Rpb24tcGxhY2VTYXRlbGxpdGUnLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBmdW5jdGlvbigpe2NsaWNrSGFuZGxlci5zZXRBY3Rpb24oc2F0ZWxsaXRlQWN0aW9uKX0sXHJcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgyNTUsIDAsIDAsIDAuNSknLFxyXG4gICAgICAgICAgICBuYW1lOiAnUGxhY2UgU2F0ZWxsaXRlJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZDogJ2FjdGlvbi1tb3ZlQ2FtZXJhJyxcclxuICAgICAgICAgICAgaGFuZGxlcjogZnVuY3Rpb24oKXtjbGlja0hhbmRsZXIuc2V0QWN0aW9uKGNhbWVyYUFjdGlvbil9LFxyXG4gICAgICAgICAgICBjb2xvcjogJ3JnYmEoMCwgMjU1LCAwLCAwLjUpJyxcclxuICAgICAgICAgICAgbmFtZTogJ1JlcG9zaXRpb24gQ2FtZXJhJ1xyXG4gICAgICAgIH1cclxuICAgIF07XHJcblxyXG4gICAgaXNSZWFkeSA9IHRydWU7XHJcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBvblJlYWR5Q2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgb25SZWFkeUNhbGxiYWNrc1tpXSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY3Rpb25zO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGluaXQ6IGJ1aWxkQWN0aW9ucyxcclxuICAgIGdldENhbWVyYUFjdGlvbjogZ2V0Q2FtZXJhQWN0aW9uLFxyXG4gICAgZ2V0U2F0ZWxsaXRlQWN0aW9uOiBnZXRTYXRlbGxpdGVBY3Rpb24sXHJcbiAgICB0cmFja09iamVjdEFjdGlvbnM6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJhY2tPYmplY3RBY3Rpb25zIH0sXHJcbiAgICByb3RhdGlvbkFjdGlvbnM6IGZ1bmN0aW9uKCl7IHJldHVybiByb3RhdGlvbkFjdGlvbnMgfSxcclxuICAgIHpvb21BY3Rpb25zOiBmdW5jdGlvbigpeyByZXR1cm4gem9vbUFjdGlvbnMgfSxcclxuICAgIG9uUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrKXtcclxuICAgICAgICBpZiAoIGlzUmVhZHkgKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb25SZWFkeUNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJmdW5jdGlvbiBzZXRUYXJnZXQoY2FtZXJhLCB0YXJnZXQpIHtcclxuICAgIGNhbWVyYS50cmFja2VkT2JqZWN0ID0gdGFyZ2V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZEFjdGlvbnMoY2FtZXJhLCBvcmJpdExpc3QpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdHJhY2tOZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2V0VGFyZ2V0KGNhbWVyYSwgb3JiaXRMaXN0Lm5leHRJdGVtKCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHJhY2tQcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHNldFRhcmdldChjYW1lcmEsIG9yYml0TGlzdC5wcmV2aW91c0l0ZW0oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGUoY2FtKSB7XHJcbiAgICBpZiAoIGNhbS50cmFja2VkT2JqZWN0ICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW0udGFyZ2V0ID0gY2FtLnRyYWNrZWRPYmplY3QucG9zaXRpb247XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYnVpbGRBY3Rpb25zOiBidWlsZEFjdGlvbnMsXHJcbiAgICB1cGRhdGU6IHVwZGF0ZVxyXG59OyIsInZhciBpbnB1dE11bHRpcGxpZXIgPSAyO1xyXG5cclxudmFyIGxlZnQgPSAtMTtcclxudmFyIHJpZ2h0ID0gMTtcclxuXHJcbnZhciBpc1JvdGF0aW5nTGVmdCA9IGZhbHNlO1xyXG52YXIgaXNSb3RhdGluZ1JpZ2h0ID0gZmFsc2U7XHJcblxyXG5mdW5jdGlvbiBidWlsZEFjdGlvbnMoY2FtZXJhKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJvdGF0ZUxlZnQ6IGZ1bmN0aW9uKCl7IGlzUm90YXRpbmdMZWZ0ID0gdHJ1ZSB9LFxyXG4gICAgICAgIHJvdGF0ZVJpZ2h0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nUmlnaHQgPSB0cnVlIH0sXHJcbiAgICAgICAgc3RvcFJvdGF0ZVJpZ2h0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nUmlnaHQgPSBmYWxzZSB9LFxyXG4gICAgICAgIHN0b3BSb3RhdGVMZWZ0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nTGVmdCA9IGZhbHNlIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc3RvcFJvdGF0ZUFjdGlvbihkaXIsIGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEucm90YXRpb25WYWx1ZSAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAoKGRpciA+IDAgJiYgY2FtZXJhLnJvdGF0aW9uVmFsdWUgPiAwKSB8fFxyXG4gICAgICAgICAoZGlyIDwgMCAmJiBjYW1lcmEucm90YXRpb25WYWx1ZSA8IDAgKSkpIHtcclxuXHJcbiAgICAgICAgY2FtZXJhLnJvdGF0aW9uVmFsdWUgKj0gLjM1O1xyXG5cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcm90YXRlQWN0aW9uKGRpciwgY2FtZXJhKSB7XHJcbiAgICBpZiAoIGNhbWVyYS5yb3RhdGlvblZhbHVlID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEucm90YXRpb25WYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbiAgICB9XHJcbiAgICBjYW1lcmEucm90YXRpb25WYWx1ZSArPSBkaXIgKiBpbnB1dE11bHRpcGxpZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZVJvdGF0aW9uKGNhbSkge1xyXG4gICAgaWYgKCBpc1JvdGF0aW5nTGVmdCApIHtcclxuICAgICAgICByb3RhdGVBY3Rpb24obGVmdCwgY2FtKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3RvcFJvdGF0ZUFjdGlvbihsZWZ0LCBjYW0pO1xyXG4gICAgfVxyXG4gICAgaWYgKCBpc1JvdGF0aW5nUmlnaHQgKSB7XHJcbiAgICAgICAgcm90YXRlQWN0aW9uKHJpZ2h0LCBjYW0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBzdG9wUm90YXRlQWN0aW9uKHJpZ2h0LCBjYW0pO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB2MyA9IFRIUkVFLlZlY3RvcjM7XHJcbiAgICB2YXIgdXAgPSBuZXcgdjMoMCwxLDApO1xyXG4gICAgaWYgKCBjYW0ucm90YXRpb25WYWx1ZSAhPSB1bmRlZmluZWQgJiYgTWF0aC5hYnMoY2FtLnJvdGF0aW9uVmFsdWUpID4gLjUgKSB7XHJcbiAgICAgICAgdmFyIGNwID0gbmV3IHYzKCkuY29weShjYW0ucG9zaXRpb24pO1xyXG4gICAgICAgIHZhciBjZW50ZXIgPSBuZXcgdjMoKS5jb3B5KGNhbS50YXJnZXQpO1xyXG4gICAgICAgIGNlbnRlci55ID0gY3AueTtcclxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBuZXcgdjMoKS5zdWJWZWN0b3JzKGNwLCBjZW50ZXIpO1xyXG4gICAgICAgIHZhciBsZW4gPSBkaXN0YW5jZS5sZW5ndGgoKTtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uRnJvbUNlbnRlciA9IGRpc3RhbmNlLm5vcm1hbGl6ZSgpO1xyXG4gICAgICAgIHZhciBkaXJYWiA9IGRpcmVjdGlvbkZyb21DZW50ZXIuY3Jvc3ModXApO1xyXG4gICAgICAgIHZhciBkaXNwbGFjZW1lbnQgPSBkaXJYWi5tdWx0aXBseVNjYWxhcihjYW0ucm90YXRpb25WYWx1ZSk7XHJcbiAgICAgICAgdmFyIG5ld1BvcyA9IG5ldyB2MygpLmFkZFZlY3RvcnMoY3AsIGRpc3BsYWNlbWVudCk7XHJcbiAgICAgICAgdmFyIGFkanVzdGVkUG9zID0gbmV3IHYzKCkuc3ViVmVjdG9ycyhuZXdQb3MsIGNlbnRlcikuc2V0TGVuZ3RoKGxlbik7XHJcbiAgICAgICAgY2FtLnBvc2l0aW9uID0gbmV3IHYzKCkuYWRkVmVjdG9ycyhjZW50ZXIsIGFkanVzdGVkUG9zKTtcclxuXHJcbiAgICAgICAgY2FtLnJvdGF0aW9uVmFsdWUgKj0gLjk4O1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY2FtLnJvdGF0aW9uVmFsdWUgPSAwO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGJ1aWxkQWN0aW9uczogYnVpbGRBY3Rpb25zLFxyXG4gICAgdXBkYXRlUm90YXRpb246IHVwZGF0ZVJvdGF0aW9uXHJcbn07XHJcblxyXG4iLCJ2YXIgaXNab29taW5nSW4gPSBmYWxzZSxcclxuICAgIGlzWm9vbWluZ091dCA9IGZhbHNlO1xyXG5cclxudmFyIGlucHV0TXVsdGlwbGllciA9IDEuNTtcclxuXHJcbmZ1bmN0aW9uIGJ1aWxkQWN0aW9ucyhjYW1lcmEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgem9vbUluOiBmdW5jdGlvbigpeyBpc1pvb21pbmdJbiA9IHRydWUgfSxcclxuICAgICAgICB6b29tT3V0OiBmdW5jdGlvbigpeyBpc1pvb21pbmdPdXQgPSB0cnVlIH0sXHJcbiAgICAgICAgc3RvcFpvb21JbjogZnVuY3Rpb24oKXsgaXNab29taW5nSW4gPSBmYWxzZSB9LFxyXG4gICAgICAgIHN0b3Bab29tT3V0OiBmdW5jdGlvbigpeyBpc1pvb21pbmdPdXQgPSBmYWxzZSB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0b3Bab29tKGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEuem9vbVZhbHVlICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEuem9vbVZhbHVlICo9IC4zNTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gem9vbUFjdGlvbihkaXIsIGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEuem9vbVZhbHVlID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEuem9vbVZhbHVlID0gMDtcclxuICAgIH1cclxuICAgIGNhbWVyYS56b29tVmFsdWUgKz0gZGlyICogaW5wdXRNdWx0aXBsaWVyO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gdXBkYXRlWm9vbVZhbHVlKGNhbSkge1xyXG4gICAgaWYgKCBpc1pvb21pbmdJbiAmJiAhaXNab29taW5nT3V0ICkge1xyXG4gICAgICAgIHpvb21BY3Rpb24oMSwgY2FtKTtcclxuICAgIH0gZWxzZSBpZiAoIGlzWm9vbWluZ091dCAmJiAhaXNab29taW5nSW4gKSB7XHJcbiAgICAgICAgem9vbUFjdGlvbigtMSwgY2FtKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3RvcFpvb20oY2FtKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2hhbmdlQ2FtUG9zaXRpb24oY2FtKSB7XHJcbiAgICB2YXIgdjMgPSBUSFJFRS5WZWN0b3IzO1xyXG4gICAgdmFyIHVwID0gbmV3IHYzKDAsMSwwKTtcclxuICAgIGlmICggY2FtLnpvb21WYWx1ZSAhPSB1bmRlZmluZWQgJiYgTWF0aC5hYnMoY2FtLnpvb21WYWx1ZSkgPiAuNSApIHtcclxuICAgICAgICB2YXIgY3AgPSBuZXcgdjMoKS5jb3B5KGNhbS5wb3NpdGlvbik7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IG5ldyB2MygpLmNvcHkoY2FtLnRhcmdldCkuc3ViKGNwKS5ub3JtYWxpemUoKS5tdWx0aXBseVNjYWxhcihjYW0uem9vbVZhbHVlKTtcclxuICAgICAgICB2YXIgYWRqdXN0ZWRQb3MgPSBuZXcgdjMoKS5hZGRWZWN0b3JzKG9mZnNldCwgY2FtLnBvc2l0aW9uKTtcclxuICAgICAgICBjYW0ucG9zaXRpb24gPSBhZGp1c3RlZFBvcztcclxuICAgICAgICBjYW0uem9vbVZhbHVlICo9IC45ODtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGNhbS56b29tVmFsdWUgPSAwO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVab29tKGNhbSkge1xyXG4gICAgdXBkYXRlWm9vbVZhbHVlKGNhbSk7XHJcbiAgICBjaGFuZ2VDYW1Qb3NpdGlvbihjYW0pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGJ1aWxkQWN0aW9uczogYnVpbGRBY3Rpb25zLFxyXG4gICAgdXBkYXRlWm9vbTogdXBkYXRlWm9vbVxyXG59O1xyXG4iLCJ2YXIgYWN0aW9ucyA9IHJlcXVpcmUoJy4vYWN0aW9ucycpO1xyXG5cclxuYWN0aW9ucy5vblJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgdmFyIGxpc3RlbmVyID0gbmV3IHdpbmRvdy5rZXlwcmVzcy5MaXN0ZW5lcigpO1xyXG4gICAgdmFyIHJhID0gYWN0aW9ucy5yb3RhdGlvbkFjdGlvbnMoKTtcclxuICAgIGxpc3RlbmVyLnJlZ2lzdGVyX2NvbWJvKHtcclxuICAgICAgICBrZXlzOiBcImxlZnRcIixcclxuICAgICAgICBvbl9rZXlkb3duOiByYS5yb3RhdGVMZWZ0LFxyXG4gICAgICAgIG9uX2tleXVwOiByYS5zdG9wUm90YXRlTGVmdFxyXG4gICAgfSk7XHJcblxyXG4gICAgbGlzdGVuZXIucmVnaXN0ZXJfY29tYm8oe1xyXG4gICAgICAgIGtleXM6IFwicmlnaHRcIixcclxuICAgICAgICBvbl9rZXlkb3duOiByYS5yb3RhdGVSaWdodCxcclxuICAgICAgICBvbl9rZXl1cDogcmEuc3RvcFJvdGF0ZVJpZ2h0XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgdHJhY2tBY3Rpb25zID0gYWN0aW9ucy50cmFja09iamVjdEFjdGlvbnMoKTtcclxuICAgIGxpc3RlbmVyLnJlZ2lzdGVyX2NvbWJvKHtcclxuICAgICAgICBrZXlzOiBcInRhYlwiLFxyXG4gICAgICAgIG9uX2tleXVwOiB0cmFja0FjdGlvbnMudHJhY2tOZXh0LFxyXG4gICAgICAgIGlzX3NvbGl0YXJ5OiB0cnVlLFxyXG4gICAgICAgIHByZXZlbnRfZGVmYXVsdDogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBsaXN0ZW5lci5yZWdpc3Rlcl9jb21ibyh7XHJcbiAgICAgICAga2V5czogXCJzaGlmdCB0YWJcIixcclxuICAgICAgICBvbl9rZXl1cDogdHJhY2tBY3Rpb25zLnRyYWNrUHJldmlvdXMsXHJcbiAgICAgICAgcHJldmVudF9kZWZhdWx0OiB0cnVlXHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgem9vbUFjdGlvbnMgPSBhY3Rpb25zLnpvb21BY3Rpb25zKCk7XHJcbiAgICBsaXN0ZW5lci5yZWdpc3Rlcl9jb21ibyh7XHJcbiAgICAgICAga2V5czogXCJ1cFwiLFxyXG4gICAgICAgIG9uX2tleWRvd246IHpvb21BY3Rpb25zLnpvb21JbixcclxuICAgICAgICBvbl9rZXl1cDogem9vbUFjdGlvbnMuc3RvcFpvb21JblxyXG4gICAgfSk7XHJcblxyXG4gICAgbGlzdGVuZXIucmVnaXN0ZXJfY29tYm8oe1xyXG4gICAgICAgIGtleXM6IFwiZG93blwiLFxyXG4gICAgICAgIG9uX2tleWRvd246IHpvb21BY3Rpb25zLnpvb21PdXQsXHJcbiAgICAgICAgb25fa2V5dXA6IHpvb21BY3Rpb25zLnN0b3Bab29tT3V0XHJcbiAgICB9KTtcclxuXHJcbn0pOyIsInZhciBWMyA9IFRIUkVFLlZlY3RvcjM7XHJcbnZhciBPcmJpdExpc3QgPSByZXF1aXJlKCcuLi90aGluZ3Mvb3JiaXRMaXN0Jyk7XHJcbnZhciBwaHlzaWNzID0gcmVxdWlyZSgnLi4vcGh5c2ljcy9waHlzaWNzJyk7XHJcblxyXG4vL3NldCB0aGUgb2JqZWN0IGludG8gaW1tZWRpYXRlIGNpcmN1bGFyIG9yYml0XHJcbi8vc2hvdWxkIGJlIHVzZWZ1bCBmb3IgaW5pdGlhbCBzZXR1cCBvZiBtb29ucyBhbmQgcGxhbmV0c1xyXG4vL3YgPSBzcXJ0KEcobTErbTIpL3IpXHJcbmZ1bmN0aW9uIG9yYml0SW1tZWRpYXRlbHkoc2VsZiwgb3RoZXIsIHBsYW5lTm9ybWFsKSB7XHJcbiAgICBpZiAoIHBsYW5lTm9ybWFsID09IG51bGwgKSB7XHJcbiAgICAgICAgcGxhbmVOb3JtYWwgPSBuZXcgVjMoMCwxLDApO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB0ZW1wQSA9IHt9O1xyXG4gICAgdGVtcEEucG9zaXRpb24gPSBuZXcgVjMoKS5jb3B5KHNlbGYucG9zaXRpb24pO1xyXG4gICAgcGh5c2ljcy5hZGRQaHlzaWNzUHJvcGVydGllcyh0ZW1wQSk7XHJcbiAgICB0ZW1wQS5zZXRNYXNzKHNlbGYubWFzcygpKTtcclxuXHJcbiAgICB2YXIgdGVtcEIgPSB7fTtcclxuICAgIHRlbXBCLnBvc2l0aW9uID0gbmV3IFYzKCkuY29weShvdGhlci5wb3NpdGlvbik7XHJcbiAgICBwaHlzaWNzLmFkZFBoeXNpY3NQcm9wZXJ0aWVzKHRlbXBCKTtcclxuICAgIHRlbXBCLnNldE1hc3Mob3RoZXIubWFzcygpKTtcclxuXHJcbiAgICBwaHlzaWNzLmFwcGx5R3Jhdml0eSh0ZW1wQiwgdGVtcEEsIHRydWUpO1xyXG4gICAgdGVtcEEudmVybGV0KHRlbXBBLCAxKTtcclxuXHJcbiAgICB2YXIgZGlzcGxhY2VtZW50ID0gbmV3IFYzKCk7XHJcbiAgICBkaXNwbGFjZW1lbnQuc3ViVmVjdG9ycyhzZWxmLnBvc2l0aW9uLCBvdGhlci5wb3NpdGlvbik7XHJcblxyXG4gICAgdmFyIHJTcSA9IGRpc3BsYWNlbWVudC5sZW5ndGhTcSgpO1xyXG4gICAgdmFyIG4gPSB0ZW1wQS5uO1xyXG4gICAgLy9ob3cgbXVjaCBtdXN0IHdlIGJlIG1vdmluZyBpbiBvcmRlciBmb3IgdXMgdG8gY292ZXIgdGhpcyBjaGFuZ2VcclxuXHJcbiAgICB2YXIgZGlyZWN0aW9uID0gZGlzcGxhY2VtZW50LmNyb3NzKHBsYW5lTm9ybWFsKS5ub3JtYWxpemUoKTtcclxuXHJcbiAgICAvL3RoZSBuZXh0IHBvc2l0aW9uIHdpbGwgbmVlZCB0byBiZSBqdXN0IGFzIGZhciBhd2F5IGFzIHRoZSBjdXJyZW50IGRpc3RhbmNlO1xyXG4gICAgLy9uZXh0IHBvc2l0aW9uXHJcbiAgICB2YXIgcCA9IHNlbGYucG9zaXRpb247XHJcbiAgICB2YXIgbmV4dFBvc2l0aW9uID0gdGVtcEEueFtuICsgMV07XHJcbiAgICB2YXIgbWlkUG9pbnQgPSBuZXh0UG9zaXRpb24ubGVycCh0ZW1wQS5wb3NpdGlvbiwgLjUpO1xyXG4gICAgdmFyIHNob3J0UiA9IG1pZFBvaW50LmRpc3RhbmNlVG8ob3RoZXIucG9zaXRpb24pO1xyXG5cclxuICAgIC8veCAqIHggKyBzaG9ydFIgKiBzaG9ydFIgPSByICogclxyXG4gICAgdmFyIGNTcXVhcmVkTWludXNBU3F1YXJlZCA9IChyU3EpLShzaG9ydFIgKiBzaG9ydFIpO1xyXG4gICAgdmFyIG1hZyA9IE1hdGguc3FydChjU3F1YXJlZE1pbnVzQVNxdWFyZWQpO1xyXG5cclxuICAgIHZhciBwcmV2aW91c1Bvc2l0aW9uID0gbWlkUG9pbnQuYWRkKGRpcmVjdGlvbi5tdWx0aXBseVNjYWxhcihtYWcpKTtcclxuXHJcbiAgICBpZiAoIG90aGVyLm9yYml0VGFyZ2V0ICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICB2YXIgZGlzID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KG90aGVyLnhbb3RoZXIubi0xXSkuc3ViKG90aGVyLnhbb3RoZXIubl0pO1xyXG4gICAgICAgIHByZXZpb3VzUG9zaXRpb24uYWRkKGRpcyk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi54W24tMV0gPSBwcmV2aW91c1Bvc2l0aW9uO1xyXG5cclxuICAgIHNlbGYub3JiaXRUYXJnZXQgPSBvdGhlcjtcclxuXHJcbiAgICBpZiAoIHNlbGYub3JiaXRMaXN0ICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICB2YXIgZGlzID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KHNlbGYueFtzZWxmLm4tMV0pLnN1YihzZWxmLnhbc2VsZi5uXSk7XHJcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZi5vcmJpdExpc3QubGVuZ3RoKCk7IGkrKyApIHtcclxuICAgICAgICAgICAgdmFyIGl0ZW0gPSBzZWxmLm9yYml0TGlzdC5nZXRJdGVtKGkpO1xyXG4gICAgICAgICAgICBpdGVtLnhbbi0xXS5hZGQoZGlzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBWMygpLmNvcHkoc2VsZi54W25dKS5zdWIocHJldmlvdXNQb3NpdGlvbik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRyeVRvT3JiaXQoKSB7XHJcblxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkQWJpbGl0eVRvQmVPcmJpdGVkKHBoeXNpY3NPYmplY3QpIHtcclxuICAgIGlmICggcGh5c2ljc09iamVjdC5vcmJpdExpc3QgPT0gdW5kZWZpbmVkICkge1xyXG4gICAgICAgIHBoeXNpY3NPYmplY3Qub3JiaXRMaXN0ID0gT3JiaXRMaXN0LmluaXRMaXN0KHBoeXNpY3NPYmplY3QpO1xyXG4gICAgfVxyXG4gICAgcGh5c2ljc09iamVjdC5yZWN1cnNpdmVQaHlzaWNzVXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcclxuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBwaHlzaWNzT2JqZWN0Lm9yYml0TGlzdC5sZW5ndGgoKTsgaSsrICkge1xyXG4gICAgICAgICAgICB2YXIgaXRlbSA9IHBoeXNpY3NPYmplY3Qub3JiaXRMaXN0LmdldEl0ZW0oaSk7XHJcbiAgICAgICAgICAgIHBoeXNpY3MuYXBwbHlHcmF2aXR5KHBoeXNpY3NPYmplY3QsIGl0ZW0sIHRydWUpO1xyXG4gICAgICAgICAgICBpdGVtLnJlY3Vyc2l2ZVBoeXNpY3NVcGRhdGUoZHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwaHlzaWNzT2JqZWN0LnBoeXNpY3NVcGRhdGUoZHQpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRBYmlsaXR5VG9PcmJpdChwaHlzaWNzT2JqZWN0KSB7XHJcbiAgICBwaHlzaWNzT2JqZWN0Lm9yYml0ID0gZnVuY3Rpb24ob3RoZXIsIHBsYW5lTm9ybWFsKXtcclxuICAgICAgICBvcmJpdEltbWVkaWF0ZWx5KHBoeXNpY3NPYmplY3QsIG90aGVyLCBwbGFuZU5vcm1hbCk7XHJcbiAgICAgICAgaWYgKCBvdGhlci5vcmJpdExpc3QgIT0gdW5kZWZpbmVkICkge1xyXG4gICAgICAgICAgICBvdGhlci5vcmJpdExpc3QuYWRkSXRlbShwaHlzaWNzT2JqZWN0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoIHBoeXNpY3NPYmplY3QucmVjdXJzaXZlUGh5c2ljc1VwZGF0ZSA9PSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAgcGh5c2ljc09iamVjdC5yZWN1cnNpdmVQaHlzaWNzVXBkYXRlID0gcGh5c2ljc09iamVjdC5waHlzaWNzVXBkYXRlO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBtYWtlT3JiaXRhbDogZnVuY3Rpb24obyl7YWRkQWJpbGl0eVRvT3JiaXQobyk7IGFkZEFiaWxpdHlUb0JlT3JiaXRlZChvKTsgfSxcclxuICAgIGFkZEFiaWxpdHlUb09yYml0OiBhZGRBYmlsaXR5VG9PcmJpdCxcclxuICAgIGFkZEFiaWxpdHlUb0JlT3JiaXRlZDogYWRkQWJpbGl0eVRvQmVPcmJpdGVkXHJcbn07IiwidmFyIEcgPSAuMDAwMDA1O1xyXG52YXIgQyA9IDE7IC8vdGhlIHNwZWVkIGF0IHdoaWNoIGluZm9ybWF0aW9uIHRyYXZlbHNcclxudmFyIE9uZVNpeHRoID0gMS82O1xyXG5cclxuZnVuY3Rpb24gYWRkUGh5c2ljc1Byb3BlcnRpZXMob2JqZWN0LCBrZWVwSGlzdG9yeSkge1xyXG4gICAgaWYgKCBrZWVwSGlzdG9yeSA9PSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAga2VlcEhpc3RvcnkgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKCAhb2JqZWN0LnBvc2l0aW9uICkge1xyXG4gICAgICAgIG9iamVjdC5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgb2JqZWN0Lmludk1hc3M7XHJcbiAgICBvYmplY3Quc2V0TWFzcyA9IGZ1bmN0aW9uKHZhbHVlKXtcclxuICAgICAgICBvYmplY3QuaW52TWFzcyA9IDEvdmFsdWU7XHJcbiAgICB9XHJcbiAgICBvYmplY3Quc2V0TWFzcygxKTtcclxuXHJcbiAgICBvYmplY3QubWFzcyA9IGZ1bmN0aW9uKCl7cmV0dXJuIDEvb2JqZWN0Lmludk1hc3M7IH1cclxuXHJcbiAgICBvYmplY3QubiA9IDE7XHJcbiAgICBvYmplY3QueCA9IFtvYmplY3QucG9zaXRpb24sIG9iamVjdC5wb3NpdGlvbl07ICAgICAgLy9hcnJheSBvZiBwb3NpdGlvbnNcclxuICAgIG9iamVjdC52ID0gW25ldyBUSFJFRS5WZWN0b3IzKCksIG5ldyBUSFJFRS5WZWN0b3IzKCldOyAgICAgIC8vYXJyYXkgb2YgdmVsb2NpdGllc1xyXG4gICAgb2JqZWN0LmEgPSBbbmV3IFRIUkVFLlZlY3RvcjMoKSwgbmV3IFRIUkVFLlZlY3RvcjMoKV07ICAvL2FycmF5IG9mIGFjY2VsZXJhdGlvbnNcclxuICAgIG9iamVjdC5kdCA9IFsxLCAxXTtcclxuXHJcbiAgICBvYmplY3QuaXNLZWVwaW5nSGlzdG9yeSA9IGtlZXBIaXN0b3J5O1xyXG5cclxuICAgIG9iamVjdC52ZXJsZXQgPSAgdmVybGV0O1xyXG5cclxuICAgIG9iamVjdC52ZWxvY2l0eSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG9iamVjdC52W29iamVjdC5uXTtcclxuICAgIH07XHJcblxyXG4gICAgb2JqZWN0LnByZXZpb3VzUG9zaXRpb24gPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiBvYmplY3QueFtvYmplY3Qubi0xXTtcclxuICAgIH1cclxuXHJcbiAgICBvYmplY3QuYWNjZWxlcmF0aW9uID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4gb2JqZWN0LmFbb2JqZWN0Lm5dO1xyXG4gICAgfTtcclxuXHJcbiAgICBvYmplY3QucGh5c2ljc1VwZGF0ZSA9IGZ1bmN0aW9uKGR0KXtcclxuICAgICAgICBpZiAoIGR0ID4gMCApIHtcclxuXHJcbiAgICAgICAgICAgIHZlcmxldChvYmplY3QsIGR0KTtcclxuXHJcbiAgICAgICAgICAgIGlmICggb2JqZWN0LmlzS2VlcGluZ0hpc3RvcnkgKSB7XHJcbiAgICAgICAgICAgICAgICBvYmplY3QubisrO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdmFyIG4gPSBvYmplY3QubjtcclxuICAgICAgICAgICAgICAgIG9iamVjdC54W24tMV0gPSBvYmplY3QueFtuXTtcclxuICAgICAgICAgICAgICAgIG9iamVjdC5hW24tMV0gPSBvYmplY3QuYVtuXTtcclxuICAgICAgICAgICAgICAgIG9iamVjdC54W25dID0gb2JqZWN0LnhbbisxXTtcclxuICAgICAgICAgICAgICAgIG9iamVjdC5hW25dID0gb2JqZWN0LmFbbisxXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvYmplY3QucG9zaXRpb24gPSBvYmplY3QueFtvYmplY3Qubl07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gYWRkQW1vdW50KHNvbGFyT2JqZWN0LCBhY2NlbCkge1xyXG4gICAgc29sYXJPYmplY3QuYWNjZWxlcmF0aW9uKCkuYWRkKGFjY2VsKTtcclxuICAgIGlmICggc29sYXJPYmplY3Qub3JiaXRMaXN0ICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICB2YXIgb2wgPSBzb2xhck9iamVjdC5vcmJpdExpc3Q7XHJcbiAgICAgICAgdmFyIGxlbiA9IG9sLmxlbmd0aCgpO1xyXG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIGFkZEFtb3VudChvbC5nZXRJdGVtKGkpLCBhY2NlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBhcHBseUdyYXZpdHkob2JqZWN0QSwgb2JqZWN0QiwgbG9ja0EsIGxvY2tCKSB7XHJcbiAgICAvL2YgPSBHKE0xICsgTTIpL3JzcXJcclxuICAgIHZhciBhID0gY29weShvYmplY3RBLnBvc2l0aW9uKTtcclxuICAgIHZhciBiID0gY29weShvYmplY3RCLnBvc2l0aW9uKTtcclxuICAgIHZhciBkaXMgPSBuZXcgVEhSRUUuVmVjdG9yMyhhLnggLSBiLngsIGEueSAtIGIueSwgYS56IC0gYi56KTtcclxuXHJcbiAgICB2YXIgcnNxciA9IGNvcHkob2JqZWN0QS5wb3NpdGlvbikuZGlzdGFuY2VUb1NxdWFyZWQoY29weShvYmplY3RCLnBvc2l0aW9uKSk7XHJcbiAgICB2YXIgZiA9IEcgKiAob2JqZWN0QS5tYXNzKCkgKyBvYmplY3RCLm1hc3MoKSkvcnNxcjtcclxuXHJcbiAgICB2YXIgYlRvQSA9IGNvcHkoZGlzKS5tdWx0aXBseVNjYWxhcihHICogb2JqZWN0QS5tYXNzKCkvcnNxcik7XHJcbiAgICB2YXIgYVRvQiA9IGNvcHkoZGlzKS5tdWx0aXBseVNjYWxhcigtRyAqIG9iamVjdEIubWFzcygpL3JzcXIpO1xyXG5cclxuICAgIGlmICggIWxvY2tCICkge1xyXG4gICAgICAgIGFkZEFtb3VudChvYmplY3RCLCBiVG9BKTtcclxuICAgIH1cclxuICAgIGlmICggIWxvY2tBICkge1xyXG4gICAgICAgIGFkZEFtb3VudChvYmplY3RBLCBhVG9CLm5lZ2F0ZSgpKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY29weSh2KSB7XHJcbiAgICByZXR1cm4gbmV3IFRIUkVFLlZlY3RvcjModi54LCB2LnksIHYueik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHZlcmxldChvLCBkdCkge1xyXG4gICAgdmFyIGEgPSBvLmE7XHJcbiAgICB2YXIgeCA9IG8ueDtcclxuICAgIHZhciBuID0gby5uO1xyXG4gICAgYVtuKzFdID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuICAgIG8uZHRbbl0gPSBkdDtcclxuXHJcbiAgICB2YXIgbGFzdFggPSBjb3B5KHhbbiAtIDFdKTtcclxuICAgIHZhciBjeCA9IGNvcHkoeFtuXSk7XHJcbiAgICB2YXIgYWNjZWwgPSBjb3B5KGFbbl0pO1xyXG4gICAgdmFyIGxhc3REdCA9IG8uZHRbbi0xXTtcclxuICAgIHhbbisxXSA9IGN4LmFkZChcclxuICAgICAgICBjb3B5KGN4KS5zdWIobGFzdFgpLm11bHRpcGx5U2NhbGFyKGR0L2xhc3REdClcclxuICAgICkuYWRkKFxyXG4gICAgICAgIGFjY2VsLm11bHRpcGx5U2NhbGFyKGR0ICogKGxhc3REdCArIGxhc3REdCkvMilcclxuICAgICk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgRzogRyxcclxuICAgIGFkZFBoeXNpY3NQcm9wZXJ0aWVzOiBhZGRQaHlzaWNzUHJvcGVydGllcyxcclxuICAgIGFwcGx5R3Jhdml0eTogYXBwbHlHcmF2aXR5XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oYXNzZXRzKXtcclxuICAgIHZhciB2ZXJ0ZXg7XHJcbiAgICB2YXIgZnJhZ21lbnQ7XHJcblxyXG4gICAgdmFyIGtlcm5lbCA9IFtdO1xyXG5cclxuICAgIHZhciBzcGFuID0gMjtcclxuXHJcbiAgICBmb3IgKCB2YXIgaSA9IC1zcGFuOyBpIDwgc3BhbjsgaSsrICkge1xyXG4gICAgICAgIGZvciAoIHZhciBqID0gLXNwYW47IGogPCBzcGFuOyBqKyspIHtcclxuICAgICAgICAgICAgdmFyIG1heCA9IC4wNTtcclxuICAgICAgICAgICAgdmFyIGxlbiA9IG1heCpuZXcgVEhSRUUuVmVjdG9yMihpLGopLmxlbmd0aFNxKCkvKDIgKiBzcGFuICogc3Bhbik7XHJcbiAgICAgICAgICAgIGtlcm5lbC5wdXNoKG5ldyBUSFJFRS5WZWN0b3IzKGksaixsZW4pKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXNzZXRzLmdldFNoYWRlcigncGFydHMvc2hhZGVycy9wb3N0UHJvY2Vzc2luZy52cycsIGZ1bmN0aW9uKGRhdGEpe1xyXG4gICAgICAgIHZlcnRleCA9IGRhdGE7XHJcbiAgICB9KTtcclxuICAgIGFzc2V0cy5nZXRTaGFkZXIoJ3BhcnRzL3NoYWRlcnMvYmxvb20vYmxvb20uZnMnLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICBmcmFnbWVudCA9IFwiI2RlZmluZSBLRVJORUxfU0laRV9JTlQgXCIgKyBrZXJuZWwubGVuZ3RoICsgXCJcXG5cIiArIGRhdGE7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmdW5jdGlvbiBpbnN0YW5jZSgpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB1bmlmb3Jtczoge1xyXG4gICAgICAgICAgICAgICAgXCJ0RGlmZnVzZVwiOiAgICAgeyB0eXBlOiBcInRcIiwgICAgdmFsdWU6IG51bGwgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXCJ0cmlnZ2VyQ29sb3JcIjogeyB0eXBlOiBcInYzXCIsICAgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IzKDEsMSwxKSB9LFxyXG4gICAgICAgICAgICAgICAgXCJibG9vbUNvbG9yXCI6ICAgeyB0eXBlOiBcInYzXCIsICAgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IzKDEsMSwxKSB9LFxyXG4gICAgICAgICAgICAgICAgXCJrZXJuZWxcIjogICAgICAgeyB0eXBlOiBcInYzdlwiLCAgdmFsdWU6IGtlcm5lbCAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXCJ0U2l6ZVwiOiAgICAgICAgeyB0eXBlOiBcInYyXCIsICAgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IyKDEwMCwxMDApfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2ZXJ0ZXhTaGFkZXI6IHZlcnRleCxcclxuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXI6IGZyYWdtZW50XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGluc3RhbmNlOiBpbnN0YW5jZVxyXG4gICAgfVxyXG5cclxufSkocmVxdWlyZSgnLi4vLi4vLi4vYXNzZXRzJykpOyIsIlxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbihhc3NldHMpe1xyXG5cclxuICAgIHZhciB2ZXJ0ZXg7XHJcbiAgICB2YXIgZnJhZ21lbnQ7XHJcbiAgICBhc3NldHMuZ2V0U2hhZGVyKCdwYXJ0cy9zaGFkZXJzL3Bvc3RQcm9jZXNzaW5nLnZzJywgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICAgdmVydGV4ID0gZGF0YTtcclxuICAgIH0pO1xyXG4gICAgYXNzZXRzLmdldFNoYWRlcigncGFydHMvc2hhZGVycy9ibHVyL2JsdXIuZnMnLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgIGZyYWdtZW50ID0gZGF0YTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZ1bmN0aW9uIGluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHVuaWZvcm1zOiB7XHJcblxyXG4gICAgICAgICAgICAgICAgXCJ0RGlmZnVzZVwiOiAgICAgICB7IHR5cGU6IFwidFwiLCAgdmFsdWU6IG51bGwgfSxcclxuICAgICAgICAgICAgICAgIFwidFNpemVcIjogICAgICAgICAgeyB0eXBlOiBcInYyXCIsIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMiggMjU2LCAyNTYgKSB9LFxyXG4gICAgICAgICAgICAgICAgXCJjZW50ZXJcIjogICAgICAgICB7IHR5cGU6IFwidjJcIiwgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IyKCAwLjUsIDAuNSApIH0sXHJcbiAgICAgICAgICAgICAgICBcImFuZ2xlXCI6ICAgICAgICAgIHsgdHlwZTogXCJmXCIsICB2YWx1ZTogMS41NyB9LFxyXG4gICAgICAgICAgICAgICAgXCJzY2FsZVwiOiAgICAgICAgICB7IHR5cGU6IFwiZlwiLCAgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgICAgICAgICAgXCJzdGFyQ29sb3JcIjogICAgICB7IHR5cGU6IFwidjNcIiwgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IzKDEsMSwxKX0sXHJcbiAgICAgICAgICAgICAgICBcInREZXB0aFwiOiAgICAgICAgIHsgdHlwZTogXCJ0XCIsICB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgICAgICAgICAgXCJ0aW1lXCI6ICAgICAgICAgICB7IHR5cGU6IFwiZlwiLCAgdmFsdWU6IDAgfSxcclxuICAgICAgICAgICAgICAgIFwiY2FtZXJhTmVhclwiOiAgICAgeyB0eXBlOiBcImZcIiwgIHZhbHVlOiA1IH0sXHJcbiAgICAgICAgICAgICAgICBcImNhbWVyYUZhclwiOiAgICAgIHsgdHlwZTogXCJmXCIsICB2YWx1ZTogMTAwIH0sXHJcbiAgICAgICAgICAgICAgICBcIm1heERpc3RhbmNlXCI6ICAgIHsgdHlwZTogXCJmXCIsICB2YWx1ZTogMTAwMDAgfSxcclxuICAgICAgICAgICAgICAgIFwiZGlzdGFuY2VUb1N0YXJcIjogeyB0eXBlOiBcImZcIiwgIHZhbHVlOiAwIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmVydGV4U2hhZGVyOiB2ZXJ0ZXgsXHJcbiAgICAgICAgICAgIGZyYWdtZW50U2hhZGVyOiBmcmFnbWVudCxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGluc3RhbmNlOiBpbnN0YW5jZVxyXG4gICAgfVxyXG59KShyZXF1aXJlKCcuLi8uLi8uLi9hc3NldHMnKSk7XHJcbiIsImZ1bmN0aW9uIG5leHRJdGVtKGxpc3QpIHtcclxuICAgIHZhciBpID0gbGlzdC5kaXN0YW5jZUluZGV4LmluZGV4T2YobGlzdC5jdXJyZW50RW50cnkpO1xyXG4gICAgaWYgKCBpIDwgbGlzdC5kaXN0YW5jZUluZGV4Lmxlbmd0aCAtIDEpIHtcclxuICAgICAgICBsaXN0LmN1cnJlbnRFbnRyeSA9IGxpc3QuZGlzdGFuY2VJbmRleFtpKzFdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGxpc3QuY3VycmVudEVudHJ5Lml0ZW07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXZpb3VzSXRlbShsaXN0KSB7XHJcbiAgICB2YXIgaSA9IGxpc3QuZGlzdGFuY2VJbmRleC5pbmRleE9mKGxpc3QuY3VycmVudEVudHJ5KTtcclxuICAgIGlmICggaSA+IDAgKSB7XHJcbiAgICAgICAgbGlzdC5jdXJyZW50RW50cnkgPSBsaXN0LmRpc3RhbmNlSW5kZXhbaS0xXTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaXN0LmN1cnJlbnRFbnRyeS5pdGVtO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkaXN0YW5jZVNvcnQoYSxiKSB7XHJcbiAgICByZXR1cm4gYS5kaXN0YW5jZSAtIGIuZGlzdGFuY2U7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxlbmd0aChpdGVtcykge1xyXG4gICAgcmV0dXJuIGl0ZW1zLmxlbmd0aDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SXRlbShpdGVtcywgaSkge1xyXG4gICAgcmV0dXJuIGl0ZW1zW2ldO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRJdGVtKGxpc3QsIG5ld0l0ZW0sIGl0ZW1zKSB7XHJcbiAgICB2YXIgZGlzdGFuY2UgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkobGlzdC5jZW50ZXJJdGVtLnBvc2l0aW9uKS5zdWIobmV3SXRlbS5wb3NpdGlvbikubGVuZ3RoU3EoKTtcclxuICAgIGlmICggbmV3SXRlbSAhPSBsaXN0LmNlbnRlckl0ZW0gKSB7XHJcbiAgICAgICAgaXRlbXMucHVzaChuZXdJdGVtKTtcclxuICAgIH1cclxuICAgIHZhciBlbnRyeSAgPSB7XHJcbiAgICAgICAgaXRlbTogbmV3SXRlbSxcclxuICAgICAgICBkaXN0YW5jZTogZGlzdGFuY2VcclxuICAgIH1cclxuXHJcbiAgICBsaXN0LmRpc3RhbmNlSW5kZXgucHVzaChlbnRyeSk7XHJcbiAgICBsaXN0LmRpc3RhbmNlSW5kZXguc29ydChkaXN0YW5jZVNvcnQpXHJcblxyXG4gICAgcmV0dXJuIGVudHJ5O1xyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0TGlzdChpdGVtKXtcclxuICAgIHZhciBpdGVtcyA9IFtdO1xyXG4gICAgdmFyIGxpc3QgPSB7XHJcbiAgICAgICAgY2VudGVySXRlbTogaXRlbSxcclxuICAgICAgICBkaXN0YW5jZUluZGV4OiBbXSxcclxuICAgICAgICBhZGRJdGVtOiBmdW5jdGlvbihuZXdJdGVtKXsgcmV0dXJuIGFkZEl0ZW0obGlzdCwgbmV3SXRlbSwgaXRlbXMpIH0sXHJcbiAgICAgICAgbmV4dEl0ZW06IGZ1bmN0aW9uKCkge3JldHVybiBuZXh0SXRlbShsaXN0KTsgfSxcclxuICAgICAgICBwcmV2aW91c0l0ZW06IGZ1bmN0aW9uKCkge3JldHVybiBwcmV2aW91c0l0ZW0obGlzdCk7IH0sXHJcbiAgICAgICAgY3VycmVudEVudHJ5OiBudWxsLFxyXG4gICAgICAgIGxlbmd0aDogZnVuY3Rpb24oKXtyZXR1cm4gbGVuZ3RoKGl0ZW1zKTt9LFxyXG4gICAgICAgIGdldEl0ZW06IGZ1bmN0aW9uKGkpe3JldHVybiBnZXRJdGVtKGl0ZW1zLGkpO31cclxuICAgIH07XHJcbiAgICBsaXN0LmN1cnJlbnRFbnRyeSA9IGxpc3QuYWRkSXRlbShpdGVtKTtcclxuICAgIHJldHVybiBsaXN0O1xyXG59XHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdExpc3Q6IGluaXRMaXN0XHJcbn07IiwidmFyIFBoeXNpY3MgPSByZXF1aXJlKCcuLi8uLi9waHlzaWNzL3BoeXNpY3MnKTtcclxudmFyIFJhbmRvbSA9IE1hdGg7XHJcbnZhciBvcmJpdEZhY3RvcnkgPSByZXF1aXJlKCcuLi8uLi9vcmJpdC9vcmJpdCcpO1xyXG52YXIgVjMgPSBUSFJFRS5WZWN0b3IzO1xyXG5cclxuZnVuY3Rpb24gZ2V0T2Zmc2V0KHVwKSB7XHJcbiAgICBpZiAoIHVwID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICB1cCA9IG5ldyBWMygwLDEsMCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IFYzKDI1ICsgUmFuZG9tLnJhbmRvbSgpICogMTAsIDAsIDE1ICsgUmFuZG9tLnJhbmRvbSgpICogMTApO1xyXG59XHJcbmZ1bmN0aW9uIGdldFBsYW5ldChwb3NpdGlvbiwgdGhpbmdUb09yYml0LCBtYXNzLCBtYXhNb29ucykge1xyXG4gICAgaWYgKG1heE1vb25zID09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIG1heE1vb25zID0gMztcclxuICAgIH1cclxuICAgIGlmIChtYXNzID09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIG1hc3MgPSAxMDAwMDA7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBsYW5ldCA9IHt9O1xyXG4gICAgUGh5c2ljcy5hZGRQaHlzaWNzUHJvcGVydGllcyhwbGFuZXQpO1xyXG4gICAgcGxhbmV0LnhbcGxhbmV0Lm5dLmNvcHkocG9zaXRpb24pO1xyXG4gICAgcGxhbmV0LnNldE1hc3MobWFzcyk7XHJcbiAgICBwbGFuZXQubW9vbnMgPSBbXTtcclxuICAgIG9yYml0RmFjdG9yeS5tYWtlT3JiaXRhbChwbGFuZXQpO1xyXG4gICAgcGxhbmV0Lm9yYml0KHRoaW5nVG9PcmJpdCk7XHJcbiAgICB2YXIgbnVtTW9vbnMgPSBtYXhNb29ucztcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtTW9vbnM7IGkrKyApIHtcclxuICAgICAgICBwbGFuZXQubW9vbnMucHVzaChcclxuICAgICAgICAgICAgZ2V0UGxhbmV0KFxyXG4gICAgICAgICAgICAgICAgbmV3IFYzKCkuYWRkVmVjdG9ycyhwb3NpdGlvbiwgZ2V0T2Zmc2V0KCkpLFxyXG4gICAgICAgICAgICAgICAgcGxhbmV0LDEwLDBcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGxhbmV0O1xyXG59XHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZ2V0UGxhbmV0OiBnZXRQbGFuZXRcclxufTsiLCJmdW5jdGlvbiBtYWtlUGxhbmV0VmlldyhwbGFuZXQpIHtcclxuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5JY29zYWhlZHJvbkdlb21ldHJ5KDIgKyAuMDAwMSAqIHBsYW5ldC5tYXNzKCksIDIpO1xyXG4gICAgdmFyIHRleHR1cmUgPSBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCAnaW1hZ2VzL3dhdGVyLmpwZycgKTtcclxuICAgIHZhciBtYXQgPSBuZXcgVEhSRUUuTWVzaFBob25nTWF0ZXJpYWwoe1xyXG4gICAgICAgIGFtYmllbnQ6IDB4NTVGRjU1LFxyXG4gICAgICAgIGNvbG9yOiAweENDRkZDQyxcclxuICAgICAgICBzcGVjdWxhcjogMHhDQ0NDQ0MsXHJcbiAgICAgICAgc2hpbmluZXNzOiA1LFxyXG4gICAgICAgIGVtaXNzaXZlOiAweDAwMTEzMyxcclxuICAgICAgICBzaGFkaW5nOiBUSFJFRS5TbW9vdGhTaGFkaW5nLFxyXG4gICAgICAgIG1hcDogdGV4dHVyZVxyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIHBsYW5ldFZpZXcgPSBuZXcgVEhSRUUuTWVzaCggZ2VvbWV0cnksIG1hdCApO1xyXG5cclxuICAgIHBsYW5ldFZpZXcudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcGxhbmV0Vmlldy5wb3NpdGlvbi5jb3B5KHBsYW5ldC54W3BsYW5ldC5uXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGxhbmV0VmlldztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBtYWtlUGxhbmV0VmlldzogbWFrZVBsYW5ldFZpZXdcclxufTsiLCJ2YXIgcGh5c2ljcyA9IHJlcXVpcmUoJy4uLy4uL3BoeXNpY3MvcGh5c2ljcycpO1xyXG5cclxuXHJcbnZhciBTdGFyVHlwZXMgPSBbXHJcbiAgICB7XHJcbiAgICAgICAgc3RhclR5cGU6ICdvJyxcclxuICAgICAgICBjb2xvcjogMHgwMDAwRkYsXHJcbiAgICAgICAgc2Vjb25kYXJ5Q29sb3I6IDB4MDAwMDMzLFxyXG4gICAgICAgIHRlbXA6IDI1MDAwLFxyXG4gICAgICAgIGF2Z01hc3M6IDYwLFxyXG4gICAgICAgIGF2Z1JhZGl1czogMTUsXHJcbiAgICAgICAgYXZnTHVtOiAxNDAwMDAwXHJcbiAgICB9LFxyXG4gICAge1xyXG4gICAgICAgIHN0YXJUeXBlOiAnYicsXHJcbiAgICAgICAgY29sb3I6IDB4MjIyMkZGLFxyXG4gICAgICAgIHNlY29uZGFyeUNvbG9yOiAweDAwMDAzMyxcclxuICAgICAgICB0ZW1wOiAxODAwMCxcclxuICAgICAgICBhdmdNYXNzOiAxOCxcclxuICAgICAgICBhdmdSYWRpdXM6IDcsXHJcbiAgICAgICAgYXZnTHVtOiAyMDAwMFxyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgICBzdGFyVHlwZTogJ2EnLFxyXG4gICAgICAgIGNvbG9yOiAweDIyMjJGRixcclxuICAgICAgICBzZWNvbmRhcnlDb2xvcjogMHgwMDAwMzMsXHJcbiAgICAgICAgdGVtcDogOTI1MCxcclxuICAgICAgICBhdmdNYXNzOiAzLjIsXHJcbiAgICAgICAgYXZnUmFkaXVzOiAyLjUsXHJcbiAgICAgICAgYXZnTHVtOiA4MFxyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgICBzdGFyVHlwZTogJ2YnLFxyXG4gICAgICAgIGNvbG9yOiAweEVGRUZGRixcclxuICAgICAgICBzZWNvbmRhcnlDb2xvcjogMHhBNkE2RkYsXHJcbiAgICAgICAgdGVtcDogNjc1MCxcclxuICAgICAgICBhdmdNYXNzOiAxLjcsXHJcbiAgICAgICAgYXZnUmFkaXVzOiAxLjMsXHJcbiAgICAgICAgYXZnTHVtOiA2XHJcbiAgICB9LFxyXG4gICAge1xyXG4gICAgICAgIHN0YXJUeXBlOiAnZycsXHJcbiAgICAgICAgY29sb3I6IDB4ZmZFNTY2LFxyXG4gICAgICAgIHNlY29uZGFyeUNvbG9yOiAweGY2YmQ3YyxcclxuICAgICAgICB0ZW1wOiA1NTAwLFxyXG4gICAgICAgIGF2Z01hc3M6IDEuMSxcclxuICAgICAgICBhdmdSYWRpdXM6IDEuMSxcclxuICAgICAgICBhdmdMdW06IDEuMlxyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgICBzdGFyVHlwZTogJ2snLFxyXG4gICAgICAgIGNvbG9yOiAweGZmRTU2NixcclxuICAgICAgICBzZWNvbmRhcnlDb2xvcjogMHhmNmJkN2MsXHJcbiAgICAgICAgdGVtcDogNDI1MCxcclxuICAgICAgICBhdmdNYXNzOiAuOCxcclxuICAgICAgICBhdmdSYWRpdXM6LjkgLFxyXG4gICAgICAgIGF2Z0x1bTogLjRcclxuICAgIH0sXHJcbiAgICB7XHJcbiAgICAgICAgc3RhclR5cGU6ICdtJyxcclxuICAgICAgICBjb2xvcjogMHhGRjY2NjYsXHJcbiAgICAgICAgc2Vjb25kYXJ5Q29sb3I6IDB4REQzMzMzLFxyXG4gICAgICAgIHRlbXA6IDMwMDAsXHJcbiAgICAgICAgYXZnTWFzczogLjMsXHJcbiAgICAgICAgYXZnUmFkaXVzOi40LFxyXG4gICAgICAgIGF2Z0x1bTogLjA0XHJcbiAgICB9XHJcblxyXG5dO1xyXG5cclxudmFyIFN0YXJGYWN0b3J5ID0gKGZ1bmN0aW9uKHR5cGVzKXtcclxuXHJcbiAgICB2YXIgbWFzc09mVGhlU3VuID0gNTAwMDA7Ly8yICogTWF0aC5wb3coMTAsIDMwKTsgLy9rZ1xyXG4gICAgdmFyIHJhZGl1c09mVGhlU3VuID0gMjA7Ly82OTU1MDA7IC8va21cclxuICAgIHZhciBiYXNlID0gMTAwO1xyXG5cclxuICAgIHZhciB2YXJpYW5jZSA9IC4wNTtcclxuXHJcbiAgICAvL2luZGV4IHR5cGVzXHJcbiAgICB2YXIgYnlTdGFyVHlwZSA9IHt9O1xyXG4gICAgdmFyIGxldHRlcnMgPSBbXTtcclxuICAgIHZhciBudW1iZXJzID0gWzAsMSwyLDMsNCw1LDYsNyw4LDldO1xyXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBieVN0YXJUeXBlW3R5cGVzW2ldLnN0YXJUeXBlXSA9IHR5cGVzW2ldO1xyXG4gICAgICAgIGxldHRlcnNbaV0gPSB0eXBlc1tpXS5zdGFyVHlwZTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgZnVuY3Rpb24gcmFuZG9tTGV0dGVyKCkge1xyXG4gICAgICAgIHZhciBobCA9IGxldHRlcnMubGVuZ3RoLzI7XHJcbiAgICAgICAgcmV0dXJuIGxldHRlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogaGwgKyBNYXRoLnJhbmRvbSgpICogaGwpXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByYW5kb21OdW1iZXIoKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bWJlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogbnVtYmVycy5sZW5ndGgpXTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB2YXJ5KHZhbHVlLCBtdWx0aXBsaWVyKSB7XHJcbiAgICAgICAgdmFyIGJhc2UgPSB2YWx1ZSAqIG11bHRpcGxpZXI7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IGJhc2UgKiAoTWF0aC5yYW5kb20oKSAqIHZhcmlhbmNlKSAtIChNYXRoLnJhbmRvbSgpICogdmFyaWFuY2UpO1xyXG4gICAgICAgIHJldHVybiBiYXNlICsgb2Zmc2V0O1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gZ2V0U3Rhcih0eXBlKSB7XHJcbiAgICAgICAgaWYgKCF0eXBlKSB7XHJcbiAgICAgICAgICAgIHR5cGUgPSByYW5kb21MZXR0ZXIoKSArIHJhbmRvbU51bWJlcigpO1xyXG5cclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHNwZWN0cmFsVHlwZSA9IHR5cGUuY2hhckF0KDApO1xyXG4gICAgICAgIHZhciBzcGVjdHJhbE51bWJlciA9IHR5cGUuY2hhckF0KDEpO1xyXG5cclxuICAgICAgICB2YXIgcHJvdG8gPSBieVN0YXJUeXBlW3NwZWN0cmFsVHlwZV07XHJcblxyXG4gICAgICAgIHZhciBtdWx0aXBsaWVyID0gMSArIHNwZWN0cmFsTnVtYmVyLzU7XHJcblxyXG4gICAgICAgIHZhciBzdGFyID0ge307XHJcblxyXG4gICAgICAgIHBoeXNpY3MuYWRkUGh5c2ljc1Byb3BlcnRpZXMoc3Rhcik7XHJcblxyXG4gICAgICAgIHN0YXIuc2V0TWFzcyh2YXJ5KHByb3RvLmF2Z01hc3MgKiBtYXNzT2ZUaGVTdW4sIG11bHRpcGxpZXIpKTtcclxuICAgICAgICBzdGFyLmNvbG9yID0gcHJvdG8uY29sb3I7XHJcbiAgICAgICAgc3Rhci5zZWNvbmRhcnlDb2xvciA9IHByb3RvLnNlY29uZGFyeUNvbG9yO1xyXG4gICAgICAgIHN0YXIudGVtcCA9IHZhcnkocHJvdG8udGVtcCwgbXVsdGlwbGllcik7XHJcbiAgICAgICAgc3Rhci5yYWRpdXMgPSB2YXJ5KHByb3RvLmF2Z1JhZGl1cyAqIHJhZGl1c09mVGhlU3VuLCBtdWx0aXBsaWVyKTtcclxuICAgICAgICBzdGFyLmx1bSA9IE1hdGgubG9nKGJhc2UgKyB2YXJ5KHByb3RvLmF2Z0x1bSwgbXVsdGlwbGllcikpL01hdGgubG9nKGJhc2UpO1xyXG5cclxuICAgICAgICByZXR1cm4gc3RhcjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGdldFN0YXI6IGdldFN0YXJcclxuICAgIH1cclxufSkoU3RhclR5cGVzKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgc3RhclR5cGVzOiBTdGFyVHlwZXMsXHJcbiAgICBnZXRTdGFyOiBTdGFyRmFjdG9yeS5nZXRTdGFyXHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oXHJcbiAgICBHZW8sXHJcbiAgICBQYXJ0aWNsZU1hdGVyaWFsLFxyXG4gICAgVmVydGV4LFxyXG4gICAgVmVjdG9yMyxcclxuICAgIFBhcnRpY2xlU3lzdGVtLFxyXG4gICAgcm5nLFxyXG4gICAgdXRpbHMsXHJcbiAgICBhc3NldHMsXHJcbiAgICBwaHlzaWNzLFxyXG4gICAgdmVjdG9yVXRpbHMpe1xyXG5cclxuICAgIHZhciBzdW5GcmFnLCBzdW5WZXJ0O1xyXG4gICAgYXNzZXRzLmdldFNoYWRlcigncGFydHMvc2hhZGVycy9ub2lzZS5mcycsIGZ1bmN0aW9uKGRhdGEpe1xyXG4gICAgICAgIHN1bkZyYWcgPSBkYXRhO1xyXG4gICAgfSk7XHJcbiAgICBhc3NldHMuZ2V0U2hhZGVyKCdwYXJ0cy9zaGFkZXJzL2RlZmF1bHQudnMnLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICBzdW5WZXJ0ID0gZGF0YTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciB0ZXh0dXJlID0gVEhSRUUuSW1hZ2VVdGlscy5sb2FkVGV4dHVyZSggJ2ltYWdlcy93YXRlci5qcGcnICk7XHJcblxyXG4gICAgZnVuY3Rpb24gaGV4VG9WZWN0b3IoaGV4KSB7XHJcbiAgICAgICAgdmFyIHJlZCA9IChoZXggPj4gMTYpLzI1NTtcclxuICAgICAgICB2YXIgYmx1ZSA9IChoZXggPj4gOCAmIDB4RkYpLzI1NTtcclxuICAgICAgICB2YXIgZ3JlZW4gPSAoaGV4ICYgMHhGRikvMjU1O1xyXG4gICAgICAgIHZhciBjb2xvciA9IG5ldyBWZWN0b3IzKHJlZCwgYmx1ZSwgZ3JlZW4pO1xyXG4gICAgICAgIHJldHVybiBjb2xvcjtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBtYWtlU3RhclZpZXcoc3Rhcikge1xyXG4gICAgICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5JY29zYWhlZHJvbkdlb21ldHJ5KHN0YXIucmFkaXVzLCAzKTtcclxuXHJcbiAgICAgICAgdmFyIG1hdCA9IG5ldyBUSFJFRS5NZXNoUGhvbmdNYXRlcmlhbCh7XHJcbiAgICAgICAgICAgIGFtYmllbnQ6IDB4NTVGRjU1LFxyXG4gICAgICAgICAgICBjb2xvcjogMHhDQ0ZGQ0MsXHJcbiAgICAgICAgICAgIHNwZWN1bGFyOiAweENDQ0NDQyxcclxuICAgICAgICAgICAgc2hpbmluZXNzOiA1LFxyXG4gICAgICAgICAgICBlbWlzc2l2ZTogc3Rhci5jb2xvcixcclxuICAgICAgICAgICAgc2hhZGluZzogVEhSRUUuU21vb3RoU2hhZGluZyxcclxuICAgICAgICAgICAgbWFwOiB0ZXh0dXJlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHZhciBjb2xvciA9IGhleFRvVmVjdG9yKHN0YXIuY29sb3IpO1xyXG4gICAgICAgIHZhciBzZWNvbmRhcnlDb2xvciA9IGhleFRvVmVjdG9yKHN0YXIuc2Vjb25kYXJ5Q29sb3IpO1xyXG5cclxuICAgICAgICB2YXIgc2NhbGVWYWx1ZSA9IC4wMDY1ICogc3Rhci5yYWRpdXM7XHJcblxyXG4gICAgICAgIHZhciB1bmlmb3JtcyA9IHtcclxuICAgICAgICAgICAgdGltZTogXHR7IHR5cGU6IFwiZlwiLCB2YWx1ZTogMS4wIH0sXHJcbiAgICAgICAgICAgIHNjYWxlOiBcdHsgdHlwZTogXCJmXCIsIHZhbHVlOiAuMDIgfSxcclxuICAgICAgICAgICAgY29sb3I6ICB7IHR5cGU6IFwidjNcIiwgdmFsdWU6IGNvbG9yIH0sXHJcbiAgICAgICAgICAgIHNlY29uZGFyeUNvbG9yOiB7IHR5cGU6IFwidjNcIiwgdmFsdWU6IHNlY29uZGFyeUNvbG9yIH0sXHJcbiAgICAgICAgICAgIGNhbWVyYTogeyB0eXBlOiBcInYzXCIsIHZhbHVlOiBuZXcgVmVjdG9yMygpIH1cclxuICAgICAgICB9O1xyXG5cclxuXHJcbiAgICAgICAgdmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKCB7XHJcbiAgICAgICAgICAgIHVuaWZvcm1zOiB1bmlmb3JtcyxcclxuICAgICAgICAgICAgdmVydGV4U2hhZGVyOiBzdW5WZXJ0LFxyXG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogc3VuRnJhZ1xyXG4gICAgICAgIH0gKTtcclxuXHJcbiAgICAgICAgdmFyIHN0YXJWaWV3ID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBtYXRlcmlhbCApO1xyXG5cclxuICAgICAgICBwaHlzaWNzLmFkZFBoeXNpY3NQcm9wZXJ0aWVzKHN0YXJWaWV3KTtcclxuICAgICAgICBzdGFyVmlldy5pbnZNYXNzID0gc3Rhci5pbnZNYXNzO1xyXG5cclxuICAgICAgICBzdGFyVmlldy5saWdodCA9IG5ldyBUSFJFRS5Qb2ludExpZ2h0KHN0YXIuY29sb3IpO1xyXG4gICAgICAgIHN0YXJWaWV3LmxpZ2h0LnBvc2l0aW9uID0gc3RhclZpZXcucG9zaXRpb247XHJcbiAgICAgICAgc3RhclZpZXcubGlnaHQuaW50ZW5zaXR5ID0gc3Rhci5sdW07XHJcbiAgICAgICAgc3RhclZpZXcuYmFja2dyb3VuZFBhcnRpY2xlcyA9IGJ1aWxkQmFja2dyb3VuZFBhcnRpY2xlcyhzdGFyKTtcclxuICAgICAgICBzdGFyVmlldy5yYWRpYWxQYXJ0aWNsZXNFbWl0dGVycyA9IGJ1aWxkUmFkaWFsUGFydGljbGVFbWl0dGVycyhzdGFyKTtcclxuICAgICAgICBzdGFyVmlldy51bmlmb3JtcyA9IHVuaWZvcm1zO1xyXG5cclxuXHJcbiAgICAgICAgLy93aGF0IHdlIG5lZWQgdG8gZG8gZWFjaCBmcmFtZSB0byB1cGRhdGUgdGhlIHZpZXcgb2YgdGhlIHN0YXJcclxuICAgICAgICBzdGFyVmlldy52aWV3VXBkYXRlID0gZnVuY3Rpb24oZHQsIGNhbWVyYSwgc2l6ZSwgc3RhckVmZmVjdCApe1xyXG4gICAgICAgICAgICBzdGFyVmlldy51bmlmb3Jtcy50aW1lLnZhbHVlICs9IC4yNSAqIGR0O1xyXG5cclxuICAgICAgICAgICAgdmFyIGRmID0gNDUwMDtcclxuICAgICAgICAgICAgc3RhckVmZmVjdC51bmlmb3Jtcy5tYXhEaXN0YW5jZS52YWx1ZSA9IGRmICogZGY7XHJcbiAgICAgICAgICAgIHZhciBzcCA9IG5ldyBWZWN0b3IzKCkuY29weShzdGFyVmlldy5wb3NpdGlvbik7XHJcbiAgICAgICAgICAgIHN0YXJFZmZlY3QudW5pZm9ybXMuZGlzdGFuY2VUb1N0YXIudmFsdWUgPSBzcC5zdWIoY2FtZXJhLnBvc2l0aW9uKS5sZW5ndGhTcSgpO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGFuaW1hdGVSYWRpYWxQYXJ0aWNsZXMoc3RhclZpZXcsIGR0KTtcclxuXHJcbiAgICAgICAgICAgIHZhciB2ZWN0b3IgPSBuZXcgVmVjdG9yMygpO1xyXG4gICAgICAgICAgICB2YXIgcHJvamVjdG9yID0gbmV3IFRIUkVFLlByb2plY3RvcigpO1xyXG4gICAgICAgICAgICBwcm9qZWN0b3IucHJvamVjdFZlY3RvciggdmVjdG9yLnNldEZyb21NYXRyaXhQb3NpdGlvbiggc3RhclZpZXcubWF0cml4V29ybGQgKSwgY2FtZXJhICk7XHJcblxyXG4gICAgICAgICAgICB2YXIgd2lkdGhIYWxmID0gc2l6ZS54LzI7XHJcbiAgICAgICAgICAgIHZhciBoZWlnaHRIYWxmID0gc2l6ZS55LzI7XHJcbiAgICAgICAgICAgIHZlY3Rvci54ID0gKCB2ZWN0b3IueCAqIHdpZHRoSGFsZiApICsgd2lkdGhIYWxmO1xyXG4gICAgICAgICAgICB2ZWN0b3IueSA9ICggdmVjdG9yLnkgKiBoZWlnaHRIYWxmICkgKyBoZWlnaHRIYWxmO1xyXG4gICAgICAgICAgICBzdGFyRWZmZWN0LnVuaWZvcm1zW1wiY2VudGVyXCJdLnZhbHVlID0gdmVjdG9yO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhleFRvVmVjdG9yKHN0YXIuY29sb3IpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHN0YXJWaWV3O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBmdW5jdGlvbiBhbmltYXRlUmFkaWFsUGFydGljbGVzKHN0YXIsIGR0KSB7XHJcblxyXG4gICAgICAgIHZhciBlbWl0dGVycyA9IHN0YXIucmFkaWFsUGFydGljbGVzRW1pdHRlcnM7XHJcbiAgICAgICAgZm9yICggdmFyIGogPSAwOyBqIDwgZW1pdHRlcnMubGVuZ3RoOyBqKysgKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJ0aWNsZXMgPSBzdGFyLnJhZGlhbFBhcnRpY2xlc0VtaXR0ZXJzW2pdO1xyXG4gICAgICAgICAgICB2YXIgZW1pdHRlciA9IHBhcnRpY2xlcy5zdW5TcG90RW1pdHRlcjtcclxuICAgICAgICAgICAgdmFyIHZlcnRpY2VzID0gcGFydGljbGVzLmdlb21ldHJ5LnZlcnRpY2VzO1xyXG5cclxuICAgICAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgdmVydGljZXMubGVuZ3RoOyBpKysgKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcCA9IHZlcnRpY2VzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKHAuaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgICAgICAgICBwaHlzaWNzLmFwcGx5R3Jhdml0eShzdGFyLCBwLnBoeXNpY3MsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHAucGh5c2ljcy5waHlzaWNzVXBkYXRlKGR0KTtcclxuICAgICAgICAgICAgICAgICAgICBwLmNvcHkocC5waHlzaWNzLnBvc2l0aW9uKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVtaXR0ZXIuaXNJbnNpZGUocCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcC5pc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwLmNvcHkoc3Rhci5wb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXR0ZXIudW5kZXBsb3llZC5wdXNoKHApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGVtaXR0ZXIudW5kZXBsb3llZC5sZW5ndGggPT0gZW1pdHRlci5wYXJ0aWNsZUNvdW50ICkge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIGVtaXR0ZXIudW5kZXBsb3llZC5sZW5ndGggPiAwICYmIGVtaXR0ZXIuY3VycmVudFdhaXQgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgLy9zcGF3biB0aGUgcGFydGljbGVcclxuICAgICAgICAgICAgICAgIHZhciBwYXJ0aWNsZSA9IGVtaXR0ZXIudW5kZXBsb3llZC5wb3AoKTtcclxuICAgICAgICAgICAgICAgIHZhciBwcCA9IHBhcnRpY2xlLnBoeXNpY3M7XHJcbiAgICAgICAgICAgICAgICBwcC5wb3NpdGlvbi5jb3B5KGVtaXR0ZXIucG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgcHAucHJldmlvdXNQb3NpdGlvbigpLmNvcHkoZW1pdHRlci5wb3NpdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGFjY2VsID0gbmV3IFZlY3RvcjMoKS5jb3B5KHBhcnRpY2xlLnBoeXNpY3MucG9zaXRpb24pLnN1YihzdGFyLnBvc2l0aW9uKS5zZXRMZW5ndGgoZW1pdHRlci5iYXNlQWNjZWxlcmF0aW9uKS5hZGQoXHJcbiAgICAgICAgICAgICAgICAgICAgdmVjdG9yVXRpbHMucmFuZG9tVmVjdG9yKGVtaXR0ZXIuYmFzZUFjY2VsZXJhdGlvbi80KVxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIHBhcnRpY2xlLnBoeXNpY3MuYWNjZWxlcmF0aW9uKCkuYWRkKGFjY2VsKTtcclxuICAgICAgICAgICAgICAgIHBhcnRpY2xlLmlzQWN0aXZlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIGVtaXR0ZXIudW5kZXBsb3llZC5sZW5ndGggPT0gMCApIHtcclxuICAgICAgICAgICAgICAgICAgICBlbWl0dGVyLnBpY2tOZXdQb3NpdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVtaXR0ZXIuY3VycmVudFdhaXQgPSBlbWl0dGVyLnJhbmRvbVdhaXQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCBlbWl0dGVyLmN1cnJlbnRXYWl0ID4gMCApIHtcclxuICAgICAgICAgICAgICAgIGVtaXR0ZXIuY3VycmVudFdhaXQtLTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByYW5kTWludXNSYW5kKCkge1xyXG4gICAgICAgIHJldHVybiBybmcucmFuZG9tKCkgLSBybmcucmFuZG9tKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYnVpbGRCYWNrZ3JvdW5kUGFydGljbGVzKHN0YXIpIHtcclxuICAgICAgICB2YXIgcGFydGljbGVDb3VudCA9IDQwMDtcclxuICAgICAgICB2YXIgcGFydGljbGVzID0gbmV3IEdlbygpO1xyXG4gICAgICAgIHZhciBtYXQgPSBuZXcgUGFydGljbGVNYXRlcmlhbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBzdGFyLmNvbG9yLFxyXG4gICAgICAgICAgICBtYXA6IHV0aWxzLmxvYWRUZXh0dXJlKCcvaW1hZ2VzL3BhcnRpY2xlcy9kdXN0LnBuZycpLFxyXG4gICAgICAgICAgICBzaXplOiAxNTAsXHJcbiAgICAgICAgICAgIG9wYWNpdHk6LjAyNSxcclxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXHJcbiAgICAgICAgICAgIGJsZW5kRHN0OiBUSFJFRS5TcmNBbHBoYUZhY3RvcixcclxuICAgICAgICAgICAgYmxlbmRpbmc6IFRIUkVFLkFkZGl0aXZlQmxlbmRpbmdcclxuICAgICAgICB9KTtcclxuICAgICAgICBtYXQuZGVwdGhXcml0ZSA9IGZhbHNlO1xyXG4gICAgICAgIHZhciBwb3MgPSBzdGFyLnBvc2l0aW9uO1xyXG4gICAgICAgIHZhciBtYXggPSBwb3MueCArIHN0YXIucmFkaXVzICsgNjAwO1xyXG4gICAgICAgIHZhciBtaW4gPSBwb3MueCArIHN0YXIucmFkaXVzICsgNTA7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0aWNsZUNvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIGRpc3QgPSBybmcucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcclxuICAgICAgICAgICAgdmFyIHYgPSBuZXcgVmVjdG9yMyhyYW5kTWludXNSYW5kKCkscmFuZE1pbnVzUmFuZCgpLCByYW5kTWludXNSYW5kKCkpO1xyXG4gICAgICAgICAgICB2LnNldExlbmd0aChkaXN0KTtcclxuICAgICAgICAgICAgcGFydGljbGVzLnZlcnRpY2VzLnB1c2godik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcGFydGljbGVTeXN0ZW0gPSBuZXcgUGFydGljbGVTeXN0ZW0oXHJcbiAgICAgICAgICAgIHBhcnRpY2xlcyxcclxuICAgICAgICAgICAgbWF0XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgcGFydGljbGVTeXN0ZW0uc29ydFBhcnRpY2xlcyA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRpY2xlU3lzdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJhbmRvbVBvaW50T25TdXJmYWNlKHN0YXIpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFZlY3RvcjMocmFuZE1pbnVzUmFuZCgpLHJhbmRNaW51c1JhbmQoKSwgcmFuZE1pbnVzUmFuZCgpKS5zZXRMZW5ndGgoc3Rhci5yYWRpdXMpLmFkZChzdGFyLnBvc2l0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBidWlsZFJhZGlhbFBhcnRpY2xlRW1pdHRlcnMoc3Rhcikge1xyXG4gICAgICAgIHZhciBlbWl0dGVycyA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCAxNTsgaSsrICkge1xyXG4gICAgICAgICAgICBlbWl0dGVycy5wdXNoKGJ1aWxkUmFkaWFsUGFydGljbGVFbWl0dGVyKHN0YXIpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGVtaXR0ZXJzO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJhZGlhbFBhcnRpY2xlTWF0ZXJpYWwoc3Rhcikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUGFydGljbGVNYXRlcmlhbCh7XHJcbiAgICAgICAgICAgIGNvbG9yOiBzdGFyLmNvbG9yLFxyXG4gICAgICAgICAgICBtYXA6IHV0aWxzLmxvYWRUZXh0dXJlKCcvaW1hZ2VzL3BhcnRpY2xlcy9kdXN0LnBuZycpLFxyXG4gICAgICAgICAgICBzaXplOiA3ICsuMDI1ICogc3Rhci5yYWRpdXMsXHJcbiAgICAgICAgICAgIG9wYWNpdHk6IC4yNSxcclxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXHJcbiAgICAgICAgICAgIGJsZW5kRHN0OiBUSFJFRS5TcmNBbHBoYUZhY3RvcixcclxuICAgICAgICAgICAgYmxlbmRpbmc6IFRIUkVFLkFkZGl0aXZlQmxlbmRpbmdcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBidWlsZFJhZGlhbFBhcnRpY2xlRW1pdHRlcihzdGFyKSB7XHJcbiAgICAgICAgdmFyIHBhcnRpY2xlQ291bnQgPSAzNTtcclxuICAgICAgICB2YXIgcGFydGljbGVzID0gbmV3IEdlbygpO1xyXG5cclxuICAgICAgICB2YXIgZW1pdHRlciA9IHt9O1xyXG4gICAgICAgIGVtaXR0ZXIucG9zaXRpb24gPSBuZXcgVmVjdG9yMygpO1xyXG4gICAgICAgIGVtaXR0ZXIucGlja05ld1Bvc2l0aW9uID0gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgZW1pdHRlci5wb3NpdGlvbiA9IHJhbmRvbVBvaW50T25TdXJmYWNlKHN0YXIpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGVtaXR0ZXIubWF4V2FpdCA9IDU1MDtcclxuICAgICAgICBlbWl0dGVyLnJhbmRvbVdhaXQgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICByZXR1cm4gcm5nLnJvdW5kKHJuZy5yYW5kb20oKSAqIGVtaXR0ZXIubWF4V2FpdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVtaXR0ZXIuY3VycmVudFdhaXQgPSBlbWl0dGVyLnJhbmRvbVdhaXQoKTtcclxuXHJcbiAgICAgICAgZW1pdHRlci5pc0luc2lkZSA9IGZ1bmN0aW9uKHBvcyl7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmVjdG9yMygpLmNvcHkocG9zKS5zdWIoc3Rhci5wb3NpdGlvbikubGVuZ3RoU3EoKSA8IChzdGFyLnJhZGl1cyAqIHN0YXIucmFkaXVzKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBlbWl0dGVyLmJhc2VBY2NlbGVyYXRpb24gPSBNYXRoLnNxcnQoc3Rhci5tYXNzKCkpLzU1MDtcclxuICAgICAgICBlbWl0dGVyLnBhcnRpY2xlQ291bnQgPSBwYXJ0aWNsZUNvdW50O1xyXG4gICAgICAgIGVtaXR0ZXIucGlja05ld1Bvc2l0aW9uKCk7XHJcbiAgICAgICAgZW1pdHRlci51bmRlcGxveWVkID0gW107XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydGljbGVDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB2ID0gbmV3IFZlY3RvcjMoKTtcclxuICAgICAgICAgICAgdmFyIHBoeSA9IHYucGh5c2ljcyA9IHt9O1xyXG4gICAgICAgICAgICBwaHlzaWNzLmFkZFBoeXNpY3NQcm9wZXJ0aWVzKHYucGh5c2ljcywgZmFsc2UpOyAvL2Rvbid0IGtlZXAgaGlzdG9yeVxyXG5cclxuICAgICAgICAgICAgdmFyIHBQb3MgPSBwaHkucG9zaXRpb247XHJcbiAgICAgICAgICAgIHBQb3MuY29weSh2KTtcclxuXHJcbiAgICAgICAgICAgIHBoeS5tYXNzKC4wMDEpO1xyXG4gICAgICAgICAgICBlbWl0dGVyLnVuZGVwbG95ZWQucHVzaCh2KTtcclxuICAgICAgICAgICAgcGFydGljbGVzLnZlcnRpY2VzLnB1c2godik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcGFydGljbGVTeXN0ZW0gPSBuZXcgUGFydGljbGVTeXN0ZW0oXHJcbiAgICAgICAgICAgIHBhcnRpY2xlcyxcclxuICAgICAgICAgICAgcmFkaWFsUGFydGljbGVNYXRlcmlhbChzdGFyKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHBhcnRpY2xlU3lzdGVtLnN1blNwb3RFbWl0dGVyID0gZW1pdHRlcjtcclxuICAgICAgICBwYXJ0aWNsZVN5c3RlbS5zb3J0UGFydGljbGVzID0gdHJ1ZTtcclxuICAgICAgICByZXR1cm4gcGFydGljbGVTeXN0ZW07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBtYWtlU3RhclZpZXc6IG1ha2VTdGFyVmlld1xyXG4gICAgfVxyXG5cclxufSkoVEhSRUUuR2VvbWV0cnksXHJcbiAgIFRIUkVFLlBhcnRpY2xlU3lzdGVtTWF0ZXJpYWwsXHJcbiAgIFRIUkVFLlZlcnRleCxcclxuICAgVEhSRUUuVmVjdG9yMyxcclxuICAgVEhSRUUuUGFydGljbGVTeXN0ZW0sXHJcbiAgIE1hdGgsXHJcbiAgIFRIUkVFLkltYWdlVXRpbHMsXHJcbiAgIHJlcXVpcmUoJy4uLy4uLy4uL2Fzc2V0cycpLFxyXG4gICByZXF1aXJlKCcuLi8uLi9waHlzaWNzL3BoeXNpY3MnKSxcclxuICAgcmVxdWlyZSgnLi4vLi4vdXRpbHMvdmVjdG9yVXRpbHMnKSk7IiwidmFyIGpxdWVyeSA9ICQ7XHJcbnZhciB1cmwgPSAncGFydHMvdWkvY29tcG9uZW50cy9hY3Rpb25TZWxlY3Rpb24ubXVzdGFjaGUnO1xyXG5cclxuZnVuY3Rpb24gZW5hYmxlKHBhcmVudCwgYWN0aW9ucykge1xyXG4gICAgaXNFbmFibGVkID0gdHJ1ZTtcclxuXHJcbiAgICBqcXVlcnkuZ2V0KHVybCwgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICAgdmFyIGFjdGlvblRlbXBsYXRlID0gSGFuZGxlYmFycy5jb21waWxlKGRhdGEpO1xyXG4gICAgICAgIHZhciBhY3Rpb24gPSBhY3Rpb25UZW1wbGF0ZSh7YWN0aW9uczogYWN0aW9uc30pO1xyXG4gICAgICAgIHBhcmVudC5hcHBlbmQoYWN0aW9uKTtcclxuXHJcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYWN0aW9ucy5sZW5ndGg7IGkrKyApIHtcclxuICAgICAgICAgICAgdmFyIGFjdGlvbiA9IGFjdGlvbnNbaV07XHJcbiAgICAgICAgICAgIHZhciBpZCA9IGFjdGlvbi5pZDtcclxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSBhY3Rpb24uaGFuZGxlcjtcclxuICAgICAgICAgICAganF1ZXJ5KCcjJytpZCkuY2xpY2soaGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRpc2FibGUoKSB7XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGVuYWJsZTogZW5hYmxlLFxyXG4gICAgZGlzYWJsZTogZGlzYWJsZVxyXG59IiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oVmVjdG9yMywgcm5nKXtcclxuICAgIGZ1bmN0aW9uIHJhbmRvbUNvbXAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHJuZy5yYW5kb20oKSAtIHJuZy5yYW5kb20oKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJhbmRvbVZlY3RvcjogZnVuY3Rpb24oc2l6ZSl7XHJcbiAgICAgICAgICAgIHZhciB4ID0gcmFuZG9tQ29tcCgpO1xyXG4gICAgICAgICAgICB2YXIgeSA9IHJhbmRvbUNvbXAoKTtcclxuICAgICAgICAgICAgdmFyIHogPSByYW5kb21Db21wKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmVjdG9yMyh4LHkseikuc2V0TGVuZ3RoKHNpemUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSkoVEhSRUUuVmVjdG9yMywgTWF0aCk7Il19

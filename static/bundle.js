(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var V3 = THREE.Vector3;
var OrbitList = require('./orbitList');
var physics = require('solar/physics');

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
},{"./orbitList":2,"solar/physics":3}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
var COMPOSER = THREE.EffectComposer;
var Actions             = require('./parts/controls/actions');
var keybinds            = require('./parts/controls/keybinds');
var rotate              = require('./parts/controls/camera/rotate');
var track               = require('./parts/controls/camera/TrackObject');
var zoom                = require('./parts/controls/camera/zoom');
var intersectionFactory = require('./parts/controls/IntersectionFinder');
var orbit               = require('solar/orbit');
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
},{"./assets":4,"./parts/controls/IntersectionFinder":7,"./parts/controls/actions":9,"./parts/controls/camera/TrackObject":10,"./parts/controls/camera/rotate":11,"./parts/controls/camera/zoom":12,"./parts/controls/keybinds":13,"./parts/shaders/bloom/bloom":14,"./parts/shaders/blur/blur":15,"./parts/things/planet/planetFactory":16,"./parts/things/planet/planetView":17,"./parts/things/star/starFactory":18,"./parts/things/star/starView":19,"./parts/ui/components/actionSelection":20,"solar/orbit":1}],6:[function(require,module,exports){
exports.configSatellite = function(thingToOrbit, satelliteFactory){
    var handler = function(intersection){
        satelliteFactory(intersection, thingToOrbit);
    }
    return handler;
};


},{}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
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
},{}],9:[function(require,module,exports){
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
},{"./AddSatellite":6,"./MoveCamera":8,"./camera/TrackObject":10,"./camera/rotate":11,"./camera/zoom":12}],10:[function(require,module,exports){
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
},{}],11:[function(require,module,exports){
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


},{}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
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
},{"./actions":9}],14:[function(require,module,exports){
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
},{"../../../assets":4}],15:[function(require,module,exports){

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

},{"../../../assets":4}],16:[function(require,module,exports){
var Physics = require('solar/physics');
var Random = Math;
var orbitFactory = require('solar/orbit');
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
},{"solar/orbit":1,"solar/physics":3}],17:[function(require,module,exports){
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
var physics = require('solar/physics');


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
},{"solar/physics":3}],19:[function(require,module,exports){
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
   require('solar/physics'),
   require('../../utils/vectorUtils'));
},{"../../../assets":4,"../../utils/vectorUtils":21,"solar/physics":3}],20:[function(require,module,exports){
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
},{}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXEphbWlsXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL25vZGVfbW9kdWxlcy9zb2xhci9vcmJpdC9vcmJpdC5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9ub2RlX21vZHVsZXMvc29sYXIvb3JiaXQvb3JiaXRMaXN0LmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL25vZGVfbW9kdWxlcy9zb2xhci9waHlzaWNzL21haW4uanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL2Fzc2V0cy5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvZ2FtZS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvY29udHJvbHMvQWRkU2F0ZWxsaXRlLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9jb250cm9scy9JbnRlcnNlY3Rpb25GaW5kZXIuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL01vdmVDYW1lcmEuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL2FjdGlvbnMuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS9UcmFja09iamVjdC5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvY29udHJvbHMvY2FtZXJhL3JvdGF0ZS5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvY29udHJvbHMvY2FtZXJhL3pvb20uanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL2NvbnRyb2xzL2tleWJpbmRzLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9zaGFkZXJzL2Jsb29tL2Jsb29tLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy9zaGFkZXJzL2JsdXIvYmx1ci5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRGYWN0b3J5LmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy90aGluZ3MvcGxhbmV0L3BsYW5ldFZpZXcuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3RoaW5ncy9zdGFyL3N0YXJGYWN0b3J5LmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL3N0YXRpYy9wYXJ0cy90aGluZ3Mvc3Rhci9zdGFyVmlldy5qcyIsIkM6L1VzZXJzL0phbWlsL0dvb2dsZSBEcml2ZS9Qcm9qZWN0cy9zb2xhci9zdGF0aWMvcGFydHMvdWkvY29tcG9uZW50cy9hY3Rpb25TZWxlY3Rpb24uanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3BhcnRzL3V0aWxzL3ZlY3RvclV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBWMyA9IFRIUkVFLlZlY3RvcjM7XHJcbnZhciBPcmJpdExpc3QgPSByZXF1aXJlKCcuL29yYml0TGlzdCcpO1xyXG52YXIgcGh5c2ljcyA9IHJlcXVpcmUoJ3NvbGFyL3BoeXNpY3MnKTtcclxuXHJcbi8vc2V0IHRoZSBvYmplY3QgaW50byBpbW1lZGlhdGUgY2lyY3VsYXIgb3JiaXRcclxuLy9zaG91bGQgYmUgdXNlZnVsIGZvciBpbml0aWFsIHNldHVwIG9mIG1vb25zIGFuZCBwbGFuZXRzXHJcbi8vdiA9IHNxcnQoRyhtMSttMikvcilcclxuZnVuY3Rpb24gb3JiaXRJbW1lZGlhdGVseShzZWxmLCBvdGhlciwgcGxhbmVOb3JtYWwpIHtcclxuICAgIGlmICggcGxhbmVOb3JtYWwgPT0gbnVsbCApIHtcclxuICAgICAgICBwbGFuZU5vcm1hbCA9IG5ldyBWMygwLDEsMCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRlbXBBID0ge307XHJcbiAgICB0ZW1wQS5wb3NpdGlvbiA9IG5ldyBWMygpLmNvcHkoc2VsZi5wb3NpdGlvbik7XHJcbiAgICBwaHlzaWNzLmFkZFBoeXNpY3NQcm9wZXJ0aWVzKHRlbXBBKTtcclxuICAgIHRlbXBBLnNldE1hc3Moc2VsZi5tYXNzKCkpO1xyXG5cclxuICAgIHZhciB0ZW1wQiA9IHt9O1xyXG4gICAgdGVtcEIucG9zaXRpb24gPSBuZXcgVjMoKS5jb3B5KG90aGVyLnBvc2l0aW9uKTtcclxuICAgIHBoeXNpY3MuYWRkUGh5c2ljc1Byb3BlcnRpZXModGVtcEIpO1xyXG4gICAgdGVtcEIuc2V0TWFzcyhvdGhlci5tYXNzKCkpO1xyXG5cclxuICAgIHBoeXNpY3MuYXBwbHlHcmF2aXR5KHRlbXBCLCB0ZW1wQSwgdHJ1ZSk7XHJcbiAgICB0ZW1wQS52ZXJsZXQodGVtcEEsIDEpO1xyXG5cclxuICAgIHZhciBkaXNwbGFjZW1lbnQgPSBuZXcgVjMoKTtcclxuICAgIGRpc3BsYWNlbWVudC5zdWJWZWN0b3JzKHNlbGYucG9zaXRpb24sIG90aGVyLnBvc2l0aW9uKTtcclxuXHJcbiAgICB2YXIgclNxID0gZGlzcGxhY2VtZW50Lmxlbmd0aFNxKCk7XHJcbiAgICB2YXIgbiA9IHRlbXBBLm47XHJcbiAgICAvL2hvdyBtdWNoIG11c3Qgd2UgYmUgbW92aW5nIGluIG9yZGVyIGZvciB1cyB0byBjb3ZlciB0aGlzIGNoYW5nZVxyXG5cclxuICAgIHZhciBkaXJlY3Rpb24gPSBkaXNwbGFjZW1lbnQuY3Jvc3MocGxhbmVOb3JtYWwpLm5vcm1hbGl6ZSgpO1xyXG5cclxuICAgIC8vdGhlIG5leHQgcG9zaXRpb24gd2lsbCBuZWVkIHRvIGJlIGp1c3QgYXMgZmFyIGF3YXkgYXMgdGhlIGN1cnJlbnQgZGlzdGFuY2U7XHJcbiAgICAvL25leHQgcG9zaXRpb25cclxuICAgIHZhciBwID0gc2VsZi5wb3NpdGlvbjtcclxuICAgIHZhciBuZXh0UG9zaXRpb24gPSB0ZW1wQS54W24gKyAxXTtcclxuICAgIHZhciBtaWRQb2ludCA9IG5leHRQb3NpdGlvbi5sZXJwKHRlbXBBLnBvc2l0aW9uLCAuNSk7XHJcbiAgICB2YXIgc2hvcnRSID0gbWlkUG9pbnQuZGlzdGFuY2VUbyhvdGhlci5wb3NpdGlvbik7XHJcblxyXG4gICAgLy94ICogeCArIHNob3J0UiAqIHNob3J0UiA9IHIgKiByXHJcbiAgICB2YXIgY1NxdWFyZWRNaW51c0FTcXVhcmVkID0gKHJTcSktKHNob3J0UiAqIHNob3J0Uik7XHJcbiAgICB2YXIgbWFnID0gTWF0aC5zcXJ0KGNTcXVhcmVkTWludXNBU3F1YXJlZCk7XHJcblxyXG4gICAgdmFyIHByZXZpb3VzUG9zaXRpb24gPSBtaWRQb2ludC5hZGQoZGlyZWN0aW9uLm11bHRpcGx5U2NhbGFyKG1hZykpO1xyXG5cclxuICAgIGlmICggb3RoZXIub3JiaXRUYXJnZXQgIT0gdW5kZWZpbmVkICkge1xyXG4gICAgICAgIHZhciBkaXMgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkob3RoZXIueFtvdGhlci5uLTFdKS5zdWIob3RoZXIueFtvdGhlci5uXSk7XHJcbiAgICAgICAgcHJldmlvdXNQb3NpdGlvbi5hZGQoZGlzKTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLnhbbi0xXSA9IHByZXZpb3VzUG9zaXRpb247XHJcblxyXG4gICAgc2VsZi5vcmJpdFRhcmdldCA9IG90aGVyO1xyXG5cclxuICAgIGlmICggc2VsZi5vcmJpdExpc3QgIT0gdW5kZWZpbmVkICkge1xyXG4gICAgICAgIHZhciBkaXMgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkoc2VsZi54W3NlbGYubi0xXSkuc3ViKHNlbGYueFtzZWxmLm5dKTtcclxuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxmLm9yYml0TGlzdC5sZW5ndGgoKTsgaSsrICkge1xyXG4gICAgICAgICAgICB2YXIgaXRlbSA9IHNlbGYub3JiaXRMaXN0LmdldEl0ZW0oaSk7XHJcbiAgICAgICAgICAgIGl0ZW0ueFtuLTFdLmFkZChkaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IFYzKCkuY29weShzZWxmLnhbbl0pLnN1YihwcmV2aW91c1Bvc2l0aW9uKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJ5VG9PcmJpdCgpIHtcclxuXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRBYmlsaXR5VG9CZU9yYml0ZWQocGh5c2ljc09iamVjdCkge1xyXG4gICAgaWYgKCBwaHlzaWNzT2JqZWN0Lm9yYml0TGlzdCA9PSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAgcGh5c2ljc09iamVjdC5vcmJpdExpc3QgPSBPcmJpdExpc3QuaW5pdExpc3QocGh5c2ljc09iamVjdCk7XHJcbiAgICB9XHJcbiAgICBwaHlzaWNzT2JqZWN0LnJlY3Vyc2l2ZVBoeXNpY3NVcGRhdGUgPSBmdW5jdGlvbihkdCkge1xyXG4gICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHBoeXNpY3NPYmplY3Qub3JiaXRMaXN0Lmxlbmd0aCgpOyBpKysgKSB7XHJcbiAgICAgICAgICAgIHZhciBpdGVtID0gcGh5c2ljc09iamVjdC5vcmJpdExpc3QuZ2V0SXRlbShpKTtcclxuICAgICAgICAgICAgcGh5c2ljcy5hcHBseUdyYXZpdHkocGh5c2ljc09iamVjdCwgaXRlbSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmVjdXJzaXZlUGh5c2ljc1VwZGF0ZShkdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBoeXNpY3NPYmplY3QucGh5c2ljc1VwZGF0ZShkdCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZEFiaWxpdHlUb09yYml0KHBoeXNpY3NPYmplY3QpIHtcclxuICAgIHBoeXNpY3NPYmplY3Qub3JiaXQgPSBmdW5jdGlvbihvdGhlciwgcGxhbmVOb3JtYWwpe1xyXG4gICAgICAgIG9yYml0SW1tZWRpYXRlbHkocGh5c2ljc09iamVjdCwgb3RoZXIsIHBsYW5lTm9ybWFsKTtcclxuICAgICAgICBpZiAoIG90aGVyLm9yYml0TGlzdCAhPSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAgICAgIG90aGVyLm9yYml0TGlzdC5hZGRJdGVtKHBoeXNpY3NPYmplY3QpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICggcGh5c2ljc09iamVjdC5yZWN1cnNpdmVQaHlzaWNzVXBkYXRlID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBwaHlzaWNzT2JqZWN0LnJlY3Vyc2l2ZVBoeXNpY3NVcGRhdGUgPSBwaHlzaWNzT2JqZWN0LnBoeXNpY3NVcGRhdGU7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIG1ha2VPcmJpdGFsOiBmdW5jdGlvbihvKXthZGRBYmlsaXR5VG9PcmJpdChvKTsgYWRkQWJpbGl0eVRvQmVPcmJpdGVkKG8pOyB9LFxyXG4gICAgYWRkQWJpbGl0eVRvT3JiaXQ6IGFkZEFiaWxpdHlUb09yYml0LFxyXG4gICAgYWRkQWJpbGl0eVRvQmVPcmJpdGVkOiBhZGRBYmlsaXR5VG9CZU9yYml0ZWRcclxufTsiLCJmdW5jdGlvbiBuZXh0SXRlbShsaXN0KSB7XHJcbiAgICB2YXIgaSA9IGxpc3QuZGlzdGFuY2VJbmRleC5pbmRleE9mKGxpc3QuY3VycmVudEVudHJ5KTtcclxuICAgIGlmICggaSA8IGxpc3QuZGlzdGFuY2VJbmRleC5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgbGlzdC5jdXJyZW50RW50cnkgPSBsaXN0LmRpc3RhbmNlSW5kZXhbaSsxXTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaXN0LmN1cnJlbnRFbnRyeS5pdGVtO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwcmV2aW91c0l0ZW0obGlzdCkge1xyXG4gICAgdmFyIGkgPSBsaXN0LmRpc3RhbmNlSW5kZXguaW5kZXhPZihsaXN0LmN1cnJlbnRFbnRyeSk7XHJcbiAgICBpZiAoIGkgPiAwICkge1xyXG4gICAgICAgIGxpc3QuY3VycmVudEVudHJ5ID0gbGlzdC5kaXN0YW5jZUluZGV4W2ktMV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbGlzdC5jdXJyZW50RW50cnkuaXRlbTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGlzdGFuY2VTb3J0KGEsYikge1xyXG4gICAgcmV0dXJuIGEuZGlzdGFuY2UgLSBiLmRpc3RhbmNlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBsZW5ndGgoaXRlbXMpIHtcclxuICAgIHJldHVybiBpdGVtcy5sZW5ndGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEl0ZW0oaXRlbXMsIGkpIHtcclxuICAgIHJldHVybiBpdGVtc1tpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gYWRkSXRlbShsaXN0LCBuZXdJdGVtLCBpdGVtcykge1xyXG4gICAgdmFyIGRpc3RhbmNlID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KGxpc3QuY2VudGVySXRlbS5wb3NpdGlvbikuc3ViKG5ld0l0ZW0ucG9zaXRpb24pLmxlbmd0aFNxKCk7XHJcbiAgICBpZiAoIG5ld0l0ZW0gIT0gbGlzdC5jZW50ZXJJdGVtICkge1xyXG4gICAgICAgIGl0ZW1zLnB1c2gobmV3SXRlbSk7XHJcbiAgICB9XHJcbiAgICB2YXIgZW50cnkgID0ge1xyXG4gICAgICAgIGl0ZW06IG5ld0l0ZW0sXHJcbiAgICAgICAgZGlzdGFuY2U6IGRpc3RhbmNlXHJcbiAgICB9XHJcblxyXG4gICAgbGlzdC5kaXN0YW5jZUluZGV4LnB1c2goZW50cnkpO1xyXG4gICAgbGlzdC5kaXN0YW5jZUluZGV4LnNvcnQoZGlzdGFuY2VTb3J0KVxyXG5cclxuICAgIHJldHVybiBlbnRyeTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdExpc3QoaXRlbSl7XHJcbiAgICB2YXIgaXRlbXMgPSBbXTtcclxuICAgIHZhciBsaXN0ID0ge1xyXG4gICAgICAgIGNlbnRlckl0ZW06IGl0ZW0sXHJcbiAgICAgICAgZGlzdGFuY2VJbmRleDogW10sXHJcbiAgICAgICAgYWRkSXRlbTogZnVuY3Rpb24obmV3SXRlbSl7IHJldHVybiBhZGRJdGVtKGxpc3QsIG5ld0l0ZW0sIGl0ZW1zKSB9LFxyXG4gICAgICAgIG5leHRJdGVtOiBmdW5jdGlvbigpIHtyZXR1cm4gbmV4dEl0ZW0obGlzdCk7IH0sXHJcbiAgICAgICAgcHJldmlvdXNJdGVtOiBmdW5jdGlvbigpIHtyZXR1cm4gcHJldmlvdXNJdGVtKGxpc3QpOyB9LFxyXG4gICAgICAgIGN1cnJlbnRFbnRyeTogbnVsbCxcclxuICAgICAgICBsZW5ndGg6IGZ1bmN0aW9uKCl7cmV0dXJuIGxlbmd0aChpdGVtcyk7fSxcclxuICAgICAgICBnZXRJdGVtOiBmdW5jdGlvbihpKXtyZXR1cm4gZ2V0SXRlbShpdGVtcyxpKTt9XHJcbiAgICB9O1xyXG4gICAgbGlzdC5jdXJyZW50RW50cnkgPSBsaXN0LmFkZEl0ZW0oaXRlbSk7XHJcbiAgICByZXR1cm4gbGlzdDtcclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGluaXRMaXN0OiBpbml0TGlzdFxyXG59OyIsInZhciBHID0gLjAwMDAwNTtcclxudmFyIEMgPSAxOyAvL3RoZSBzcGVlZCBhdCB3aGljaCBpbmZvcm1hdGlvbiB0cmF2ZWxzXHJcbnZhciBPbmVTaXh0aCA9IDEvNjtcclxuXHJcbmZ1bmN0aW9uIGFkZFBoeXNpY3NQcm9wZXJ0aWVzKG9iamVjdCwga2VlcEhpc3RvcnkpIHtcclxuICAgIGlmICgga2VlcEhpc3RvcnkgPT0gdW5kZWZpbmVkICkge1xyXG4gICAgICAgIGtlZXBIaXN0b3J5ID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIGlmICggIW9iamVjdC5wb3NpdGlvbiApIHtcclxuICAgICAgICBvYmplY3QucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG4gICAgfVxyXG5cclxuICAgIG9iamVjdC5pbnZNYXNzO1xyXG4gICAgb2JqZWN0LnNldE1hc3MgPSBmdW5jdGlvbih2YWx1ZSl7XHJcbiAgICAgICAgb2JqZWN0Lmludk1hc3MgPSAxL3ZhbHVlO1xyXG4gICAgfVxyXG4gICAgb2JqZWN0LnNldE1hc3MoMSk7XHJcblxyXG4gICAgb2JqZWN0Lm1hc3MgPSBmdW5jdGlvbigpe3JldHVybiAxL29iamVjdC5pbnZNYXNzOyB9XHJcblxyXG4gICAgb2JqZWN0Lm4gPSAxO1xyXG4gICAgb2JqZWN0LnggPSBbb2JqZWN0LnBvc2l0aW9uLCBvYmplY3QucG9zaXRpb25dOyAgICAgIC8vYXJyYXkgb2YgcG9zaXRpb25zXHJcbiAgICBvYmplY3QudiA9IFtuZXcgVEhSRUUuVmVjdG9yMygpLCBuZXcgVEhSRUUuVmVjdG9yMygpXTsgICAgICAvL2FycmF5IG9mIHZlbG9jaXRpZXNcclxuICAgIG9iamVjdC5hID0gW25ldyBUSFJFRS5WZWN0b3IzKCksIG5ldyBUSFJFRS5WZWN0b3IzKCldOyAgLy9hcnJheSBvZiBhY2NlbGVyYXRpb25zXHJcbiAgICBvYmplY3QuZHQgPSBbMSwgMV07XHJcblxyXG4gICAgb2JqZWN0LmlzS2VlcGluZ0hpc3RvcnkgPSBrZWVwSGlzdG9yeTtcclxuXHJcbiAgICBvYmplY3QudmVybGV0ID0gIHZlcmxldDtcclxuXHJcbiAgICBvYmplY3QudmVsb2NpdHkgPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJldHVybiBvYmplY3QudltvYmplY3Qubl07XHJcbiAgICB9O1xyXG5cclxuICAgIG9iamVjdC5wcmV2aW91c1Bvc2l0aW9uID0gZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4gb2JqZWN0Lnhbb2JqZWN0Lm4tMV07XHJcbiAgICB9XHJcblxyXG4gICAgb2JqZWN0LmFjY2VsZXJhdGlvbiA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIG9iamVjdC5hW29iamVjdC5uXTtcclxuICAgIH07XHJcblxyXG4gICAgb2JqZWN0LnBoeXNpY3NVcGRhdGUgPSBmdW5jdGlvbihkdCl7XHJcbiAgICAgICAgaWYgKCBkdCA+IDAgKSB7XHJcblxyXG4gICAgICAgICAgICB2ZXJsZXQob2JqZWN0LCBkdCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIG9iamVjdC5pc0tlZXBpbmdIaXN0b3J5ICkge1xyXG4gICAgICAgICAgICAgICAgb2JqZWN0Lm4rKztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZhciBuID0gb2JqZWN0Lm47XHJcbiAgICAgICAgICAgICAgICBvYmplY3QueFtuLTFdID0gb2JqZWN0Lnhbbl07XHJcbiAgICAgICAgICAgICAgICBvYmplY3QuYVtuLTFdID0gb2JqZWN0LmFbbl07XHJcbiAgICAgICAgICAgICAgICBvYmplY3QueFtuXSA9IG9iamVjdC54W24rMV07XHJcbiAgICAgICAgICAgICAgICBvYmplY3QuYVtuXSA9IG9iamVjdC5hW24rMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb2JqZWN0LnBvc2l0aW9uID0gb2JqZWN0Lnhbb2JqZWN0Lm5dO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZEFtb3VudChzb2xhck9iamVjdCwgYWNjZWwpIHtcclxuICAgIHNvbGFyT2JqZWN0LmFjY2VsZXJhdGlvbigpLmFkZChhY2NlbCk7XHJcbiAgICBpZiAoIHNvbGFyT2JqZWN0Lm9yYml0TGlzdCAhPSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAgdmFyIG9sID0gc29sYXJPYmplY3Qub3JiaXRMaXN0O1xyXG4gICAgICAgIHZhciBsZW4gPSBvbC5sZW5ndGgoKTtcclxuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBhZGRBbW91bnQob2wuZ2V0SXRlbShpKSwgYWNjZWwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gYXBwbHlHcmF2aXR5KG9iamVjdEEsIG9iamVjdEIsIGxvY2tBLCBsb2NrQikge1xyXG4gICAgLy9mID0gRyhNMSArIE0yKS9yc3FyXHJcbiAgICB2YXIgYSA9IGNvcHkob2JqZWN0QS5wb3NpdGlvbik7XHJcbiAgICB2YXIgYiA9IGNvcHkob2JqZWN0Qi5wb3NpdGlvbik7XHJcbiAgICB2YXIgZGlzID0gbmV3IFRIUkVFLlZlY3RvcjMoYS54IC0gYi54LCBhLnkgLSBiLnksIGEueiAtIGIueik7XHJcblxyXG4gICAgdmFyIHJzcXIgPSBjb3B5KG9iamVjdEEucG9zaXRpb24pLmRpc3RhbmNlVG9TcXVhcmVkKGNvcHkob2JqZWN0Qi5wb3NpdGlvbikpO1xyXG4gICAgdmFyIGYgPSBHICogKG9iamVjdEEubWFzcygpICsgb2JqZWN0Qi5tYXNzKCkpL3JzcXI7XHJcblxyXG4gICAgdmFyIGJUb0EgPSBjb3B5KGRpcykubXVsdGlwbHlTY2FsYXIoRyAqIG9iamVjdEEubWFzcygpL3JzcXIpO1xyXG4gICAgdmFyIGFUb0IgPSBjb3B5KGRpcykubXVsdGlwbHlTY2FsYXIoLUcgKiBvYmplY3RCLm1hc3MoKS9yc3FyKTtcclxuXHJcbiAgICBpZiAoICFsb2NrQiApIHtcclxuICAgICAgICBhZGRBbW91bnQob2JqZWN0QiwgYlRvQSk7XHJcbiAgICB9XHJcbiAgICBpZiAoICFsb2NrQSApIHtcclxuICAgICAgICBhZGRBbW91bnQob2JqZWN0QSwgYVRvQi5uZWdhdGUoKSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvcHkodikge1xyXG4gICAgcmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKHYueCwgdi55LCB2LnopO1xyXG59XHJcblxyXG5mdW5jdGlvbiB2ZXJsZXQobywgZHQpIHtcclxuICAgIHZhciBhID0gby5hO1xyXG4gICAgdmFyIHggPSBvLng7XHJcbiAgICB2YXIgbiA9IG8ubjtcclxuICAgIGFbbisxXSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbiAgICBvLmR0W25dID0gZHQ7XHJcblxyXG4gICAgdmFyIGxhc3RYID0gY29weSh4W24gLSAxXSk7XHJcbiAgICB2YXIgY3ggPSBjb3B5KHhbbl0pO1xyXG4gICAgdmFyIGFjY2VsID0gY29weShhW25dKTtcclxuICAgIHZhciBsYXN0RHQgPSBvLmR0W24tMV07XHJcbiAgICB4W24rMV0gPSBjeC5hZGQoXHJcbiAgICAgICAgY29weShjeCkuc3ViKGxhc3RYKS5tdWx0aXBseVNjYWxhcihkdC9sYXN0RHQpXHJcbiAgICApLmFkZChcclxuICAgICAgICBhY2NlbC5tdWx0aXBseVNjYWxhcihkdCAqIChsYXN0RHQgKyBsYXN0RHQpLzIpXHJcbiAgICApO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIEc6IEcsXHJcbiAgICBhZGRQaHlzaWNzUHJvcGVydGllczogYWRkUGh5c2ljc1Byb3BlcnRpZXMsXHJcbiAgICBhcHBseUdyYXZpdHk6IGFwcGx5R3Jhdml0eVxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHZhciBzaGFkZXJzSW5Qcm9ncmVzcyA9IDA7XHJcbiAgICB2YXIgcmVhZHlIYW5kbGVycyA9IFtdO1xyXG4gICAgZnVuY3Rpb24gZ290U2hhZGVyKCkge1xyXG4gICAgICAgIHNoYWRlcnNJblByb2dyZXNzLS07XHJcbiAgICAgICAgaWYgKCBzaGFkZXJzSW5Qcm9ncmVzcyA9PSAwKSB7XHJcbiAgICAgICAgICAgIHJlYWR5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldFNoYWRlcihwYXRoLCBjYWxsYmFjaykge1xyXG4gICAgICAgIGdldHRpbmdTaGFkZXIoKTtcclxuICAgICAgICAkLmdldChwYXRoLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XHJcbiAgICAgICAgICAgIGdvdFNoYWRlcigpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGdldHRpbmdTaGFkZXIoKSB7XHJcbiAgICAgICAgc2hhZGVyc0luUHJvZ3Jlc3MrKztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRSZWFkeUhhbmRsZXIoZikge1xyXG4gICAgICAgIGlmICggc2hhZGVyc0luUHJvZ3Jlc3MgPT0gMCApIHtcclxuICAgICAgICAgICAgZigpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlYWR5SGFuZGxlcnMucHVzaChmKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVhZHkoKSB7XHJcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgcmVhZHlIYW5kbGVycy5sZW5ndGg7IGkrKyApIHtcclxuICAgICAgICAgICAgcmVhZHlIYW5kbGVyc1tpXSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFkZFJlYWR5SGFuZGxlcjogYWRkUmVhZHlIYW5kbGVyLFxyXG4gICAgICAgIGdvdFNoYWRlcjogZ290U2hhZGVyLFxyXG4gICAgICAgIGdldHRpbmdTaGFkZXI6IGdldHRpbmdTaGFkZXIsXHJcbiAgICAgICAgZ2V0U2hhZGVyOiBnZXRTaGFkZXJcclxuICAgIH1cclxufSkoKTtcclxuIiwidmFyIENPTVBPU0VSID0gVEhSRUUuRWZmZWN0Q29tcG9zZXI7XG52YXIgQWN0aW9ucyAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvY29udHJvbHMvYWN0aW9ucycpO1xudmFyIGtleWJpbmRzICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL2tleWJpbmRzJyk7XG52YXIgcm90YXRlICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvY29udHJvbHMvY2FtZXJhL3JvdGF0ZScpO1xudmFyIHRyYWNrICAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS9UcmFja09iamVjdCcpO1xudmFyIHpvb20gICAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3BhcnRzL2NvbnRyb2xzL2NhbWVyYS96b29tJyk7XG52YXIgaW50ZXJzZWN0aW9uRmFjdG9yeSA9IHJlcXVpcmUoJy4vcGFydHMvY29udHJvbHMvSW50ZXJzZWN0aW9uRmluZGVyJyk7XG52YXIgb3JiaXQgICAgICAgICAgICAgICA9IHJlcXVpcmUoJ3NvbGFyL29yYml0Jyk7XG52YXIgcGxhbmV0RmFjdG9yeSAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRGYWN0b3J5Jyk7XG52YXIgcGxhbmV0Vmlld0ZhY3RvcnkgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3BsYW5ldC9wbGFuZXRWaWV3Jyk7XG52YXIgc3RhckZhY3RvcnkgICAgICAgICA9IHJlcXVpcmUoJy4vcGFydHMvdGhpbmdzL3N0YXIvc3RhckZhY3RvcnknKTtcbnZhciBzdGFyVmlld0ZhY3RvcnkgICAgID0gcmVxdWlyZSgnLi9wYXJ0cy90aGluZ3Mvc3Rhci9zdGFyVmlldycpO1xudmFyIGFjdGlvblNlbGVjdGlvbiAgICAgPSByZXF1aXJlKCcuL3BhcnRzL3VpL2NvbXBvbmVudHMvYWN0aW9uU2VsZWN0aW9uJyk7XG52YXIgYXNzZXRzICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vYXNzZXRzJyk7XG52YXIgYmxvb21TaGFkZXJGYWN0b3J5ICA9IHJlcXVpcmUoJy4vcGFydHMvc2hhZGVycy9ibG9vbS9ibG9vbScpO1xudmFyIGJsdXJTaGFkZXJGYWN0b3J5ICAgPSByZXF1aXJlKCcuL3BhcnRzL3NoYWRlcnMvYmx1ci9ibHVyJyk7XG5cbnZhciBjYW1lcmEsIHNjZW5lLCByZW5kZXJlciwgY29tcG9zZXI7XG52YXIgZGVwdGhNYXRlcmlhbDtcbnZhciBzdGFyO1xudmFyIHdpZHRoLCBoZWlnaHQ7XG52YXIgc3RhckVmZmVjdCwgYmxvb21FZmZlY3Q7XG52YXIgcGh5c2ljc0JhY2tlZFZpZXdzID0gW107XG52YXIgaW5pdE5lYXIgPSAxMDtcbnZhciBpbml0RmFyID0gMTAwMDA7XG5cbmZ1bmN0aW9uIGxvZyhtZXNzYWdlKXtcbiAgICAkKCcjY29uc29sZScpLnRleHQobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIGluaXQoZG9tQ29udGFpbmVyKSB7XG4gICAgbG9nKFwiaW5pdFwiKTtcbiAgICByZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCk7XG4gICAgcmVuZGVyZXIuYW50aWFsaWFzID0gdHJ1ZTtcbiAgICByZW5kZXJlci5zaGFkb3dNYXBFbmFibGVkID0gdHJ1ZTtcbiAgICByZW5kZXJlci5zaGFkb3dNYXBTb2Z0ID0gdHJ1ZTtcbiAgICB3aWR0aCA9IGRvbUNvbnRhaW5lci53aWR0aCgpO1xuICAgIGhlaWdodCA9IGRvbUNvbnRhaW5lci5oZWlnaHQoKTtcblxuICAgIHJlbmRlcmVyLnNldFNpemUoIHdpZHRoLCBoZWlnaHQgKTtcbiAgICBkb21Db250YWluZXIuYXBwZW5kKCByZW5kZXJlci5kb21FbGVtZW50ICk7XG5cbiAgICBjYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDY1LCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgaW5pdE5lYXIsIGluaXRGYXIgKTtcbiAgICBjYW1lcmEucG9zaXRpb24ueSA9IDI1MDtcbiAgICBjYW1lcmEucG9zaXRpb24ueiA9IDQwMDtcblxuICAgIHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cbiAgICBsb2FkU2t5Ym94KCk7XG5cbiAgICBzdGFyID0gc3RhclZpZXdGYWN0b3J5Lm1ha2VTdGFyVmlldyhzdGFyRmFjdG9yeS5nZXRTdGFyKCkpO1xuICAgIG9yYml0LmFkZEFiaWxpdHlUb0JlT3JiaXRlZChzdGFyKTtcbiAgICBzY2VuZS5hZGQoc3Rhcik7XG5cbiAgICBhZGRQbGFuZXQobmV3IFRIUkVFLlZlY3RvcjMoMzAwLDAsMCksIHN0YXIpO1xuXG4gICAgc2NlbmUuYWRkKHN0YXIubGlnaHQpO1xuICAgIHNjZW5lLmFkZChzdGFyLmJhY2tncm91bmRQYXJ0aWNsZXMpO1xuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHN0YXIucmFkaWFsUGFydGljbGVzRW1pdHRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHN5cyA9IHN0YXIucmFkaWFsUGFydGljbGVzRW1pdHRlcnNbaV07XG4gICAgICAgIHNjZW5lLmFkZChzeXMpO1xuICAgIH1cblxuICAgIHNldHVwUG9zdHByb2Nlc3NpbmdFZmZlY3RzKHJlbmRlcik7XG5cbiAgICBvbldpbmRvd1Jlc2l6ZShudWxsKTtcblxuICAgIHNldHVwQWN0aW9ucyhkb21Db250YWluZXIpO1xuXG4gICAgY2FtZXJhLnRyYWNrZWRPYmplY3QgPSBzdGFyO1xufVxuXG5mdW5jdGlvbiBzZXR1cFBvc3Rwcm9jZXNzaW5nRWZmZWN0cygpe1xuICAgIGNvbXBvc2VyID0gbmV3IENPTVBPU0VSKCByZW5kZXJlciApO1xuICAgIHZhciBjYW1lcmFQYXNzID0gbmV3IFRIUkVFLlJlbmRlclBhc3MoIHNjZW5lLCBjYW1lcmEgKTtcbiAgICBjb21wb3Nlci5hZGRQYXNzKGNhbWVyYVBhc3MpO1xuXG4gICAgLy93ZSB3cml0ZSBkZXB0aCB0byBhIHRleHR1cmUgc28gd2UgY2FuIHVzZSBpdCBsYXRlclxuICAgIHZhciBkZXB0aFNoYWRlciA9IFRIUkVFLlNoYWRlckxpYlsgXCJkZXB0aFJHQkFcIiBdO1xuICAgIHZhciBkZXB0aFVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5jbG9uZSggZGVwdGhTaGFkZXIudW5pZm9ybXMgKTtcblxuICAgIGRlcHRoTWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoIHsgZnJhZ21lbnRTaGFkZXI6IGRlcHRoU2hhZGVyLmZyYWdtZW50U2hhZGVyLCB2ZXJ0ZXhTaGFkZXI6IGRlcHRoU2hhZGVyLnZlcnRleFNoYWRlciwgdW5pZm9ybXM6IGRlcHRoVW5pZm9ybXMgfSApO1xuICAgIGRlcHRoTWF0ZXJpYWwuYmxlbmRpbmcgPSBUSFJFRS5Ob0JsZW5kaW5nO1xuXG4gICAgdmFyIGRlcHRoUGFyYW1zID0geyBtaW5GaWx0ZXI6IFRIUkVFLk5lYXJlc3RGaWx0ZXIsIG1hZ0ZpbHRlcjogVEhSRUUuTmVhcmVzdEZpbHRlciwgZm9ybWF0OiBUSFJFRS5SR0JBRm9ybWF0IH07XG4gICAgZGVwdGhUYXJnZXQgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJUYXJnZXQoIHdpZHRoLCBoZWlnaHQsIGRlcHRoUGFyYW1zICk7XG5cbiAgICB2YXIgYmxvb21TaGFkZXIgPSBibG9vbVNoYWRlckZhY3RvcnkuaW5zdGFuY2UoKTtcbiAgICBibG9vbUVmZmVjdCA9IG5ldyBUSFJFRS5TaGFkZXJQYXNzKCBibG9vbVNoYWRlciApO1xuICAgIGJsb29tRWZmZWN0LnVuaWZvcm1zWyd0U2l6ZSddLnZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIod2lkdGgsIGhlaWdodCk7XG5cbiAgICB2YXIgc2hhZGVyID0gYmx1clNoYWRlckZhY3RvcnkuaW5zdGFuY2UoKTtcblxuICAgIHZhciBlZmZlY3QgPSBuZXcgVEhSRUUuU2hhZGVyUGFzcyggc2hhZGVyICk7XG4gICAgZWZmZWN0LnVuaWZvcm1zWyd0RGVwdGgnXS52YWx1ZSA9IGRlcHRoVGFyZ2V0O1xuICAgIGVmZmVjdC51bmlmb3Jtc1snc2NhbGUnXS52YWx1ZSA9IDQ7XG4gICAgZWZmZWN0LnVuaWZvcm1zWyd0U2l6ZSddLnZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIod2lkdGgsIGhlaWdodCk7XG4gICAgZWZmZWN0LnVuaWZvcm1zWydjYW1lcmFOZWFyJ10udmFsdWUgPSBjYW1lcmEubmVhcjtcbiAgICBlZmZlY3QudW5pZm9ybXNbJ2NhbWVyYUZhciddLnZhbHVlID0gY2FtZXJhLmZhcjtcblxuICAgIHZhciBvcmRlciA9IFtcbiAgICAgICAgYmxvb21FZmZlY3QsXG4gICAgICAgIGVmZmVjdCxcbiAgICBdO1xuXG4gICAgZm9yICggdmFyIGkgPSAwOyBpIDwgb3JkZXIubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGNvbXBvc2VyLmFkZFBhc3Mob3JkZXJbaV0pO1xuICAgIH1cblxuICAgIG9yZGVyW29yZGVyLmxlbmd0aC0xXS5yZW5kZXJUb1NjcmVlbiA9IHRydWU7XG5cbiAgICBzdGFyRWZmZWN0ID0gZWZmZWN0O1xufVxuXG5cbmZ1bmN0aW9uIHNldHVwQWN0aW9ucyhkb21Db250YWluZXIpe1xuICAgIHZhciBpbnRlcnNlY3Rpb25GaW5kZXIgPSBpbnRlcnNlY3Rpb25GYWN0b3J5LmluaXQoJChyZW5kZXJlci5kb21FbGVtZW50KSwgY2FtZXJhKTtcbiAgICB2YXIgYWN0aW9ucyA9IEFjdGlvbnMuaW5pdChjYW1lcmEsIHN0YXIsIGFkZFBsYW5ldCwgaW50ZXJzZWN0aW9uRmluZGVyKTtcbiAgICBpbnRlcnNlY3Rpb25GaW5kZXIuc2V0QWN0aW9uKGFjdGlvbnNbMF0uaGFuZGxlcik7XG5cbiAgICBhY3Rpb25TZWxlY3Rpb24uZW5hYmxlKGRvbUNvbnRhaW5lciwgYWN0aW9ucyk7XG59XG5cblxuZnVuY3Rpb24gbG9hZFNreWJveCgpIHtcbiAgICB2YXIgc2t5ID0gJ2ltYWdlcy9za3kvc2t5Xyc7XG4gICAgdmFyIHVybHMgPSBbXG4gICAgICAgIHNreSsncmlnaHQxLnBuZycsXG4gICAgICAgIHNreSsnbGVmdDIucG5nJyxcbiAgICAgICAgc2t5Kyd0b3AzLnBuZycsXG4gICAgICAgIHNreSsnYm90dG9tNC5wbmcnLFxuICAgICAgICBza3krJ2Zyb250NS5wbmcnLFxuICAgICAgICBza3krJ2JhY2s2LnBuZydcbiAgICBdO1xuXG4gICAgdmFyIGN1YmVtYXAgPSBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlQ3ViZSh1cmxzKTsgLy8gbG9hZCB0ZXh0dXJlc1xuICAgIGN1YmVtYXAuZm9ybWF0ID0gVEhSRUUuUkdCRm9ybWF0O1xuXG4gICAgdmFyIHNoYWRlciA9IFRIUkVFLlNoYWRlckxpYlsnY3ViZSddOyAvLyBpbml0IGN1YmUgc2hhZGVyIGZyb20gYnVpbHQtaW4gbGliXG4gICAgc2hhZGVyLnVuaWZvcm1zWyd0Q3ViZSddLnZhbHVlID0gY3ViZW1hcDsgLy8gYXBwbHkgdGV4dHVyZXMgdG8gc2hhZGVyXG5cbiAgICAvLyBjcmVhdGUgc2hhZGVyIG1hdGVyaWFsXG4gICAgdmFyIHNreUJveE1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKCB7XG4gICAgICAgIGZyYWdtZW50U2hhZGVyOiBzaGFkZXIuZnJhZ21lbnRTaGFkZXIsXG4gICAgICAgIHZlcnRleFNoYWRlcjogc2hhZGVyLnZlcnRleFNoYWRlcixcbiAgICAgICAgdW5pZm9ybXM6IHNoYWRlci51bmlmb3JtcyxcbiAgICAgICAgZGVwdGhXcml0ZTogZmFsc2UsXG4gICAgICAgIHNpZGU6IFRIUkVFLkJhY2tTaWRlXG4gICAgfSk7XG5cbiAgICAvLyBjcmVhdGUgc2t5Ym94IG1lc2hcbiAgICB2YXIgc2t5Ym94ID0gbmV3IFRIUkVFLk1lc2goXG4gICAgICAgIG5ldyBUSFJFRS5DdWJlR2VvbWV0cnkoNjAwMDAsIDYwMDAwLCA2MDAwMCksXG4gICAgICAgIHNreUJveE1hdGVyaWFsXG4gICAgKTtcblxuICAgIHNjZW5lLmFkZChza3lib3gpO1xufVxuXG5mdW5jdGlvbiBtYWtlUGxhbmV0VmlldyhwbGFuZXQpIHtcbiAgICB2YXIgdmlldyA9IHBsYW5ldFZpZXdGYWN0b3J5Lm1ha2VQbGFuZXRWaWV3KHBsYW5ldCk7XG4gICAgcGh5c2ljc0JhY2tlZFZpZXdzLnB1c2godmlldyk7XG4gICAgc2NlbmUuYWRkKHZpZXcpO1xufVxuXG5mdW5jdGlvbiBhZGRQbGFuZXQocG9zaXRpb24sIHRoaW5nVG9PcmJpdCkge1xuICAgIHZhciBwbGFuZXQgPSBwbGFuZXRGYWN0b3J5LmdldFBsYW5ldChwb3NpdGlvbiwgdGhpbmdUb09yYml0KTtcbiAgICBtYWtlUGxhbmV0VmlldyhwbGFuZXQpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGxhbmV0Lm1vb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG1ha2VQbGFuZXRWaWV3KHBsYW5ldC5tb29uc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBwbGFuZXQ7XG59XG5cbmZ1bmN0aW9uIG9uV2luZG93UmVzaXplKCBldmVudCApIHtcblxucmVuZGVyZXIuc2V0U2l6ZSggd2lkdGgsIGhlaWdodCApO1xuXG5jYW1lcmEuYXNwZWN0ID0gd2lkdGggLyBoZWlnaHQ7XG5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuXG59XG5cbmZ1bmN0aW9uIGFuaW1hdGUoKSB7XG5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGFuaW1hdGUgKTtcbnJlbmRlcigpO1xufVxuXG5mdW5jdGlvbiByZW5kZXIoKSB7XG5cbiAgdmFyIGR0ID0gMTsvL2Nsb2NrLmdldERlbHRhKCk7XG5cbiAgc3Rhci5yZWN1cnNpdmVQaHlzaWNzVXBkYXRlKGR0KTtcbiAgZm9yICggdmFyIGkgPSAwOyBpIDwgcGh5c2ljc0JhY2tlZFZpZXdzLmxlbmd0aDsgaSsrICkge1xuICAgICAgcGh5c2ljc0JhY2tlZFZpZXdzW2ldLnVwZGF0ZSgpO1xuICB9XG5cbiAgdmFyIGNvbG9yID0gc3Rhci52aWV3VXBkYXRlKGR0LCBjYW1lcmEsIG5ldyBUSFJFRS5WZWN0b3IyKHdpZHRoLGhlaWdodCksIHN0YXJFZmZlY3QpO1xuICBzdGFyRWZmZWN0LnVuaWZvcm1zW1wic3RhckNvbG9yXCJdLnZhbHVlID0gY29sb3I7XG4gIGJsb29tRWZmZWN0LnVuaWZvcm1zW1wiYmxvb21Db2xvclwiXS52YWx1ZSA9IGNvbG9yO1xuXG4gIGlmICggY2FtZXJhLnRyYW5zaXRpb24gKSB7XG4gICAgdmFyIHQgPSBjYW1lcmEudHJhbnNpdGlvbjtcbiAgICB2YXIgbyA9IGNhbWVyYS50cmFuc2l0aW9uLm9yaWdpbmFsO1xuICAgIGNhbWVyYS5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKG8ueCwgby55LCBvLnopLmxlcnAoY2FtZXJhLnRyYW5zaXRpb24udGFyZ2V0LCB0LmVsYXBzZWQvIHQuZHVyYXRpb24pO1xuICAgIHQuZWxhcHNlZCsrO1xuICAgIGlmICggdC5lbGFwc2VkID4gdC5kdXJhdGlvbiApIHtcbiAgICAgICAgY2FtZXJhLnRyYW5zaXRpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJvdGF0ZS51cGRhdGVSb3RhdGlvbihjYW1lcmEpO1xuICB0cmFjay51cGRhdGUoY2FtZXJhKTtcbiAgem9vbS51cGRhdGVab29tKGNhbWVyYSk7XG5cbiAgY2FtZXJhLmxvb2tBdChjYW1lcmEudGFyZ2V0KTtcblxuICBzY2VuZS5vdmVycmlkZU1hdGVyaWFsID0gZGVwdGhNYXRlcmlhbDtcbiAgcmVuZGVyZXIucmVuZGVyKCBzY2VuZSwgY2FtZXJhLCBkZXB0aFRhcmdldCk7XG4gIHNjZW5lLm92ZXJyaWRlTWF0ZXJpYWwgPSBudWxsO1xuICBzdGFyRWZmZWN0LnVuaWZvcm1zW1widGltZVwiXS52YWx1ZSArPSAuMDAxO1xuXG4gIGNvbXBvc2VyLnJlbmRlcigpO1xufVxuXG5hc3NldHMuYWRkUmVhZHlIYW5kbGVyKGZ1bmN0aW9uKCl7XG4gICAgaW5pdCgkKCcjZ2FtZScpKTtcbiAgICBhbmltYXRlKCk7XG5cbn0pOyIsImV4cG9ydHMuY29uZmlnU2F0ZWxsaXRlID0gZnVuY3Rpb24odGhpbmdUb09yYml0LCBzYXRlbGxpdGVGYWN0b3J5KXtcclxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24oaW50ZXJzZWN0aW9uKXtcclxuICAgICAgICBzYXRlbGxpdGVGYWN0b3J5KGludGVyc2VjdGlvbiwgdGhpbmdUb09yYml0KTtcclxuICAgIH1cclxuICAgIHJldHVybiBoYW5kbGVyO1xyXG59O1xyXG5cclxuIiwidmFyIGludGVyc2VjdGlvbkhhbmRsZXI7XHJcbnZhciBwcm9qZWN0b3IgPSBuZXcgVEhSRUUuUHJvamVjdG9yKCk7XHJcblxyXG5mdW5jdGlvbiBzZXRBY3Rpb24oaGFuZGxlcikge1xyXG4gICAgaW50ZXJzZWN0aW9uSGFuZGxlciA9IGhhbmRsZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGluaXQoZG9tQ29udGFpbmVyLCBjYW1lcmEsIG5vcm1hbCkge1xyXG5cclxuICAgIGlmICggIW5vcm1hbCApIHtcclxuICAgICAgICBub3JtYWwgPSBuZXcgVEhSRUUuVmVjdG9yMygwLC0xLDApO1xyXG4gICAgfVxyXG4gICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgICAgIHZhciB2ZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMyhcclxuICAgICAgICAgICAgKCBldmVudC5jbGllbnRYIC8gZG9tQ29udGFpbmVyLndpZHRoKCkgKSAqIDIgLSAxLFxyXG4gICAgICAgICAgICAtICggZXZlbnQuY2xpZW50WSAvIGRvbUNvbnRhaW5lci5oZWlnaHQoKSApICogMiArIDEsXHJcbiAgICAgICAgICAgIDAuNVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgcHJvamVjdG9yLnVucHJvamVjdFZlY3RvciggdmVjdG9yLCBjYW1lcmEgKTtcclxuXHJcbiAgICAgICAgdmFyIHJheSA9IG5ldyBUSFJFRS5SYXkoIGNhbWVyYS5wb3NpdGlvbixcclxuICAgICAgICAgICAgdmVjdG9yLnN1YiggY2FtZXJhLnBvc2l0aW9uICkubm9ybWFsaXplKCkgKTtcclxuICAgICAgICB2YXIgcGxhbmUgPSBuZXcgVEhSRUUuUGxhbmUobm9ybWFsLCAwKTtcclxuXHJcbiAgICAgICAgdmFyIGludGVyc2VjdGlvbiA9IHJheS5pbnRlcnNlY3RQbGFuZShwbGFuZSk7XHJcbiAgICAgICAgaWYgKCBpbnRlcnNlY3Rpb24gKSB7XHJcbiAgICAgICAgICAgIGludGVyc2VjdGlvbkhhbmRsZXIoaW50ZXJzZWN0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZG9tQ29udGFpbmVyWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGhhbmRsZXIsIGZhbHNlICk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHNldEFjdGlvbjogc2V0QWN0aW9uLFxyXG4gICAgICAgIGRpc2FibGU6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGRvbUNvbnRhaW5lclswXS5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHJcbiAgICBpbml0OiBpbml0XHJcbn07IiwidmFyIG51bUZyYW1lcyA9IDIwO1xyXG5cclxuZXhwb3J0cy5jYW1lcmFNb3ZlbWVudEFjdGlvbiA9IGZ1bmN0aW9uKGNhbWVyYSl7XHJcbiAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uKGludGVyc2VjdGlvbil7XHJcbiAgICAgICAgdmFyIHRhcmdldCA9IG5ldyBUSFJFRS5WZWN0b3IzKGludGVyc2VjdGlvbi54LCBjYW1lcmEucG9zaXRpb24ueSwgaW50ZXJzZWN0aW9uLnopO1xyXG4gICAgICAgIGNhbWVyYS50cmFuc2l0aW9uID0ge1xyXG4gICAgICAgICAgICBvcmlnaW5hbDogY2FtZXJhLnBvc2l0aW9uLFxyXG4gICAgICAgICAgICB0YXJnZXQ6IHRhcmdldCxcclxuICAgICAgICAgICAgZHVyYXRpb246IG51bUZyYW1lcyxcclxuICAgICAgICAgICAgZWxhcHNlZDogMFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBoYW5kbGVyO1xyXG59OyIsInZhciBhZGRTYXRlbGxpdGUgICAgPSByZXF1aXJlKCcuL0FkZFNhdGVsbGl0ZScpLFxyXG4gICAgbW92ZUNhbWVyYSAgICAgID0gcmVxdWlyZSgnLi9Nb3ZlQ2FtZXJhJyksXHJcbiAgICByb3RhdGUgICAgICAgICAgPSByZXF1aXJlKCcuL2NhbWVyYS9yb3RhdGUnKSxcclxuICAgIHpvb20gICAgICAgICAgICA9IHJlcXVpcmUoJy4vY2FtZXJhL3pvb20nKSxcclxuICAgIHRyYWNrICAgICAgICAgICA9IHJlcXVpcmUoJy4vY2FtZXJhL1RyYWNrT2JqZWN0Jyk7XHJcblxyXG52YXIgY2FtZXJhQWN0aW9uO1xyXG52YXIgc2F0ZWxsaXRlQWN0aW9uO1xyXG52YXIgcm90YXRpb25BY3Rpb25zLCB6b29tQWN0aW9ucztcclxudmFyIHRyYWNrT2JqZWN0QWN0aW9ucztcclxudmFyIG9uUmVhZHlDYWxsYmFja3MgPSBbXTtcclxudmFyIGlzUmVhZHkgPSBmYWxzZTtcclxuXHJcbmZ1bmN0aW9uIGdldENhbWVyYUFjdGlvbigpIHtcclxuICAgIHJldHVybiBjYW1lcmFBY3Rpb247XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFNhdGVsbGl0ZUFjdGlvbigpIHtcclxuICAgIHJldHVybiBzYXRlbGxpdGVBY3Rpb247XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkQWN0aW9ucyhjYW1lcmEsIHN0YXIsIGFkZE1vb24sIGNsaWNrSGFuZGxlcikge1xyXG4gICAgLy9hZGQgY29udHJvbHNcclxuXHJcbiAgICBzYXRlbGxpdGVBY3Rpb24gICAgID0gYWRkU2F0ZWxsaXRlLmNvbmZpZ1NhdGVsbGl0ZShzdGFyLCBhZGRNb29uKTtcclxuICAgIGNhbWVyYUFjdGlvbiAgICAgICAgPSBtb3ZlQ2FtZXJhLmNhbWVyYU1vdmVtZW50QWN0aW9uKGNhbWVyYSk7XHJcbiAgICByb3RhdGlvbkFjdGlvbnMgICAgID0gcm90YXRlLmJ1aWxkQWN0aW9ucyhjYW1lcmEpO1xyXG4gICAgdHJhY2tPYmplY3RBY3Rpb25zICA9IHRyYWNrLmJ1aWxkQWN0aW9ucyhjYW1lcmEsIHN0YXIub3JiaXRMaXN0KTtcclxuICAgIHpvb21BY3Rpb25zICAgICAgICAgPSB6b29tLmJ1aWxkQWN0aW9ucyhjYW1lcmEpO1xyXG5cclxuICAgIHZhciBhY3Rpb25zID0gW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWQ6ICdhY3Rpb24tcGxhY2VTYXRlbGxpdGUnLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBmdW5jdGlvbigpe2NsaWNrSGFuZGxlci5zZXRBY3Rpb24oc2F0ZWxsaXRlQWN0aW9uKX0sXHJcbiAgICAgICAgICAgIGNvbG9yOiAncmdiYSgyNTUsIDAsIDAsIDAuNSknLFxyXG4gICAgICAgICAgICBuYW1lOiAnUGxhY2UgU2F0ZWxsaXRlJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZDogJ2FjdGlvbi1tb3ZlQ2FtZXJhJyxcclxuICAgICAgICAgICAgaGFuZGxlcjogZnVuY3Rpb24oKXtjbGlja0hhbmRsZXIuc2V0QWN0aW9uKGNhbWVyYUFjdGlvbil9LFxyXG4gICAgICAgICAgICBjb2xvcjogJ3JnYmEoMCwgMjU1LCAwLCAwLjUpJyxcclxuICAgICAgICAgICAgbmFtZTogJ1JlcG9zaXRpb24gQ2FtZXJhJ1xyXG4gICAgICAgIH1cclxuICAgIF07XHJcblxyXG4gICAgaXNSZWFkeSA9IHRydWU7XHJcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBvblJlYWR5Q2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgb25SZWFkeUNhbGxiYWNrc1tpXSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY3Rpb25zO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGluaXQ6IGJ1aWxkQWN0aW9ucyxcclxuICAgIGdldENhbWVyYUFjdGlvbjogZ2V0Q2FtZXJhQWN0aW9uLFxyXG4gICAgZ2V0U2F0ZWxsaXRlQWN0aW9uOiBnZXRTYXRlbGxpdGVBY3Rpb24sXHJcbiAgICB0cmFja09iamVjdEFjdGlvbnM6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJhY2tPYmplY3RBY3Rpb25zIH0sXHJcbiAgICByb3RhdGlvbkFjdGlvbnM6IGZ1bmN0aW9uKCl7IHJldHVybiByb3RhdGlvbkFjdGlvbnMgfSxcclxuICAgIHpvb21BY3Rpb25zOiBmdW5jdGlvbigpeyByZXR1cm4gem9vbUFjdGlvbnMgfSxcclxuICAgIG9uUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrKXtcclxuICAgICAgICBpZiAoIGlzUmVhZHkgKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb25SZWFkeUNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJmdW5jdGlvbiBzZXRUYXJnZXQoY2FtZXJhLCB0YXJnZXQpIHtcclxuICAgIGNhbWVyYS50cmFja2VkT2JqZWN0ID0gdGFyZ2V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZEFjdGlvbnMoY2FtZXJhLCBvcmJpdExpc3QpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdHJhY2tOZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2V0VGFyZ2V0KGNhbWVyYSwgb3JiaXRMaXN0Lm5leHRJdGVtKCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHJhY2tQcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHNldFRhcmdldChjYW1lcmEsIG9yYml0TGlzdC5wcmV2aW91c0l0ZW0oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGUoY2FtKSB7XHJcbiAgICBpZiAoIGNhbS50cmFja2VkT2JqZWN0ICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW0udGFyZ2V0ID0gY2FtLnRyYWNrZWRPYmplY3QucG9zaXRpb247XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYnVpbGRBY3Rpb25zOiBidWlsZEFjdGlvbnMsXHJcbiAgICB1cGRhdGU6IHVwZGF0ZVxyXG59OyIsInZhciBpbnB1dE11bHRpcGxpZXIgPSAyO1xyXG5cclxudmFyIGxlZnQgPSAtMTtcclxudmFyIHJpZ2h0ID0gMTtcclxuXHJcbnZhciBpc1JvdGF0aW5nTGVmdCA9IGZhbHNlO1xyXG52YXIgaXNSb3RhdGluZ1JpZ2h0ID0gZmFsc2U7XHJcblxyXG5mdW5jdGlvbiBidWlsZEFjdGlvbnMoY2FtZXJhKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHJvdGF0ZUxlZnQ6IGZ1bmN0aW9uKCl7IGlzUm90YXRpbmdMZWZ0ID0gdHJ1ZSB9LFxyXG4gICAgICAgIHJvdGF0ZVJpZ2h0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nUmlnaHQgPSB0cnVlIH0sXHJcbiAgICAgICAgc3RvcFJvdGF0ZVJpZ2h0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nUmlnaHQgPSBmYWxzZSB9LFxyXG4gICAgICAgIHN0b3BSb3RhdGVMZWZ0OiBmdW5jdGlvbigpeyBpc1JvdGF0aW5nTGVmdCA9IGZhbHNlIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc3RvcFJvdGF0ZUFjdGlvbihkaXIsIGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEucm90YXRpb25WYWx1ZSAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAoKGRpciA+IDAgJiYgY2FtZXJhLnJvdGF0aW9uVmFsdWUgPiAwKSB8fFxyXG4gICAgICAgICAoZGlyIDwgMCAmJiBjYW1lcmEucm90YXRpb25WYWx1ZSA8IDAgKSkpIHtcclxuXHJcbiAgICAgICAgY2FtZXJhLnJvdGF0aW9uVmFsdWUgKj0gLjM1O1xyXG5cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcm90YXRlQWN0aW9uKGRpciwgY2FtZXJhKSB7XHJcbiAgICBpZiAoIGNhbWVyYS5yb3RhdGlvblZhbHVlID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEucm90YXRpb25WYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbiAgICB9XHJcbiAgICBjYW1lcmEucm90YXRpb25WYWx1ZSArPSBkaXIgKiBpbnB1dE11bHRpcGxpZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZVJvdGF0aW9uKGNhbSkge1xyXG4gICAgaWYgKCBpc1JvdGF0aW5nTGVmdCApIHtcclxuICAgICAgICByb3RhdGVBY3Rpb24obGVmdCwgY2FtKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3RvcFJvdGF0ZUFjdGlvbihsZWZ0LCBjYW0pO1xyXG4gICAgfVxyXG4gICAgaWYgKCBpc1JvdGF0aW5nUmlnaHQgKSB7XHJcbiAgICAgICAgcm90YXRlQWN0aW9uKHJpZ2h0LCBjYW0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBzdG9wUm90YXRlQWN0aW9uKHJpZ2h0LCBjYW0pO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB2MyA9IFRIUkVFLlZlY3RvcjM7XHJcbiAgICB2YXIgdXAgPSBuZXcgdjMoMCwxLDApO1xyXG4gICAgaWYgKCBjYW0ucm90YXRpb25WYWx1ZSAhPSB1bmRlZmluZWQgJiYgTWF0aC5hYnMoY2FtLnJvdGF0aW9uVmFsdWUpID4gLjUgKSB7XHJcbiAgICAgICAgdmFyIGNwID0gbmV3IHYzKCkuY29weShjYW0ucG9zaXRpb24pO1xyXG4gICAgICAgIHZhciBjZW50ZXIgPSBuZXcgdjMoKS5jb3B5KGNhbS50YXJnZXQpO1xyXG4gICAgICAgIGNlbnRlci55ID0gY3AueTtcclxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBuZXcgdjMoKS5zdWJWZWN0b3JzKGNwLCBjZW50ZXIpO1xyXG4gICAgICAgIHZhciBsZW4gPSBkaXN0YW5jZS5sZW5ndGgoKTtcclxuICAgICAgICB2YXIgZGlyZWN0aW9uRnJvbUNlbnRlciA9IGRpc3RhbmNlLm5vcm1hbGl6ZSgpO1xyXG4gICAgICAgIHZhciBkaXJYWiA9IGRpcmVjdGlvbkZyb21DZW50ZXIuY3Jvc3ModXApO1xyXG4gICAgICAgIHZhciBkaXNwbGFjZW1lbnQgPSBkaXJYWi5tdWx0aXBseVNjYWxhcihjYW0ucm90YXRpb25WYWx1ZSk7XHJcbiAgICAgICAgdmFyIG5ld1BvcyA9IG5ldyB2MygpLmFkZFZlY3RvcnMoY3AsIGRpc3BsYWNlbWVudCk7XHJcbiAgICAgICAgdmFyIGFkanVzdGVkUG9zID0gbmV3IHYzKCkuc3ViVmVjdG9ycyhuZXdQb3MsIGNlbnRlcikuc2V0TGVuZ3RoKGxlbik7XHJcbiAgICAgICAgY2FtLnBvc2l0aW9uID0gbmV3IHYzKCkuYWRkVmVjdG9ycyhjZW50ZXIsIGFkanVzdGVkUG9zKTtcclxuXHJcbiAgICAgICAgY2FtLnJvdGF0aW9uVmFsdWUgKj0gLjk4O1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgY2FtLnJvdGF0aW9uVmFsdWUgPSAwO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGJ1aWxkQWN0aW9uczogYnVpbGRBY3Rpb25zLFxyXG4gICAgdXBkYXRlUm90YXRpb246IHVwZGF0ZVJvdGF0aW9uXHJcbn07XHJcblxyXG4iLCJ2YXIgaXNab29taW5nSW4gPSBmYWxzZSxcclxuICAgIGlzWm9vbWluZ091dCA9IGZhbHNlO1xyXG5cclxudmFyIGlucHV0TXVsdGlwbGllciA9IDEuNTtcclxuXHJcbmZ1bmN0aW9uIGJ1aWxkQWN0aW9ucyhjYW1lcmEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgem9vbUluOiBmdW5jdGlvbigpeyBpc1pvb21pbmdJbiA9IHRydWUgfSxcclxuICAgICAgICB6b29tT3V0OiBmdW5jdGlvbigpeyBpc1pvb21pbmdPdXQgPSB0cnVlIH0sXHJcbiAgICAgICAgc3RvcFpvb21JbjogZnVuY3Rpb24oKXsgaXNab29taW5nSW4gPSBmYWxzZSB9LFxyXG4gICAgICAgIHN0b3Bab29tT3V0OiBmdW5jdGlvbigpeyBpc1pvb21pbmdPdXQgPSBmYWxzZSB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0b3Bab29tKGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEuem9vbVZhbHVlICE9IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEuem9vbVZhbHVlICo9IC4zNTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gem9vbUFjdGlvbihkaXIsIGNhbWVyYSkge1xyXG4gICAgaWYgKCBjYW1lcmEuem9vbVZhbHVlID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICBjYW1lcmEuem9vbVZhbHVlID0gMDtcclxuICAgIH1cclxuICAgIGNhbWVyYS56b29tVmFsdWUgKz0gZGlyICogaW5wdXRNdWx0aXBsaWVyO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gdXBkYXRlWm9vbVZhbHVlKGNhbSkge1xyXG4gICAgaWYgKCBpc1pvb21pbmdJbiAmJiAhaXNab29taW5nT3V0ICkge1xyXG4gICAgICAgIHpvb21BY3Rpb24oMSwgY2FtKTtcclxuICAgIH0gZWxzZSBpZiAoIGlzWm9vbWluZ091dCAmJiAhaXNab29taW5nSW4gKSB7XHJcbiAgICAgICAgem9vbUFjdGlvbigtMSwgY2FtKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3RvcFpvb20oY2FtKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2hhbmdlQ2FtUG9zaXRpb24oY2FtKSB7XHJcbiAgICB2YXIgdjMgPSBUSFJFRS5WZWN0b3IzO1xyXG4gICAgdmFyIHVwID0gbmV3IHYzKDAsMSwwKTtcclxuICAgIGlmICggY2FtLnpvb21WYWx1ZSAhPSB1bmRlZmluZWQgJiYgTWF0aC5hYnMoY2FtLnpvb21WYWx1ZSkgPiAuNSApIHtcclxuICAgICAgICB2YXIgY3AgPSBuZXcgdjMoKS5jb3B5KGNhbS5wb3NpdGlvbik7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IG5ldyB2MygpLmNvcHkoY2FtLnRhcmdldCkuc3ViKGNwKS5ub3JtYWxpemUoKS5tdWx0aXBseVNjYWxhcihjYW0uem9vbVZhbHVlKTtcclxuICAgICAgICB2YXIgYWRqdXN0ZWRQb3MgPSBuZXcgdjMoKS5hZGRWZWN0b3JzKG9mZnNldCwgY2FtLnBvc2l0aW9uKTtcclxuICAgICAgICBjYW0ucG9zaXRpb24gPSBhZGp1c3RlZFBvcztcclxuICAgICAgICBjYW0uem9vbVZhbHVlICo9IC45ODtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGNhbS56b29tVmFsdWUgPSAwO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVab29tKGNhbSkge1xyXG4gICAgdXBkYXRlWm9vbVZhbHVlKGNhbSk7XHJcbiAgICBjaGFuZ2VDYW1Qb3NpdGlvbihjYW0pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGJ1aWxkQWN0aW9uczogYnVpbGRBY3Rpb25zLFxyXG4gICAgdXBkYXRlWm9vbTogdXBkYXRlWm9vbVxyXG59O1xyXG4iLCJ2YXIgYWN0aW9ucyA9IHJlcXVpcmUoJy4vYWN0aW9ucycpO1xyXG5cclxuYWN0aW9ucy5vblJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgdmFyIGxpc3RlbmVyID0gbmV3IHdpbmRvdy5rZXlwcmVzcy5MaXN0ZW5lcigpO1xyXG4gICAgdmFyIHJhID0gYWN0aW9ucy5yb3RhdGlvbkFjdGlvbnMoKTtcclxuICAgIGxpc3RlbmVyLnJlZ2lzdGVyX2NvbWJvKHtcclxuICAgICAgICBrZXlzOiBcImxlZnRcIixcclxuICAgICAgICBvbl9rZXlkb3duOiByYS5yb3RhdGVMZWZ0LFxyXG4gICAgICAgIG9uX2tleXVwOiByYS5zdG9wUm90YXRlTGVmdFxyXG4gICAgfSk7XHJcblxyXG4gICAgbGlzdGVuZXIucmVnaXN0ZXJfY29tYm8oe1xyXG4gICAgICAgIGtleXM6IFwicmlnaHRcIixcclxuICAgICAgICBvbl9rZXlkb3duOiByYS5yb3RhdGVSaWdodCxcclxuICAgICAgICBvbl9rZXl1cDogcmEuc3RvcFJvdGF0ZVJpZ2h0XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgdHJhY2tBY3Rpb25zID0gYWN0aW9ucy50cmFja09iamVjdEFjdGlvbnMoKTtcclxuICAgIGxpc3RlbmVyLnJlZ2lzdGVyX2NvbWJvKHtcclxuICAgICAgICBrZXlzOiBcInRhYlwiLFxyXG4gICAgICAgIG9uX2tleXVwOiB0cmFja0FjdGlvbnMudHJhY2tOZXh0LFxyXG4gICAgICAgIGlzX3NvbGl0YXJ5OiB0cnVlLFxyXG4gICAgICAgIHByZXZlbnRfZGVmYXVsdDogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBsaXN0ZW5lci5yZWdpc3Rlcl9jb21ibyh7XHJcbiAgICAgICAga2V5czogXCJzaGlmdCB0YWJcIixcclxuICAgICAgICBvbl9rZXl1cDogdHJhY2tBY3Rpb25zLnRyYWNrUHJldmlvdXMsXHJcbiAgICAgICAgcHJldmVudF9kZWZhdWx0OiB0cnVlXHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgem9vbUFjdGlvbnMgPSBhY3Rpb25zLnpvb21BY3Rpb25zKCk7XHJcbiAgICBsaXN0ZW5lci5yZWdpc3Rlcl9jb21ibyh7XHJcbiAgICAgICAga2V5czogXCJ1cFwiLFxyXG4gICAgICAgIG9uX2tleWRvd246IHpvb21BY3Rpb25zLnpvb21JbixcclxuICAgICAgICBvbl9rZXl1cDogem9vbUFjdGlvbnMuc3RvcFpvb21JblxyXG4gICAgfSk7XHJcblxyXG4gICAgbGlzdGVuZXIucmVnaXN0ZXJfY29tYm8oe1xyXG4gICAgICAgIGtleXM6IFwiZG93blwiLFxyXG4gICAgICAgIG9uX2tleWRvd246IHpvb21BY3Rpb25zLnpvb21PdXQsXHJcbiAgICAgICAgb25fa2V5dXA6IHpvb21BY3Rpb25zLnN0b3Bab29tT3V0XHJcbiAgICB9KTtcclxuXHJcbn0pOyIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKGFzc2V0cyl7XHJcbiAgICB2YXIgdmVydGV4O1xyXG4gICAgdmFyIGZyYWdtZW50O1xyXG5cclxuICAgIHZhciBrZXJuZWwgPSBbXTtcclxuXHJcbiAgICB2YXIgc3BhbiA9IDI7XHJcblxyXG4gICAgZm9yICggdmFyIGkgPSAtc3BhbjsgaSA8IHNwYW47IGkrKyApIHtcclxuICAgICAgICBmb3IgKCB2YXIgaiA9IC1zcGFuOyBqIDwgc3BhbjsgaisrKSB7XHJcbiAgICAgICAgICAgIHZhciBtYXggPSAuMDU7XHJcbiAgICAgICAgICAgIHZhciBsZW4gPSBtYXgqbmV3IFRIUkVFLlZlY3RvcjIoaSxqKS5sZW5ndGhTcSgpLygyICogc3BhbiAqIHNwYW4pO1xyXG4gICAgICAgICAgICBrZXJuZWwucHVzaChuZXcgVEhSRUUuVmVjdG9yMyhpLGosbGVuKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzc2V0cy5nZXRTaGFkZXIoJ3BhcnRzL3NoYWRlcnMvcG9zdFByb2Nlc3NpbmcudnMnLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICB2ZXJ0ZXggPSBkYXRhO1xyXG4gICAgfSk7XHJcbiAgICBhc3NldHMuZ2V0U2hhZGVyKCdwYXJ0cy9zaGFkZXJzL2Jsb29tL2Jsb29tLmZzJywgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICAgZnJhZ21lbnQgPSBcIiNkZWZpbmUgS0VSTkVMX1NJWkVfSU5UIFwiICsga2VybmVsLmxlbmd0aCArIFwiXFxuXCIgKyBkYXRhO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZnVuY3Rpb24gaW5zdGFuY2UoKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdW5pZm9ybXM6IHtcclxuICAgICAgICAgICAgICAgIFwidERpZmZ1c2VcIjogICAgIHsgdHlwZTogXCJ0XCIsICAgIHZhbHVlOiBudWxsICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFwidHJpZ2dlckNvbG9yXCI6IHsgdHlwZTogXCJ2M1wiLCAgIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMygxLDEsMSkgfSxcclxuICAgICAgICAgICAgICAgIFwiYmxvb21Db2xvclwiOiAgIHsgdHlwZTogXCJ2M1wiLCAgIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMygxLDEsMSkgfSxcclxuICAgICAgICAgICAgICAgIFwia2VybmVsXCI6ICAgICAgIHsgdHlwZTogXCJ2M3ZcIiwgIHZhbHVlOiBrZXJuZWwgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFwidFNpemVcIjogICAgICAgIHsgdHlwZTogXCJ2MlwiLCAgIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMigxMDAsMTAwKX1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmVydGV4U2hhZGVyOiB2ZXJ0ZXgsXHJcbiAgICAgICAgICAgIGZyYWdtZW50U2hhZGVyOiBmcmFnbWVudFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpbnN0YW5jZTogaW5zdGFuY2VcclxuICAgIH1cclxuXHJcbn0pKHJlcXVpcmUoJy4uLy4uLy4uL2Fzc2V0cycpKTsiLCJcclxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oYXNzZXRzKXtcclxuXHJcbiAgICB2YXIgdmVydGV4O1xyXG4gICAgdmFyIGZyYWdtZW50O1xyXG4gICAgYXNzZXRzLmdldFNoYWRlcigncGFydHMvc2hhZGVycy9wb3N0UHJvY2Vzc2luZy52cycsIGZ1bmN0aW9uKGRhdGEpe1xyXG4gICAgICAgIHZlcnRleCA9IGRhdGE7XHJcbiAgICB9KTtcclxuICAgIGFzc2V0cy5nZXRTaGFkZXIoJ3BhcnRzL3NoYWRlcnMvYmx1ci9ibHVyLmZzJywgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICBmcmFnbWVudCA9IGRhdGE7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmdW5jdGlvbiBpbnN0YW5jZSgpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB1bmlmb3Jtczoge1xyXG5cclxuICAgICAgICAgICAgICAgIFwidERpZmZ1c2VcIjogICAgICAgeyB0eXBlOiBcInRcIiwgIHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgICAgICAgICBcInRTaXplXCI6ICAgICAgICAgIHsgdHlwZTogXCJ2MlwiLCB2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjIoIDI1NiwgMjU2ICkgfSxcclxuICAgICAgICAgICAgICAgIFwiY2VudGVyXCI6ICAgICAgICAgeyB0eXBlOiBcInYyXCIsIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMiggMC41LCAwLjUgKSB9LFxyXG4gICAgICAgICAgICAgICAgXCJhbmdsZVwiOiAgICAgICAgICB7IHR5cGU6IFwiZlwiLCAgdmFsdWU6IDEuNTcgfSxcclxuICAgICAgICAgICAgICAgIFwic2NhbGVcIjogICAgICAgICAgeyB0eXBlOiBcImZcIiwgIHZhbHVlOiAxLjAgfSxcclxuICAgICAgICAgICAgICAgIFwic3RhckNvbG9yXCI6ICAgICAgeyB0eXBlOiBcInYzXCIsIHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMygxLDEsMSl9LFxyXG4gICAgICAgICAgICAgICAgXCJ0RGVwdGhcIjogICAgICAgICB7IHR5cGU6IFwidFwiLCAgdmFsdWU6IG51bGwgfSxcclxuICAgICAgICAgICAgICAgIFwidGltZVwiOiAgICAgICAgICAgeyB0eXBlOiBcImZcIiwgIHZhbHVlOiAwIH0sXHJcbiAgICAgICAgICAgICAgICBcImNhbWVyYU5lYXJcIjogICAgIHsgdHlwZTogXCJmXCIsICB2YWx1ZTogNSB9LFxyXG4gICAgICAgICAgICAgICAgXCJjYW1lcmFGYXJcIjogICAgICB7IHR5cGU6IFwiZlwiLCAgdmFsdWU6IDEwMCB9LFxyXG4gICAgICAgICAgICAgICAgXCJtYXhEaXN0YW5jZVwiOiAgICB7IHR5cGU6IFwiZlwiLCAgdmFsdWU6IDEwMDAwIH0sXHJcbiAgICAgICAgICAgICAgICBcImRpc3RhbmNlVG9TdGFyXCI6IHsgdHlwZTogXCJmXCIsICB2YWx1ZTogMCB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogdmVydGV4LFxyXG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogZnJhZ21lbnQsXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpbnN0YW5jZTogaW5zdGFuY2VcclxuICAgIH1cclxufSkocmVxdWlyZSgnLi4vLi4vLi4vYXNzZXRzJykpO1xyXG4iLCJ2YXIgUGh5c2ljcyA9IHJlcXVpcmUoJ3NvbGFyL3BoeXNpY3MnKTtcclxudmFyIFJhbmRvbSA9IE1hdGg7XHJcbnZhciBvcmJpdEZhY3RvcnkgPSByZXF1aXJlKCdzb2xhci9vcmJpdCcpO1xyXG52YXIgVjMgPSBUSFJFRS5WZWN0b3IzO1xyXG5cclxuZnVuY3Rpb24gZ2V0T2Zmc2V0KHVwKSB7XHJcbiAgICBpZiAoIHVwID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICB1cCA9IG5ldyBWMygwLDEsMCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IFYzKDI1ICsgUmFuZG9tLnJhbmRvbSgpICogMTAsIDAsIDE1ICsgUmFuZG9tLnJhbmRvbSgpICogMTApO1xyXG59XHJcbmZ1bmN0aW9uIGdldFBsYW5ldChwb3NpdGlvbiwgdGhpbmdUb09yYml0LCBtYXNzLCBtYXhNb29ucykge1xyXG4gICAgaWYgKG1heE1vb25zID09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIG1heE1vb25zID0gMztcclxuICAgIH1cclxuICAgIGlmIChtYXNzID09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIG1hc3MgPSAxMDAwMDA7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBsYW5ldCA9IHt9O1xyXG4gICAgUGh5c2ljcy5hZGRQaHlzaWNzUHJvcGVydGllcyhwbGFuZXQpO1xyXG4gICAgcGxhbmV0LnhbcGxhbmV0Lm5dLmNvcHkocG9zaXRpb24pO1xyXG4gICAgcGxhbmV0LnNldE1hc3MobWFzcyk7XHJcbiAgICBwbGFuZXQubW9vbnMgPSBbXTtcclxuICAgIG9yYml0RmFjdG9yeS5tYWtlT3JiaXRhbChwbGFuZXQpO1xyXG4gICAgcGxhbmV0Lm9yYml0KHRoaW5nVG9PcmJpdCk7XHJcbiAgICB2YXIgbnVtTW9vbnMgPSBtYXhNb29ucztcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtTW9vbnM7IGkrKyApIHtcclxuICAgICAgICBwbGFuZXQubW9vbnMucHVzaChcclxuICAgICAgICAgICAgZ2V0UGxhbmV0KFxyXG4gICAgICAgICAgICAgICAgbmV3IFYzKCkuYWRkVmVjdG9ycyhwb3NpdGlvbiwgZ2V0T2Zmc2V0KCkpLFxyXG4gICAgICAgICAgICAgICAgcGxhbmV0LDEwLDBcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGxhbmV0O1xyXG59XHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZ2V0UGxhbmV0OiBnZXRQbGFuZXRcclxufTsiLCJmdW5jdGlvbiBtYWtlUGxhbmV0VmlldyhwbGFuZXQpIHtcclxuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5JY29zYWhlZHJvbkdlb21ldHJ5KDIgKyAuMDAwMSAqIHBsYW5ldC5tYXNzKCksIDIpO1xyXG4gICAgdmFyIHRleHR1cmUgPSBUSFJFRS5JbWFnZVV0aWxzLmxvYWRUZXh0dXJlKCAnaW1hZ2VzL3dhdGVyLmpwZycgKTtcclxuICAgIHZhciBtYXQgPSBuZXcgVEhSRUUuTWVzaFBob25nTWF0ZXJpYWwoe1xyXG4gICAgICAgIGFtYmllbnQ6IDB4NTVGRjU1LFxyXG4gICAgICAgIGNvbG9yOiAweENDRkZDQyxcclxuICAgICAgICBzcGVjdWxhcjogMHhDQ0NDQ0MsXHJcbiAgICAgICAgc2hpbmluZXNzOiA1LFxyXG4gICAgICAgIGVtaXNzaXZlOiAweDAwMTEzMyxcclxuICAgICAgICBzaGFkaW5nOiBUSFJFRS5TbW9vdGhTaGFkaW5nLFxyXG4gICAgICAgIG1hcDogdGV4dHVyZVxyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIHBsYW5ldFZpZXcgPSBuZXcgVEhSRUUuTWVzaCggZ2VvbWV0cnksIG1hdCApO1xyXG5cclxuICAgIHBsYW5ldFZpZXcudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcGxhbmV0Vmlldy5wb3NpdGlvbi5jb3B5KHBsYW5ldC54W3BsYW5ldC5uXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGxhbmV0VmlldztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBtYWtlUGxhbmV0VmlldzogbWFrZVBsYW5ldFZpZXdcclxufTsiLCJ2YXIgcGh5c2ljcyA9IHJlcXVpcmUoJ3NvbGFyL3BoeXNpY3MnKTtcclxuXHJcblxyXG52YXIgU3RhclR5cGVzID0gW1xyXG4gICAge1xyXG4gICAgICAgIHN0YXJUeXBlOiAnbycsXHJcbiAgICAgICAgY29sb3I6IDB4MDAwMEZGLFxyXG4gICAgICAgIHNlY29uZGFyeUNvbG9yOiAweDAwMDAzMyxcclxuICAgICAgICB0ZW1wOiAyNTAwMCxcclxuICAgICAgICBhdmdNYXNzOiA2MCxcclxuICAgICAgICBhdmdSYWRpdXM6IDE1LFxyXG4gICAgICAgIGF2Z0x1bTogMTQwMDAwMFxyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgICBzdGFyVHlwZTogJ2InLFxyXG4gICAgICAgIGNvbG9yOiAweDIyMjJGRixcclxuICAgICAgICBzZWNvbmRhcnlDb2xvcjogMHgwMDAwMzMsXHJcbiAgICAgICAgdGVtcDogMTgwMDAsXHJcbiAgICAgICAgYXZnTWFzczogMTgsXHJcbiAgICAgICAgYXZnUmFkaXVzOiA3LFxyXG4gICAgICAgIGF2Z0x1bTogMjAwMDBcclxuICAgIH0sXHJcbiAgICB7XHJcbiAgICAgICAgc3RhclR5cGU6ICdhJyxcclxuICAgICAgICBjb2xvcjogMHgyMjIyRkYsXHJcbiAgICAgICAgc2Vjb25kYXJ5Q29sb3I6IDB4MDAwMDMzLFxyXG4gICAgICAgIHRlbXA6IDkyNTAsXHJcbiAgICAgICAgYXZnTWFzczogMy4yLFxyXG4gICAgICAgIGF2Z1JhZGl1czogMi41LFxyXG4gICAgICAgIGF2Z0x1bTogODBcclxuICAgIH0sXHJcbiAgICB7XHJcbiAgICAgICAgc3RhclR5cGU6ICdmJyxcclxuICAgICAgICBjb2xvcjogMHhFRkVGRkYsXHJcbiAgICAgICAgc2Vjb25kYXJ5Q29sb3I6IDB4QTZBNkZGLFxyXG4gICAgICAgIHRlbXA6IDY3NTAsXHJcbiAgICAgICAgYXZnTWFzczogMS43LFxyXG4gICAgICAgIGF2Z1JhZGl1czogMS4zLFxyXG4gICAgICAgIGF2Z0x1bTogNlxyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgICBzdGFyVHlwZTogJ2cnLFxyXG4gICAgICAgIGNvbG9yOiAweGZmRTU2NixcclxuICAgICAgICBzZWNvbmRhcnlDb2xvcjogMHhmNmJkN2MsXHJcbiAgICAgICAgdGVtcDogNTUwMCxcclxuICAgICAgICBhdmdNYXNzOiAxLjEsXHJcbiAgICAgICAgYXZnUmFkaXVzOiAxLjEsXHJcbiAgICAgICAgYXZnTHVtOiAxLjJcclxuICAgIH0sXHJcbiAgICB7XHJcbiAgICAgICAgc3RhclR5cGU6ICdrJyxcclxuICAgICAgICBjb2xvcjogMHhmZkU1NjYsXHJcbiAgICAgICAgc2Vjb25kYXJ5Q29sb3I6IDB4ZjZiZDdjLFxyXG4gICAgICAgIHRlbXA6IDQyNTAsXHJcbiAgICAgICAgYXZnTWFzczogLjgsXHJcbiAgICAgICAgYXZnUmFkaXVzOi45ICxcclxuICAgICAgICBhdmdMdW06IC40XHJcbiAgICB9LFxyXG4gICAge1xyXG4gICAgICAgIHN0YXJUeXBlOiAnbScsXHJcbiAgICAgICAgY29sb3I6IDB4RkY2NjY2LFxyXG4gICAgICAgIHNlY29uZGFyeUNvbG9yOiAweEREMzMzMyxcclxuICAgICAgICB0ZW1wOiAzMDAwLFxyXG4gICAgICAgIGF2Z01hc3M6IC4zLFxyXG4gICAgICAgIGF2Z1JhZGl1czouNCxcclxuICAgICAgICBhdmdMdW06IC4wNFxyXG4gICAgfVxyXG5cclxuXTtcclxuXHJcbnZhciBTdGFyRmFjdG9yeSA9IChmdW5jdGlvbih0eXBlcyl7XHJcblxyXG4gICAgdmFyIG1hc3NPZlRoZVN1biA9IDUwMDAwOy8vMiAqIE1hdGgucG93KDEwLCAzMCk7IC8va2dcclxuICAgIHZhciByYWRpdXNPZlRoZVN1biA9IDIwOy8vNjk1NTAwOyAvL2ttXHJcbiAgICB2YXIgYmFzZSA9IDEwMDtcclxuXHJcbiAgICB2YXIgdmFyaWFuY2UgPSAuMDU7XHJcblxyXG4gICAgLy9pbmRleCB0eXBlc1xyXG4gICAgdmFyIGJ5U3RhclR5cGUgPSB7fTtcclxuICAgIHZhciBsZXR0ZXJzID0gW107XHJcbiAgICB2YXIgbnVtYmVycyA9IFswLDEsMiwzLDQsNSw2LDcsOCw5XTtcclxuICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgYnlTdGFyVHlwZVt0eXBlc1tpXS5zdGFyVHlwZV0gPSB0eXBlc1tpXTtcclxuICAgICAgICBsZXR0ZXJzW2ldID0gdHlwZXNbaV0uc3RhclR5cGU7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGZ1bmN0aW9uIHJhbmRvbUxldHRlcigpIHtcclxuICAgICAgICB2YXIgaGwgPSBsZXR0ZXJzLmxlbmd0aC8yO1xyXG4gICAgICAgIHJldHVybiBsZXR0ZXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGhsICsgTWF0aC5yYW5kb20oKSAqIGhsKV07XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmFuZG9tTnVtYmVyKCkge1xyXG4gICAgICAgIHJldHVybiBudW1iZXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIG51bWJlcnMubGVuZ3RoKV07XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdmFyeSh2YWx1ZSwgbXVsdGlwbGllcikge1xyXG4gICAgICAgIHZhciBiYXNlID0gdmFsdWUgKiBtdWx0aXBsaWVyO1xyXG4gICAgICAgIHZhciBvZmZzZXQgPSBiYXNlICogKE1hdGgucmFuZG9tKCkgKiB2YXJpYW5jZSkgLSAoTWF0aC5yYW5kb20oKSAqIHZhcmlhbmNlKTtcclxuICAgICAgICByZXR1cm4gYmFzZSArIG9mZnNldDtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldFN0YXIodHlwZSkge1xyXG4gICAgICAgIGlmICghdHlwZSkge1xyXG4gICAgICAgICAgICB0eXBlID0gcmFuZG9tTGV0dGVyKCkgKyByYW5kb21OdW1iZXIoKTtcclxuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBzcGVjdHJhbFR5cGUgPSB0eXBlLmNoYXJBdCgwKTtcclxuICAgICAgICB2YXIgc3BlY3RyYWxOdW1iZXIgPSB0eXBlLmNoYXJBdCgxKTtcclxuXHJcbiAgICAgICAgdmFyIHByb3RvID0gYnlTdGFyVHlwZVtzcGVjdHJhbFR5cGVdO1xyXG5cclxuICAgICAgICB2YXIgbXVsdGlwbGllciA9IDEgKyBzcGVjdHJhbE51bWJlci81O1xyXG5cclxuICAgICAgICB2YXIgc3RhciA9IHt9O1xyXG5cclxuICAgICAgICBwaHlzaWNzLmFkZFBoeXNpY3NQcm9wZXJ0aWVzKHN0YXIpO1xyXG5cclxuICAgICAgICBzdGFyLnNldE1hc3ModmFyeShwcm90by5hdmdNYXNzICogbWFzc09mVGhlU3VuLCBtdWx0aXBsaWVyKSk7XHJcbiAgICAgICAgc3Rhci5jb2xvciA9IHByb3RvLmNvbG9yO1xyXG4gICAgICAgIHN0YXIuc2Vjb25kYXJ5Q29sb3IgPSBwcm90by5zZWNvbmRhcnlDb2xvcjtcclxuICAgICAgICBzdGFyLnRlbXAgPSB2YXJ5KHByb3RvLnRlbXAsIG11bHRpcGxpZXIpO1xyXG4gICAgICAgIHN0YXIucmFkaXVzID0gdmFyeShwcm90by5hdmdSYWRpdXMgKiByYWRpdXNPZlRoZVN1biwgbXVsdGlwbGllcik7XHJcbiAgICAgICAgc3Rhci5sdW0gPSBNYXRoLmxvZyhiYXNlICsgdmFyeShwcm90by5hdmdMdW0sIG11bHRpcGxpZXIpKS9NYXRoLmxvZyhiYXNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHN0YXI7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBnZXRTdGFyOiBnZXRTdGFyXHJcbiAgICB9XHJcbn0pKFN0YXJUeXBlcyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIHN0YXJUeXBlczogU3RhclR5cGVzLFxyXG4gICAgZ2V0U3RhcjogU3RhckZhY3RvcnkuZ2V0U3RhclxyXG59OyIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKFxyXG4gICAgR2VvLFxyXG4gICAgUGFydGljbGVNYXRlcmlhbCxcclxuICAgIFZlcnRleCxcclxuICAgIFZlY3RvcjMsXHJcbiAgICBQYXJ0aWNsZVN5c3RlbSxcclxuICAgIHJuZyxcclxuICAgIHV0aWxzLFxyXG4gICAgYXNzZXRzLFxyXG4gICAgcGh5c2ljcyxcclxuICAgIHZlY3RvclV0aWxzKXtcclxuXHJcbiAgICB2YXIgc3VuRnJhZywgc3VuVmVydDtcclxuICAgIGFzc2V0cy5nZXRTaGFkZXIoJ3BhcnRzL3NoYWRlcnMvbm9pc2UuZnMnLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICBzdW5GcmFnID0gZGF0YTtcclxuICAgIH0pO1xyXG4gICAgYXNzZXRzLmdldFNoYWRlcigncGFydHMvc2hhZGVycy9kZWZhdWx0LnZzJywgZnVuY3Rpb24oZGF0YSl7XHJcbiAgICAgICAgc3VuVmVydCA9IGRhdGE7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgdGV4dHVyZSA9IFRIUkVFLkltYWdlVXRpbHMubG9hZFRleHR1cmUoICdpbWFnZXMvd2F0ZXIuanBnJyApO1xyXG5cclxuICAgIGZ1bmN0aW9uIGhleFRvVmVjdG9yKGhleCkge1xyXG4gICAgICAgIHZhciByZWQgPSAoaGV4ID4+IDE2KS8yNTU7XHJcbiAgICAgICAgdmFyIGJsdWUgPSAoaGV4ID4+IDggJiAweEZGKS8yNTU7XHJcbiAgICAgICAgdmFyIGdyZWVuID0gKGhleCAmIDB4RkYpLzI1NTtcclxuICAgICAgICB2YXIgY29sb3IgPSBuZXcgVmVjdG9yMyhyZWQsIGJsdWUsIGdyZWVuKTtcclxuICAgICAgICByZXR1cm4gY29sb3I7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbWFrZVN0YXJWaWV3KHN0YXIpIHtcclxuICAgICAgICB2YXIgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuSWNvc2FoZWRyb25HZW9tZXRyeShzdGFyLnJhZGl1cywgMyk7XHJcblxyXG4gICAgICAgIHZhciBtYXQgPSBuZXcgVEhSRUUuTWVzaFBob25nTWF0ZXJpYWwoe1xyXG4gICAgICAgICAgICBhbWJpZW50OiAweDU1RkY1NSxcclxuICAgICAgICAgICAgY29sb3I6IDB4Q0NGRkNDLFxyXG4gICAgICAgICAgICBzcGVjdWxhcjogMHhDQ0NDQ0MsXHJcbiAgICAgICAgICAgIHNoaW5pbmVzczogNSxcclxuICAgICAgICAgICAgZW1pc3NpdmU6IHN0YXIuY29sb3IsXHJcbiAgICAgICAgICAgIHNoYWRpbmc6IFRIUkVFLlNtb290aFNoYWRpbmcsXHJcbiAgICAgICAgICAgIG1hcDogdGV4dHVyZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB2YXIgY29sb3IgPSBoZXhUb1ZlY3RvcihzdGFyLmNvbG9yKTtcclxuICAgICAgICB2YXIgc2Vjb25kYXJ5Q29sb3IgPSBoZXhUb1ZlY3RvcihzdGFyLnNlY29uZGFyeUNvbG9yKTtcclxuXHJcbiAgICAgICAgdmFyIHNjYWxlVmFsdWUgPSAuMDA2NSAqIHN0YXIucmFkaXVzO1xyXG5cclxuICAgICAgICB2YXIgdW5pZm9ybXMgPSB7XHJcbiAgICAgICAgICAgIHRpbWU6IFx0eyB0eXBlOiBcImZcIiwgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgICAgICBzY2FsZTogXHR7IHR5cGU6IFwiZlwiLCB2YWx1ZTogLjAyIH0sXHJcbiAgICAgICAgICAgIGNvbG9yOiAgeyB0eXBlOiBcInYzXCIsIHZhbHVlOiBjb2xvciB9LFxyXG4gICAgICAgICAgICBzZWNvbmRhcnlDb2xvcjogeyB0eXBlOiBcInYzXCIsIHZhbHVlOiBzZWNvbmRhcnlDb2xvciB9LFxyXG4gICAgICAgICAgICBjYW1lcmE6IHsgdHlwZTogXCJ2M1wiLCB2YWx1ZTogbmV3IFZlY3RvcjMoKSB9XHJcbiAgICAgICAgfTtcclxuXHJcblxyXG4gICAgICAgIHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCgge1xyXG4gICAgICAgICAgICB1bmlmb3JtczogdW5pZm9ybXMsXHJcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogc3VuVmVydCxcclxuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXI6IHN1bkZyYWdcclxuICAgICAgICB9ICk7XHJcblxyXG4gICAgICAgIHZhciBzdGFyVmlldyA9IG5ldyBUSFJFRS5NZXNoKCBnZW9tZXRyeSwgbWF0ZXJpYWwgKTtcclxuXHJcbiAgICAgICAgcGh5c2ljcy5hZGRQaHlzaWNzUHJvcGVydGllcyhzdGFyVmlldyk7XHJcbiAgICAgICAgc3RhclZpZXcuaW52TWFzcyA9IHN0YXIuaW52TWFzcztcclxuXHJcbiAgICAgICAgc3RhclZpZXcubGlnaHQgPSBuZXcgVEhSRUUuUG9pbnRMaWdodChzdGFyLmNvbG9yKTtcclxuICAgICAgICBzdGFyVmlldy5saWdodC5wb3NpdGlvbiA9IHN0YXJWaWV3LnBvc2l0aW9uO1xyXG4gICAgICAgIHN0YXJWaWV3LmxpZ2h0LmludGVuc2l0eSA9IHN0YXIubHVtO1xyXG4gICAgICAgIHN0YXJWaWV3LmJhY2tncm91bmRQYXJ0aWNsZXMgPSBidWlsZEJhY2tncm91bmRQYXJ0aWNsZXMoc3Rhcik7XHJcbiAgICAgICAgc3RhclZpZXcucmFkaWFsUGFydGljbGVzRW1pdHRlcnMgPSBidWlsZFJhZGlhbFBhcnRpY2xlRW1pdHRlcnMoc3Rhcik7XHJcbiAgICAgICAgc3RhclZpZXcudW5pZm9ybXMgPSB1bmlmb3JtcztcclxuXHJcblxyXG4gICAgICAgIC8vd2hhdCB3ZSBuZWVkIHRvIGRvIGVhY2ggZnJhbWUgdG8gdXBkYXRlIHRoZSB2aWV3IG9mIHRoZSBzdGFyXHJcbiAgICAgICAgc3RhclZpZXcudmlld1VwZGF0ZSA9IGZ1bmN0aW9uKGR0LCBjYW1lcmEsIHNpemUsIHN0YXJFZmZlY3QgKXtcclxuICAgICAgICAgICAgc3RhclZpZXcudW5pZm9ybXMudGltZS52YWx1ZSArPSAuMjUgKiBkdDtcclxuXHJcbiAgICAgICAgICAgIHZhciBkZiA9IDQ1MDA7XHJcbiAgICAgICAgICAgIHN0YXJFZmZlY3QudW5pZm9ybXMubWF4RGlzdGFuY2UudmFsdWUgPSBkZiAqIGRmO1xyXG4gICAgICAgICAgICB2YXIgc3AgPSBuZXcgVmVjdG9yMygpLmNvcHkoc3RhclZpZXcucG9zaXRpb24pO1xyXG4gICAgICAgICAgICBzdGFyRWZmZWN0LnVuaWZvcm1zLmRpc3RhbmNlVG9TdGFyLnZhbHVlID0gc3Auc3ViKGNhbWVyYS5wb3NpdGlvbikubGVuZ3RoU3EoKTtcclxuXHJcblxyXG4gICAgICAgICAgICBhbmltYXRlUmFkaWFsUGFydGljbGVzKHN0YXJWaWV3LCBkdCk7XHJcblxyXG4gICAgICAgICAgICB2YXIgdmVjdG9yID0gbmV3IFZlY3RvcjMoKTtcclxuICAgICAgICAgICAgdmFyIHByb2plY3RvciA9IG5ldyBUSFJFRS5Qcm9qZWN0b3IoKTtcclxuICAgICAgICAgICAgcHJvamVjdG9yLnByb2plY3RWZWN0b3IoIHZlY3Rvci5zZXRGcm9tTWF0cml4UG9zaXRpb24oIHN0YXJWaWV3Lm1hdHJpeFdvcmxkICksIGNhbWVyYSApO1xyXG5cclxuICAgICAgICAgICAgdmFyIHdpZHRoSGFsZiA9IHNpemUueC8yO1xyXG4gICAgICAgICAgICB2YXIgaGVpZ2h0SGFsZiA9IHNpemUueS8yO1xyXG4gICAgICAgICAgICB2ZWN0b3IueCA9ICggdmVjdG9yLnggKiB3aWR0aEhhbGYgKSArIHdpZHRoSGFsZjtcclxuICAgICAgICAgICAgdmVjdG9yLnkgPSAoIHZlY3Rvci55ICogaGVpZ2h0SGFsZiApICsgaGVpZ2h0SGFsZjtcclxuICAgICAgICAgICAgc3RhckVmZmVjdC51bmlmb3Jtc1tcImNlbnRlclwiXS52YWx1ZSA9IHZlY3RvcjtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBoZXhUb1ZlY3RvcihzdGFyLmNvbG9yKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBzdGFyVmlldztcclxuICAgIH1cclxuXHJcblxyXG4gICAgZnVuY3Rpb24gYW5pbWF0ZVJhZGlhbFBhcnRpY2xlcyhzdGFyLCBkdCkge1xyXG5cclxuICAgICAgICB2YXIgZW1pdHRlcnMgPSBzdGFyLnJhZGlhbFBhcnRpY2xlc0VtaXR0ZXJzO1xyXG4gICAgICAgIGZvciAoIHZhciBqID0gMDsgaiA8IGVtaXR0ZXJzLmxlbmd0aDsgaisrICkge1xyXG4gICAgICAgICAgICB2YXIgcGFydGljbGVzID0gc3Rhci5yYWRpYWxQYXJ0aWNsZXNFbWl0dGVyc1tqXTtcclxuICAgICAgICAgICAgdmFyIGVtaXR0ZXIgPSBwYXJ0aWNsZXMuc3VuU3BvdEVtaXR0ZXI7XHJcbiAgICAgICAgICAgIHZhciB2ZXJ0aWNlcyA9IHBhcnRpY2xlcy5nZW9tZXRyeS52ZXJ0aWNlcztcclxuXHJcbiAgICAgICAgICAgIGZvciAoIHZhciBpID0gMDsgaSA8IHZlcnRpY2VzLmxlbmd0aDsgaSsrICkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHAgPSB2ZXJ0aWNlc1tpXTtcclxuICAgICAgICAgICAgICAgIGlmIChwLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGh5c2ljcy5hcHBseUdyYXZpdHkoc3RhciwgcC5waHlzaWNzLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgICAgICBwLnBoeXNpY3MucGh5c2ljc1VwZGF0ZShkdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcC5jb3B5KHAucGh5c2ljcy5wb3NpdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlbWl0dGVyLmlzSW5zaWRlKHApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHAuaXNBY3RpdmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcC5jb3B5KHN0YXIucG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0dGVyLnVuZGVwbG95ZWQucHVzaChwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBlbWl0dGVyLnVuZGVwbG95ZWQubGVuZ3RoID09IGVtaXR0ZXIucGFydGljbGVDb3VudCApIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCBlbWl0dGVyLnVuZGVwbG95ZWQubGVuZ3RoID4gMCAmJiBlbWl0dGVyLmN1cnJlbnRXYWl0ID09IDApIHtcclxuICAgICAgICAgICAgICAgIC8vc3Bhd24gdGhlIHBhcnRpY2xlXHJcbiAgICAgICAgICAgICAgICB2YXIgcGFydGljbGUgPSBlbWl0dGVyLnVuZGVwbG95ZWQucG9wKCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgcHAgPSBwYXJ0aWNsZS5waHlzaWNzO1xyXG4gICAgICAgICAgICAgICAgcHAucG9zaXRpb24uY29weShlbWl0dGVyLnBvc2l0aW9uKTtcclxuICAgICAgICAgICAgICAgIHBwLnByZXZpb3VzUG9zaXRpb24oKS5jb3B5KGVtaXR0ZXIucG9zaXRpb24pO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciBhY2NlbCA9IG5ldyBWZWN0b3IzKCkuY29weShwYXJ0aWNsZS5waHlzaWNzLnBvc2l0aW9uKS5zdWIoc3Rhci5wb3NpdGlvbikuc2V0TGVuZ3RoKGVtaXR0ZXIuYmFzZUFjY2VsZXJhdGlvbikuYWRkKFxyXG4gICAgICAgICAgICAgICAgICAgIHZlY3RvclV0aWxzLnJhbmRvbVZlY3RvcihlbWl0dGVyLmJhc2VBY2NlbGVyYXRpb24vNClcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5waHlzaWNzLmFjY2VsZXJhdGlvbigpLmFkZChhY2NlbCk7XHJcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5pc0FjdGl2ZSA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCBlbWl0dGVyLnVuZGVwbG95ZWQubGVuZ3RoID09IDAgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZW1pdHRlci5waWNrTmV3UG9zaXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICBlbWl0dGVyLmN1cnJlbnRXYWl0ID0gZW1pdHRlci5yYW5kb21XYWl0KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICggZW1pdHRlci5jdXJyZW50V2FpdCA+IDAgKSB7XHJcbiAgICAgICAgICAgICAgICBlbWl0dGVyLmN1cnJlbnRXYWl0LS07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmFuZE1pbnVzUmFuZCgpIHtcclxuICAgICAgICByZXR1cm4gcm5nLnJhbmRvbSgpIC0gcm5nLnJhbmRvbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGJ1aWxkQmFja2dyb3VuZFBhcnRpY2xlcyhzdGFyKSB7XHJcbiAgICAgICAgdmFyIHBhcnRpY2xlQ291bnQgPSA0MDA7XHJcbiAgICAgICAgdmFyIHBhcnRpY2xlcyA9IG5ldyBHZW8oKTtcclxuICAgICAgICB2YXIgbWF0ID0gbmV3IFBhcnRpY2xlTWF0ZXJpYWwoe1xyXG4gICAgICAgICAgICBjb2xvcjogc3Rhci5jb2xvcixcclxuICAgICAgICAgICAgbWFwOiB1dGlscy5sb2FkVGV4dHVyZSgnL2ltYWdlcy9wYXJ0aWNsZXMvZHVzdC5wbmcnKSxcclxuICAgICAgICAgICAgc2l6ZTogMTUwLFxyXG4gICAgICAgICAgICBvcGFjaXR5Oi4wMjUsXHJcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICAgICAgICBibGVuZERzdDogVEhSRUUuU3JjQWxwaGFGYWN0b3IsXHJcbiAgICAgICAgICAgIGJsZW5kaW5nOiBUSFJFRS5BZGRpdGl2ZUJsZW5kaW5nXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbWF0LmRlcHRoV3JpdGUgPSBmYWxzZTtcclxuICAgICAgICB2YXIgcG9zID0gc3Rhci5wb3NpdGlvbjtcclxuICAgICAgICB2YXIgbWF4ID0gcG9zLnggKyBzdGFyLnJhZGl1cyArIDYwMDtcclxuICAgICAgICB2YXIgbWluID0gcG9zLnggKyBzdGFyLnJhZGl1cyArIDUwO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydGljbGVDb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBkaXN0ID0gcm5nLnJhbmRvbSgpICogKG1heCAtIG1pbikgKyBtaW47XHJcbiAgICAgICAgICAgIHZhciB2ID0gbmV3IFZlY3RvcjMocmFuZE1pbnVzUmFuZCgpLHJhbmRNaW51c1JhbmQoKSwgcmFuZE1pbnVzUmFuZCgpKTtcclxuICAgICAgICAgICAgdi5zZXRMZW5ndGgoZGlzdCk7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlcy52ZXJ0aWNlcy5wdXNoKHYpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHBhcnRpY2xlU3lzdGVtID0gbmV3IFBhcnRpY2xlU3lzdGVtKFxyXG4gICAgICAgICAgICBwYXJ0aWNsZXMsXHJcbiAgICAgICAgICAgIG1hdFxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHBhcnRpY2xlU3lzdGVtLnNvcnRQYXJ0aWNsZXMgPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiBwYXJ0aWNsZVN5c3RlbTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByYW5kb21Qb2ludE9uU3VyZmFjZShzdGFyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBWZWN0b3IzKHJhbmRNaW51c1JhbmQoKSxyYW5kTWludXNSYW5kKCksIHJhbmRNaW51c1JhbmQoKSkuc2V0TGVuZ3RoKHN0YXIucmFkaXVzKS5hZGQoc3Rhci5wb3NpdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYnVpbGRSYWRpYWxQYXJ0aWNsZUVtaXR0ZXJzKHN0YXIpIHtcclxuICAgICAgICB2YXIgZW1pdHRlcnMgPSBbXTtcclxuXHJcbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgMTU7IGkrKyApIHtcclxuICAgICAgICAgICAgZW1pdHRlcnMucHVzaChidWlsZFJhZGlhbFBhcnRpY2xlRW1pdHRlcihzdGFyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBlbWl0dGVycztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByYWRpYWxQYXJ0aWNsZU1hdGVyaWFsKHN0YXIpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFBhcnRpY2xlTWF0ZXJpYWwoe1xyXG4gICAgICAgICAgICBjb2xvcjogc3Rhci5jb2xvcixcclxuICAgICAgICAgICAgbWFwOiB1dGlscy5sb2FkVGV4dHVyZSgnL2ltYWdlcy9wYXJ0aWNsZXMvZHVzdC5wbmcnKSxcclxuICAgICAgICAgICAgc2l6ZTogNyArLjAyNSAqIHN0YXIucmFkaXVzLFxyXG4gICAgICAgICAgICBvcGFjaXR5OiAuMjUsXHJcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICAgICAgICBibGVuZERzdDogVEhSRUUuU3JjQWxwaGFGYWN0b3IsXHJcbiAgICAgICAgICAgIGJsZW5kaW5nOiBUSFJFRS5BZGRpdGl2ZUJsZW5kaW5nXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYnVpbGRSYWRpYWxQYXJ0aWNsZUVtaXR0ZXIoc3Rhcikge1xyXG4gICAgICAgIHZhciBwYXJ0aWNsZUNvdW50ID0gMzU7XHJcbiAgICAgICAgdmFyIHBhcnRpY2xlcyA9IG5ldyBHZW8oKTtcclxuXHJcbiAgICAgICAgdmFyIGVtaXR0ZXIgPSB7fTtcclxuICAgICAgICBlbWl0dGVyLnBvc2l0aW9uID0gbmV3IFZlY3RvcjMoKTtcclxuICAgICAgICBlbWl0dGVyLnBpY2tOZXdQb3NpdGlvbiA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIGVtaXR0ZXIucG9zaXRpb24gPSByYW5kb21Qb2ludE9uU3VyZmFjZShzdGFyKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBlbWl0dGVyLm1heFdhaXQgPSA1NTA7XHJcbiAgICAgICAgZW1pdHRlci5yYW5kb21XYWl0ID0gZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgcmV0dXJuIHJuZy5yb3VuZChybmcucmFuZG9tKCkgKiBlbWl0dGVyLm1heFdhaXQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbWl0dGVyLmN1cnJlbnRXYWl0ID0gZW1pdHRlci5yYW5kb21XYWl0KCk7XHJcblxyXG4gICAgICAgIGVtaXR0ZXIuaXNJbnNpZGUgPSBmdW5jdGlvbihwb3Mpe1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZlY3RvcjMoKS5jb3B5KHBvcykuc3ViKHN0YXIucG9zaXRpb24pLmxlbmd0aFNxKCkgPCAoc3Rhci5yYWRpdXMgKiBzdGFyLnJhZGl1cyk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZW1pdHRlci5iYXNlQWNjZWxlcmF0aW9uID0gTWF0aC5zcXJ0KHN0YXIubWFzcygpKS81NTA7XHJcbiAgICAgICAgZW1pdHRlci5wYXJ0aWNsZUNvdW50ID0gcGFydGljbGVDb3VudDtcclxuICAgICAgICBlbWl0dGVyLnBpY2tOZXdQb3NpdGlvbigpO1xyXG4gICAgICAgIGVtaXR0ZXIudW5kZXBsb3llZCA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRpY2xlQ291bnQ7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdiA9IG5ldyBWZWN0b3IzKCk7XHJcbiAgICAgICAgICAgIHZhciBwaHkgPSB2LnBoeXNpY3MgPSB7fTtcclxuICAgICAgICAgICAgcGh5c2ljcy5hZGRQaHlzaWNzUHJvcGVydGllcyh2LnBoeXNpY3MsIGZhbHNlKTsgLy9kb24ndCBrZWVwIGhpc3RvcnlcclxuXHJcbiAgICAgICAgICAgIHZhciBwUG9zID0gcGh5LnBvc2l0aW9uO1xyXG4gICAgICAgICAgICBwUG9zLmNvcHkodik7XHJcblxyXG4gICAgICAgICAgICBwaHkubWFzcyguMDAxKTtcclxuICAgICAgICAgICAgZW1pdHRlci51bmRlcGxveWVkLnB1c2godik7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlcy52ZXJ0aWNlcy5wdXNoKHYpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHBhcnRpY2xlU3lzdGVtID0gbmV3IFBhcnRpY2xlU3lzdGVtKFxyXG4gICAgICAgICAgICBwYXJ0aWNsZXMsXHJcbiAgICAgICAgICAgIHJhZGlhbFBhcnRpY2xlTWF0ZXJpYWwoc3RhcilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBwYXJ0aWNsZVN5c3RlbS5zdW5TcG90RW1pdHRlciA9IGVtaXR0ZXI7XHJcbiAgICAgICAgcGFydGljbGVTeXN0ZW0uc29ydFBhcnRpY2xlcyA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHBhcnRpY2xlU3lzdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbWFrZVN0YXJWaWV3OiBtYWtlU3RhclZpZXdcclxuICAgIH1cclxuXHJcbn0pKFRIUkVFLkdlb21ldHJ5LFxyXG4gICBUSFJFRS5QYXJ0aWNsZVN5c3RlbU1hdGVyaWFsLFxyXG4gICBUSFJFRS5WZXJ0ZXgsXHJcbiAgIFRIUkVFLlZlY3RvcjMsXHJcbiAgIFRIUkVFLlBhcnRpY2xlU3lzdGVtLFxyXG4gICBNYXRoLFxyXG4gICBUSFJFRS5JbWFnZVV0aWxzLFxyXG4gICByZXF1aXJlKCcuLi8uLi8uLi9hc3NldHMnKSxcclxuICAgcmVxdWlyZSgnc29sYXIvcGh5c2ljcycpLFxyXG4gICByZXF1aXJlKCcuLi8uLi91dGlscy92ZWN0b3JVdGlscycpKTsiLCJ2YXIganF1ZXJ5ID0gJDtcclxudmFyIHVybCA9ICdwYXJ0cy91aS9jb21wb25lbnRzL2FjdGlvblNlbGVjdGlvbi5tdXN0YWNoZSc7XHJcblxyXG5mdW5jdGlvbiBlbmFibGUocGFyZW50LCBhY3Rpb25zKSB7XHJcbiAgICBpc0VuYWJsZWQgPSB0cnVlO1xyXG5cclxuICAgIGpxdWVyeS5nZXQodXJsLCBmdW5jdGlvbihkYXRhKXtcclxuICAgICAgICB2YXIgYWN0aW9uVGVtcGxhdGUgPSBIYW5kbGViYXJzLmNvbXBpbGUoZGF0YSk7XHJcbiAgICAgICAgdmFyIGFjdGlvbiA9IGFjdGlvblRlbXBsYXRlKHthY3Rpb25zOiBhY3Rpb25zfSk7XHJcbiAgICAgICAgcGFyZW50LmFwcGVuZChhY3Rpb24pO1xyXG5cclxuICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBhY3Rpb25zLmxlbmd0aDsgaSsrICkge1xyXG4gICAgICAgICAgICB2YXIgYWN0aW9uID0gYWN0aW9uc1tpXTtcclxuICAgICAgICAgICAgdmFyIGlkID0gYWN0aW9uLmlkO1xyXG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IGFjdGlvbi5oYW5kbGVyO1xyXG4gICAgICAgICAgICBqcXVlcnkoJyMnK2lkKS5jbGljayhoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZW5hYmxlOiBlbmFibGUsXHJcbiAgICBkaXNhYmxlOiBkaXNhYmxlXHJcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbihWZWN0b3IzLCBybmcpe1xyXG4gICAgZnVuY3Rpb24gcmFuZG9tQ29tcCgpIHtcclxuICAgICAgICByZXR1cm4gcm5nLnJhbmRvbSgpIC0gcm5nLnJhbmRvbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmFuZG9tVmVjdG9yOiBmdW5jdGlvbihzaXplKXtcclxuICAgICAgICAgICAgdmFyIHggPSByYW5kb21Db21wKCk7XHJcbiAgICAgICAgICAgIHZhciB5ID0gcmFuZG9tQ29tcCgpO1xyXG4gICAgICAgICAgICB2YXIgeiA9IHJhbmRvbUNvbXAoKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWZWN0b3IzKHgseSx6KS5zZXRMZW5ndGgoc2l6ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KShUSFJFRS5WZWN0b3IzLCBNYXRoKTsiXX0=

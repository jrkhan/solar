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
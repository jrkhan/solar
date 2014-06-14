var sceneFactory = require('solar/scene');
var threeScene;

function init() {
    var domElement = $('#game');
    var threeScene = sceneFactory(domElement);

    //add things here
    var cube = buildCube({
        width: 100,
        height: 100,
        depth: 100,
        color: 0x00ff00
    });

    var direction = new THREE.DirectionalLight( 0xFFFFFF, 0.5 );
    threeScene.addLights([
        new THREE.AmbientLight( 0x404040 ),
        direction
    ]);

    direction.position.set( 0, 200, 100 );

    threeScene.add(cube);


    threeScene.animate(function(){
        threeScene.camera.lookAt(cube.position);
    });
}

function buildCube(options) {
    var geometry = new THREE.CubeGeometry(options.width, options.depth, options.height);
    var material = new THREE.MeshLambertMaterial({ color: options.color });
    var cube = new THREE.Mesh( geometry, material );
    return cube;
}

init();
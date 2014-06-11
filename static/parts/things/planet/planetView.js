Solar.PlanetViewFactory = (function(){

    function getInitialUniforms() {

    }

    function getMaterial() {

    }

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

    return {
        makePlanetView: makePlanetView
    }
})();
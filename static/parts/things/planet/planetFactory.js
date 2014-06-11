Solar.PlanetFactory = (function(Physics, Random){

    function getOffset(up) {
        if ( up == undefined ) {
            up = new THREE.Vector3(0,1,0);
        }
        return new THREE.Vector3(25 + Random.random() * 10, 0, 15 + Random.random() * 10);
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
        Solar.Orbit.makeOrbital(planet);
        planet.orbit(thingToOrbit);
        var numMoons = maxMoons;
        for (var i = 0; i < numMoons; i++ ) {
            planet.moons.push(
                getPlanet(
                    new THREE.Vector3().addVectors(position, getOffset()),
                    planet,10,0
                )
            );
        }
        return planet;
    }
    return {
        getPlanet: getPlanet
    }
})(Solar.Physics, Math);
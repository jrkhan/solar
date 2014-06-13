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
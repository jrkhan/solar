var physics = require('solar/physics');
var orbit = require('solar/orbit');
describe("Orbit", function(){
    var planet, moon, star;
    var startingDistance = 1000;
    var planetStarDistance = 5000;
    var update;
    beforeEach(function(){
        planet = {};
        moon = {};
        star = {};

        physics.addPhysicsProperties(star);
        physics.addPhysicsProperties(planet);
        physics.addPhysicsProperties(moon, true);

        planet.position.z = -planetStarDistance;
        moon.position.set(planet.position.x + startingDistance, planet.position.y, planet.position.z);

        star.setMass(1000000);
        planet.setMass(1000);
        moon.setMass(.1);

        orbit.makeOrbital(star);
        orbit.makeOrbital(planet);
        orbit.makeOrbital(moon);

        moon.orbit(planet);
        planet.orbit(star);





        //distance from us to the planet
        //var dis = new THREE.Vector3().subVectors(planet.position, moon.position);
        //moon.x[moon.n-1] = new THREE.Vector3().subVectors(planet.previousPosition(), dis);

        update = function(times, eachTime){
            if (!times) {
                times = 1;
            }
            for ( var i = 0; i < times; i++ ) {
                star.recursivePhysicsUpdate(1);

                if ( eachTime != undefined ) {
                    eachTime();
                }

                //Solar.Physics.applyGravity(star, planet, true);
                //Solar.Physics.applyGravity(planet, moon, true);
                //star.physicsUpdate(1);
                //planet.physicsUpdate(1);
                //moon.physicsUpdate(1);

            }
        }

    });

    it("Should start out at one distance", function(){
        //the distance between the two should be the starting distance
        expect(planet.position.distanceTo(moon.position)).toBe(startingDistance);
        expect(planet.position.distanceTo(star.position)).toBe(planetStarDistance);
    });

    it("should have a previous position at that same distance", function(){
        expect( planet.x[planet.n-1].distanceTo(moon.x[moon.n -1]) ).toBe(startingDistance);
        expect(planet.x[planet.n-1].distanceTo(star.x[star.n -1])).toBe(planetStarDistance);
    });

    it("should have an unchanged distance after an update", function(){

        update();
        expect( planet.position.distanceTo(moon.position)).toBeCloseTo(startingDistance, 8);
        expect(planet.position.distanceTo(star.position)).toBeCloseTo(planetStarDistance, 8);

    });

    it("should move an equal amount each update", function(){
        update();
        //amount moved
        var amountMoved = planet.x[planet.n].distanceTo(planet.x[planet.n-1]);
        update(2);
        var secondAmountMoved = planet.x[planet.n].distanceTo(planet.x[planet.n-1]);
        expect(secondAmountMoved).toBe(amountMoved);
    });

    it("should have a (nearly) equal amount of gravity each update", function(){
        update(2);
        var gravityMagnitude = moon.a[moon.n-1].length();
        update();
        var secondGravityMagnitude = moon.a[moon.n-1].length();
        expect(secondGravityMagnitude).toBeCloseTo(gravityMagnitude, 5);
    });

    it("should have a (nearly) unchanged distance after two updates", function(){
        update(2);
        expect( planet.position.distanceTo(moon.position )).toBeCloseTo(startingDistance, 7);
        expect(planet.position.distanceTo(star.position)).toBeCloseTo(planetStarDistance, 7);

    });

    it("should have a (nearly) unchanged distance after 10000 updates", function(){
        update(9000);
        expect( planet.position.distanceTo(moon.position )).toBeCloseTo(startingDistance, 4);
        expect(planet.position.distanceTo(star.position)).toBeCloseTo(planetStarDistance, 4);
    });

    it("shouldn't matter if things are rotating", function() {
        update(100, afterEach(function(){
            planet.rotateOnAxis(new THREE.Vector3(0,0,1),.1);
        }));
        expect( planet.position.distanceTo(moon.position )).toBeCloseTo(startingDistance, 4);
        expect(planet.position.distanceTo(star.position)).toBeCloseTo(planetStarDistance, 4);
    });
});

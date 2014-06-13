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

},{"solar/orbit":1,"solar/physics":3}],5:[function(require,module,exports){
var physics = require('solar/physics');

describe("Physics", function(){
    var moon;

    beforeEach(function(){
        moon = {};
        physics.addPhysicsProperties(moon, false);

        moon.position = new THREE.Vector3(0,0,0);
        moon.mass = 1;

    });

    it("it should increment N on update if it's keeping history", function() {
        if (moon.isKeepingHistory) {
            moon.x[moon.n-1] = new THREE.Vector3(-10,0,0);

            moon.physicsUpdate(1);

            expect(moon.n).toBe(2);

            moon.physicsUpdate(1);

            expect(moon.n).toBe(3);
        }
    });

    it("should be able to move based on previous position", function(){
        moon.x[moon.n-1] = new THREE.Vector3(-10,0,0);

        moon.physicsUpdate(1);

        expect(moon.position.x).toBe(10);

        moon.physicsUpdate(1);

        expect(moon.position.x).toBe(20);
    });

    it("should be able to apply acceleration", function(){
        moon.a[moon.n] = new THREE.Vector3(1,0,0);
        moon.physicsUpdate(1);
        expect(moon.position.x).toBe(1);
        moon.physicsUpdate(1);
        expect(moon.position.x).toBe(2);
    });

});
},{"solar/physics":3}],6:[function(require,module,exports){
//just a list of tests to run
require('./spec/PhysicsSpec');
require('./spec/OrbitSpec');
},{"./spec/OrbitSpec":4,"./spec/PhysicsSpec":5}]},{},[6])
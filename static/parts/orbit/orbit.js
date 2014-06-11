Solar.Orbit = (function(OrbitList, V3){

    //set the object into immediate circular orbit
    //should be useful for initial setup of moons and planets
    //v = sqrt(G(m1+m2)/r)
    function orbitImmediately(self, other, planeNormal) {
        if ( planeNormal == null ) {
            planeNormal = new V3(0,1,0);
        }

        var tempA = {};
        tempA.position = new V3().copy(self.position);
        Solar.Physics.addPhysicsProperties(tempA);
        tempA.setMass(self.mass());

        var tempB = {};
        tempB.position = new V3().copy(other.position);
        Solar.Physics.addPhysicsProperties(tempB);
        tempB.setMass(other.mass());

        Solar.Physics.applyGravity(tempB, tempA, true);
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
                Solar.Physics.applyGravity(physicsObject, item, true);
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


    return {
        makeOrbital: function(o){addAbilityToOrbit(o); addAbilityToBeOrbited(o); },
        addAbilityToOrbit: addAbilityToOrbit,
        addAbilityToBeOrbited: addAbilityToBeOrbited
    };
})(Solar.OrbitList, THREE.Vector3);
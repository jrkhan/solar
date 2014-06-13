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
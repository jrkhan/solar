if ( Solar.Utils == undefined ) { Solar.Utils = {}; }
Solar.Utils.VectorUtils = (function(Vector3, rng){
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
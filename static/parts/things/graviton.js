/**
 * Created by Jamil on 4/20/14.
 */
//when we have a ton of things in a system, we'll need a way to handle gravity,
//tried fields before - going to try graviton instead

Solar.GravitonFactory = (function(){

    function newInstance() {
        var instance = {}
        Solar.Physics.addPhysicsProperties(instance);
        return instance;
    }
    Graviton.prototype = {


    }

    return {
        newInstance: newInstance
    }
})();
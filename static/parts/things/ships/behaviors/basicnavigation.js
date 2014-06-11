Solar.Ships.BasicNavigation = (function(time){

   /**
    all dependencies necessary for action creation are included, returns an action, the action is assumed to have an effect
    each update.
    */
    function startAccelerating(shipPhysicsObject, thruster) {
        //the thruster is assumed to be fixed in relation to the ship physicsObject, which is to say
        //all of the acceleration associated with the thruster is applied directly to the spo

        action = {
            startTime: time.now(),
            spo: shipPhysicsObject,
            update: function() {
                thruster.applyThrust();
            }
        };
    }



})(Solar.Game.Time);
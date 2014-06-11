Solar.Ships.Borg.Factory = (function(physics){

    function getBorg() {
        var borg = {};
        physics.addPhysicsProperties(borg);

        return borg;
    }

    function getBorgFactory() {
        return {
            getShip: getBorg
        }
    }

    return {
        getShipFactory: getBorgFactory
    }

})(Solar.Physics);
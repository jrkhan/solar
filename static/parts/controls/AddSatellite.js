Solar.AddSatellite = (function(){

    function configSatellite(thingToOrbit, satelliteFactory){
        var handler = function(intersection){
            satelliteFactory(intersection, thingToOrbit);
        }
        return handler;
    }



    return {
        configSatellite: configSatellite
    }
})();
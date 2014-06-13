exports.configSatellite = function(thingToOrbit, satelliteFactory){
    var handler = function(intersection){
        satelliteFactory(intersection, thingToOrbit);
    }
    return handler;
};


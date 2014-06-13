
module.exports = (function(assets){

    var vertex;
    var fragment;
    assets.getShader('parts/shaders/postProcessing.vs', function(data){
        vertex = data;
    });
    assets.getShader('parts/shaders/blur/blur.fs', function(data){
       fragment = data;
    });

    function instance() {
        return {
            uniforms: {

                "tDiffuse":       { type: "t",  value: null },
                "tSize":          { type: "v2", value: new THREE.Vector2( 256, 256 ) },
                "center":         { type: "v2", value: new THREE.Vector2( 0.5, 0.5 ) },
                "angle":          { type: "f",  value: 1.57 },
                "scale":          { type: "f",  value: 1.0 },
                "starColor":      { type: "v3", value: new THREE.Vector3(1,1,1)},
                "tDepth":         { type: "t",  value: null },
                "time":           { type: "f",  value: 0 },
                "cameraNear":     { type: "f",  value: 5 },
                "cameraFar":      { type: "f",  value: 100 },
                "maxDistance":    { type: "f",  value: 10000 },
                "distanceToStar": { type: "f",  value: 0 }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
        };
    }


    return {
        instance: instance
    }
})(require('../../../assets'));

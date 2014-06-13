module.exports = (function(assets){
    var vertex;
    var fragment;

    var kernel = [];

    var span = 2;

    for ( var i = -span; i < span; i++ ) {
        for ( var j = -span; j < span; j++) {
            var max = .05;
            var len = max*new THREE.Vector2(i,j).lengthSq()/(2 * span * span);
            kernel.push(new THREE.Vector3(i,j,len));
        }
    }

    assets.getShader('parts/shaders/postProcessing.vs', function(data){
        vertex = data;
    });
    assets.getShader('parts/shaders/bloom/bloom.fs', function(data){
        fragment = "#define KERNEL_SIZE_INT " + kernel.length + "\n" + data;
    });

    function instance() {
        return {
            uniforms: {
                "tDiffuse":     { type: "t",    value: null                     },
                "triggerColor": { type: "v3",   value: new THREE.Vector3(1,1,1) },
                "bloomColor":   { type: "v3",   value: new THREE.Vector3(1,1,1) },
                "kernel":       { type: "v3v",  value: kernel                   },
                "tSize":        { type: "v2",   value: new THREE.Vector2(100,100)}
            },
            vertexShader: vertex,
            fragmentShader: fragment
        };
    }

    return {
        instance: instance
    }

})(require('../../../assets'));
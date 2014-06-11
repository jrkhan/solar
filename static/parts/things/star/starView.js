Solar.StarViewFactory = (function(
    Geo,
    ParticleMaterial,
    Vertex,
    Vector3,
    ParticleSystem,
    rng,
    utils,
    assets){

    var sunFrag, sunVert;
    assets.getShader('parts/shaders/noise.fs', function(data){
        sunFrag = data;
    });
    assets.getShader('parts/shaders/default.vs', function(data){
        sunVert = data;
    });

    var texture = THREE.ImageUtils.loadTexture( 'images/water.jpg' );

    function hexToVector(hex) {
        var red = (hex >> 16)/255;
        var blue = (hex >> 8 & 0xFF)/255;
        var green = (hex & 0xFF)/255;
        var color = new Vector3(red, blue, green);
        return color;
    }

    function makeStarView(star) {
        var geometry = new THREE.IcosahedronGeometry(star.radius, 3);

        var mat = new THREE.MeshPhongMaterial({
            ambient: 0x55FF55,
            color: 0xCCFFCC,
            specular: 0xCCCCCC,
            shininess: 5,
            emissive: star.color,
            shading: THREE.SmoothShading,
            map: texture
        });

        var color = hexToVector(star.color);
        var secondaryColor = hexToVector(star.secondaryColor);

        var scaleValue = .0065 * star.radius;

        var uniforms = {
            time: 	{ type: "f", value: 1.0 },
            scale: 	{ type: "f", value: .02 },
            color:  { type: "v3", value: color },
            secondaryColor: { type: "v3", value: secondaryColor },
            camera: { type: "v3", value: new Vector3() }
        };


        var material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: sunVert,
            fragmentShader: sunFrag
        } );

        var starView = new THREE.Mesh( geometry, material );

        Solar.Physics.addPhysicsProperties(starView);
        starView.invMass = star.invMass;

        starView.light = new THREE.PointLight(star.color);
        starView.light.position = starView.position;
        starView.light.intensity = star.lum;
        starView.backgroundParticles = buildBackgroundParticles(star);
        starView.radialParticlesEmitters = buildRadialParticleEmitters(star);
        starView.uniforms = uniforms;


        //what we need to do each frame to update the view of the star
        starView.viewUpdate = function(dt, camera, size, starEffect ){
            starView.uniforms.time.value += .25 * dt;

            var df = 4500;
            starEffect.uniforms.maxDistance.value = df * df;
            var sp = new Vector3().copy(starView.position);
            starEffect.uniforms.distanceToStar.value = sp.sub(camera.position).lengthSq();


            animateRadialParticles(starView, dt);

            var vector = new Vector3();
            var projector = new THREE.Projector();
            projector.projectVector( vector.setFromMatrixPosition( starView.matrixWorld ), camera );

            var widthHalf = size.x/2;
            var heightHalf = size.y/2;
            vector.x = ( vector.x * widthHalf ) + widthHalf;
            vector.y = ( vector.y * heightHalf ) + heightHalf;
            starEffect.uniforms["center"].value = vector;

            return hexToVector(star.color);
        }

        return starView;
    }


    function animateRadialParticles(star, dt) {

        var emitters = star.radialParticlesEmitters;
        for ( var j = 0; j < emitters.length; j++ ) {
            var particles = star.radialParticlesEmitters[j];
            var emitter = particles.sunSpotEmitter;
            var vertices = particles.geometry.vertices;

            for ( var i = 0; i < vertices.length; i++ ) {
                var p = vertices[i];
                if (p.isActive) {
                    Solar.Physics.applyGravity(star, p.physics, true);
                    p.physics.physicsUpdate(dt);
                    p.copy(p.physics.position);

                    if (emitter.isInside(p)) {
                        p.isActive = false;
                        p.copy(star.position);
                        emitter.undeployed.push(p);
                        if ( emitter.undeployed.length == emitter.particleCount ) {

                        }
                    }
                }
            }
            if ( emitter.undeployed.length > 0 && emitter.currentWait == 0) {
                //spawn the particle
                var particle = emitter.undeployed.pop();
                var pp = particle.physics;
                pp.position.copy(emitter.position);
                pp.previousPosition().copy(emitter.position);

                var accel = new Vector3().copy(particle.physics.position).sub(star.position).setLength(emitter.baseAcceleration).add(
                    Solar.Utils.VectorUtils.randomVector(emitter.baseAcceleration/4)
                );
                particle.physics.acceleration().add(accel);
                particle.isActive = true;

                if ( emitter.undeployed.length == 0 ) {
                    emitter.pickNewPosition();
                    emitter.currentWait = emitter.randomWait();
                }
            }

            if ( emitter.currentWait > 0 ) {
                emitter.currentWait--;
            }
        }
    }

    function randMinusRand() {
        return rng.random() - rng.random();
    }

    function buildBackgroundParticles(star) {
        var particleCount = 400;
        var particles = new Geo();
        var mat = new ParticleMaterial({
            color: star.color,
            map: utils.loadTexture('/images/particles/dust.png'),
            size: 150,
            opacity:.025,
            transparent: true,
            blendDst: THREE.SrcAlphaFactor,
            blending: THREE.AdditiveBlending
        });
        mat.depthWrite = false;
        var pos = star.position;
        var max = pos.x + star.radius + 600;
        var min = pos.x + star.radius + 50;
        for (var i = 0; i < particleCount; i++) {
            var dist = rng.random() * (max - min) + min;
            var v = new Vector3(randMinusRand(),randMinusRand(), randMinusRand());
            v.setLength(dist);
            particles.vertices.push(v);
        }

        var particleSystem = new ParticleSystem(
            particles,
            mat
        );

        particleSystem.sortParticles = true;
        return particleSystem;
    }

    function randomPointOnSurface(star) {
        return new Vector3(randMinusRand(),randMinusRand(), randMinusRand()).setLength(star.radius).add(star.position);
    }

    function buildRadialParticleEmitters(star) {
        var emitters = [];

        for ( var i = 0; i < 15; i++ ) {
            emitters.push(buildRadialParticleEmitter(star));
        }
        return emitters;
    }

    function radialParticleMaterial(star) {
        return new ParticleMaterial({
            color: star.color,
            map: utils.loadTexture('/images/particles/dust.png'),
            size: 7 +.025 * star.radius,
            opacity: .25,
            transparent: true,
            blendDst: THREE.SrcAlphaFactor,
            blending: THREE.AdditiveBlending
        });
    }

    function buildRadialParticleEmitter(star) {
        var particleCount = 35;
        var particles = new Geo();

        var emitter = {};
        emitter.position = new Vector3();
        emitter.pickNewPosition = function(){
            emitter.position = randomPointOnSurface(star);
        };

        emitter.maxWait = 550;
        emitter.randomWait = function(){
            return rng.round(rng.random() * emitter.maxWait);
        }
        emitter.currentWait = emitter.randomWait();

        emitter.isInside = function(pos){
            return new Vector3().copy(pos).sub(star.position).lengthSq() < (star.radius * star.radius);
        };

        emitter.baseAcceleration = Math.sqrt(star.mass())/550;
        emitter.particleCount = particleCount;
        emitter.pickNewPosition();
        emitter.undeployed = [];

        for (var i = 0; i < particleCount; i++) {
            var v = new Vector3();
            var phy = v.physics = {};
            Solar.Physics.addPhysicsProperties(v.physics, false); //don't keep history

            var pPos = phy.position;
            pPos.copy(v);

            phy.mass(.001);
            emitter.undeployed.push(v);
            particles.vertices.push(v);
        }

        var particleSystem = new ParticleSystem(
            particles,
            radialParticleMaterial(star)
        );

        particleSystem.sunSpotEmitter = emitter;
        particleSystem.sortParticles = true;
        return particleSystem;
    }

    return {
        makeStarView: makeStarView
    }

})(THREE.Geometry,
   THREE.ParticleSystemMaterial,
   THREE.Vertex,
   THREE.Vector3,
   THREE.ParticleSystem,
   Math,
   THREE.ImageUtils,
   Solar.Assets);
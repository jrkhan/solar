(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

module.exports = function(domContainer) {
    var initNear = 10;
    var initFar = 10000;
    var width = domContainer.width();
    var height = domContainer.height();

    var renderer;
    renderer = new THREE.WebGLRenderer();
    renderer.antialias = true;
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    renderer.setSize( width, height );
    domContainer.append( renderer.domElement );

    var camera = new THREE.PerspectiveCamera( 65, width/height, initNear, initFar );
    camera.position.y = 250;
    camera.position.z = 400;

    var scene = new THREE.Scene();

    function animate(prerender, render) {
        var last = -1;
        if ( render == undefined ) {
            render = function() {
                renderer.render(scene, camera);
            }
        }
        if ( prerender == undefined ) {
            prerender = function(){}
        }
        var animationLoop = function(timestamp) {
            if ( timestamp > last ) {
                requestAnimationFrame(animationLoop);
                prerender(timestamp);
                render(timestamp);
                last = timestamp;
            }
        };
        animationLoop(0);
    }

    return {
        renderer: renderer,
        camera: camera,
        scene: scene,
        add: function(thingToAdd) {
            scene.add(thingToAdd);
        },
        addLights: function(lights) {
            for ( var i = 0; i < lights.length; i++ ) {
               scene.add(lights[i]);
            }
        },
        animate: animate
    }
};
},{}],2:[function(require,module,exports){
var sceneFactory = require('solar/scene');
var threeScene;

function init() {
    var domElement = $('#game');
    var threeScene = sceneFactory(domElement);

    //add things here
    var cube = buildCube({
        width: 100,
        height: 100,
        depth: 100,
        color: 0x00ff00
    });

    var direction = new THREE.DirectionalLight( 0xFFFFFF, 0.5 );
    threeScene.addLights([
        new THREE.AmbientLight( 0x404040 ),
        direction
    ]);

    direction.position.set( 0, 200, 100 );

    threeScene.add(cube);


    threeScene.animate(function(){
        threeScene.camera.lookAt(cube.position);
    });
}

function buildCube(options) {
    var geometry = new THREE.CubeGeometry(options.width, options.depth, options.height);
    var material = new THREE.MeshLambertMaterial({ color: options.color });
    var cube = new THREE.Mesh( geometry, material );
    return cube;
}

init();
},{"solar/scene":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXEphbWlsXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiQzovVXNlcnMvSmFtaWwvR29vZ2xlIERyaXZlL1Byb2plY3RzL3NvbGFyL25vZGVfbW9kdWxlcy9zb2xhci9zY2VuZS9kZWZhdWx0c2NlbmUuanMiLCJDOi9Vc2Vycy9KYW1pbC9Hb29nbGUgRHJpdmUvUHJvamVjdHMvc29sYXIvc3RhdGljL3NhbmRib3gvdG9ycXVlY3ViZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb21Db250YWluZXIpIHtcclxuICAgIHZhciBpbml0TmVhciA9IDEwO1xyXG4gICAgdmFyIGluaXRGYXIgPSAxMDAwMDtcclxuICAgIHZhciB3aWR0aCA9IGRvbUNvbnRhaW5lci53aWR0aCgpO1xyXG4gICAgdmFyIGhlaWdodCA9IGRvbUNvbnRhaW5lci5oZWlnaHQoKTtcclxuXHJcbiAgICB2YXIgcmVuZGVyZXI7XHJcbiAgICByZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCk7XHJcbiAgICByZW5kZXJlci5hbnRpYWxpYXMgPSB0cnVlO1xyXG4gICAgcmVuZGVyZXIuc2hhZG93TWFwRW5hYmxlZCA9IHRydWU7XHJcbiAgICByZW5kZXJlci5zaGFkb3dNYXBTb2Z0ID0gdHJ1ZTtcclxuICAgIHJlbmRlcmVyLnNldFNpemUoIHdpZHRoLCBoZWlnaHQgKTtcclxuICAgIGRvbUNvbnRhaW5lci5hcHBlbmQoIHJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcclxuXHJcbiAgICB2YXIgY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKCA2NSwgd2lkdGgvaGVpZ2h0LCBpbml0TmVhciwgaW5pdEZhciApO1xyXG4gICAgY2FtZXJhLnBvc2l0aW9uLnkgPSAyNTA7XHJcbiAgICBjYW1lcmEucG9zaXRpb24ueiA9IDQwMDtcclxuXHJcbiAgICB2YXIgc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcclxuXHJcbiAgICBmdW5jdGlvbiBhbmltYXRlKHByZXJlbmRlciwgcmVuZGVyKSB7XHJcbiAgICAgICAgdmFyIGxhc3QgPSAtMTtcclxuICAgICAgICBpZiAoIHJlbmRlciA9PSB1bmRlZmluZWQgKSB7XHJcbiAgICAgICAgICAgIHJlbmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyZXIucmVuZGVyKHNjZW5lLCBjYW1lcmEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICggcHJlcmVuZGVyID09IHVuZGVmaW5lZCApIHtcclxuICAgICAgICAgICAgcHJlcmVuZGVyID0gZnVuY3Rpb24oKXt9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBhbmltYXRpb25Mb29wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XHJcbiAgICAgICAgICAgIGlmICggdGltZXN0YW1wID4gbGFzdCApIHtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRpb25Mb29wKTtcclxuICAgICAgICAgICAgICAgIHByZXJlbmRlcih0aW1lc3RhbXApO1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyKHRpbWVzdGFtcCk7XHJcbiAgICAgICAgICAgICAgICBsYXN0ID0gdGltZXN0YW1wO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgICAgICBhbmltYXRpb25Mb29wKDApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcmVuZGVyZXI6IHJlbmRlcmVyLFxyXG4gICAgICAgIGNhbWVyYTogY2FtZXJhLFxyXG4gICAgICAgIHNjZW5lOiBzY2VuZSxcclxuICAgICAgICBhZGQ6IGZ1bmN0aW9uKHRoaW5nVG9BZGQpIHtcclxuICAgICAgICAgICAgc2NlbmUuYWRkKHRoaW5nVG9BZGQpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWRkTGlnaHRzOiBmdW5jdGlvbihsaWdodHMpIHtcclxuICAgICAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrICkge1xyXG4gICAgICAgICAgICAgICBzY2VuZS5hZGQobGlnaHRzW2ldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYW5pbWF0ZTogYW5pbWF0ZVxyXG4gICAgfVxyXG59OyIsInZhciBzY2VuZUZhY3RvcnkgPSByZXF1aXJlKCdzb2xhci9zY2VuZScpO1xyXG52YXIgdGhyZWVTY2VuZTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICB2YXIgZG9tRWxlbWVudCA9ICQoJyNnYW1lJyk7XHJcbiAgICB2YXIgdGhyZWVTY2VuZSA9IHNjZW5lRmFjdG9yeShkb21FbGVtZW50KTtcclxuXHJcbiAgICAvL2FkZCB0aGluZ3MgaGVyZVxyXG4gICAgdmFyIGN1YmUgPSBidWlsZEN1YmUoe1xyXG4gICAgICAgIHdpZHRoOiAxMDAsXHJcbiAgICAgICAgaGVpZ2h0OiAxMDAsXHJcbiAgICAgICAgZGVwdGg6IDEwMCxcclxuICAgICAgICBjb2xvcjogMHgwMGZmMDBcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBkaXJlY3Rpb24gPSBuZXcgVEhSRUUuRGlyZWN0aW9uYWxMaWdodCggMHhGRkZGRkYsIDAuNSApO1xyXG4gICAgdGhyZWVTY2VuZS5hZGRMaWdodHMoW1xyXG4gICAgICAgIG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoIDB4NDA0MDQwICksXHJcbiAgICAgICAgZGlyZWN0aW9uXHJcbiAgICBdKTtcclxuXHJcbiAgICBkaXJlY3Rpb24ucG9zaXRpb24uc2V0KCAwLCAyMDAsIDEwMCApO1xyXG5cclxuICAgIHRocmVlU2NlbmUuYWRkKGN1YmUpO1xyXG5cclxuXHJcbiAgICB0aHJlZVNjZW5lLmFuaW1hdGUoZnVuY3Rpb24oKXtcclxuICAgICAgICB0aHJlZVNjZW5lLmNhbWVyYS5sb29rQXQoY3ViZS5wb3NpdGlvbik7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gYnVpbGRDdWJlKG9wdGlvbnMpIHtcclxuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5DdWJlR2VvbWV0cnkob3B0aW9ucy53aWR0aCwgb3B0aW9ucy5kZXB0aCwgb3B0aW9ucy5oZWlnaHQpO1xyXG4gICAgdmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hMYW1iZXJ0TWF0ZXJpYWwoeyBjb2xvcjogb3B0aW9ucy5jb2xvciB9KTtcclxuICAgIHZhciBjdWJlID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBtYXRlcmlhbCApO1xyXG4gICAgcmV0dXJuIGN1YmU7XHJcbn1cclxuXHJcbmluaXQoKTsiXX0=

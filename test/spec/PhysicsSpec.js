describe("Physics", function(){
    var moon;

    beforeEach(function(){
        moon = {};
        Solar.Physics.addPhysicsProperties(moon, false);

        moon.position = new THREE.Vector3(0,0,0);
        moon.mass = 1;

    });

    it("it should increment N on update if it's keeping history", function() {
        if (moon.isKeepingHistory) {
            moon.x[moon.n-1] = new THREE.Vector3(-10,0,0);

            moon.physicsUpdate(1);

            expect(moon.n).toBe(2);

            moon.physicsUpdate(1);

            expect(moon.n).toBe(3);
        }
    });

    it("should be able to move based on previous position", function(){
        moon.x[moon.n-1] = new THREE.Vector3(-10,0,0);

        moon.physicsUpdate(1);

        expect(moon.position.x).toBe(10);

        moon.physicsUpdate(1);

        expect(moon.position.x).toBe(20);
    });

    it("should be able to apply acceleration", function(){
        moon.a[moon.n] = new THREE.Vector3(1,0,0);
        moon.physicsUpdate(1);
        expect(moon.position.x).toBe(1);
        moon.physicsUpdate(1);
        expect(moon.position.x).toBe(2);
    });

});
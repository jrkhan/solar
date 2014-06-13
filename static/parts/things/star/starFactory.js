var physics = require('../../physics/physics');


var StarTypes = [
    {
        starType: 'o',
        color: 0x0000FF,
        secondaryColor: 0x000033,
        temp: 25000,
        avgMass: 60,
        avgRadius: 15,
        avgLum: 1400000
    },
    {
        starType: 'b',
        color: 0x2222FF,
        secondaryColor: 0x000033,
        temp: 18000,
        avgMass: 18,
        avgRadius: 7,
        avgLum: 20000
    },
    {
        starType: 'a',
        color: 0x2222FF,
        secondaryColor: 0x000033,
        temp: 9250,
        avgMass: 3.2,
        avgRadius: 2.5,
        avgLum: 80
    },
    {
        starType: 'f',
        color: 0xEFEFFF,
        secondaryColor: 0xA6A6FF,
        temp: 6750,
        avgMass: 1.7,
        avgRadius: 1.3,
        avgLum: 6
    },
    {
        starType: 'g',
        color: 0xffE566,
        secondaryColor: 0xf6bd7c,
        temp: 5500,
        avgMass: 1.1,
        avgRadius: 1.1,
        avgLum: 1.2
    },
    {
        starType: 'k',
        color: 0xffE566,
        secondaryColor: 0xf6bd7c,
        temp: 4250,
        avgMass: .8,
        avgRadius:.9 ,
        avgLum: .4
    },
    {
        starType: 'm',
        color: 0xFF6666,
        secondaryColor: 0xDD3333,
        temp: 3000,
        avgMass: .3,
        avgRadius:.4,
        avgLum: .04
    }

];

var StarFactory = (function(types){

    var massOfTheSun = 50000;//2 * Math.pow(10, 30); //kg
    var radiusOfTheSun = 20;//695500; //km
    var base = 100;

    var variance = .05;

    //index types
    var byStarType = {};
    var letters = [];
    var numbers = [0,1,2,3,4,5,6,7,8,9];
    for ( var i = 0; i < types.length; i++) {
        byStarType[types[i].starType] = types[i];
        letters[i] = types[i].starType;
    }


    function randomLetter() {
        var hl = letters.length/2;
        return letters[Math.floor(Math.random() * hl + Math.random() * hl)];
    }

    function randomNumber() {
        return numbers[Math.floor(Math.random() * numbers.length)];
    }

    function vary(value, multiplier) {
        var base = value * multiplier;
        var offset = base * (Math.random() * variance) - (Math.random() * variance);
        return base + offset;
    }
    function getStar(type) {
        if (!type) {
            type = randomLetter() + randomNumber();

        }
        var spectralType = type.charAt(0);
        var spectralNumber = type.charAt(1);

        var proto = byStarType[spectralType];

        var multiplier = 1 + spectralNumber/5;

        var star = {};

        physics.addPhysicsProperties(star);

        star.setMass(vary(proto.avgMass * massOfTheSun, multiplier));
        star.color = proto.color;
        star.secondaryColor = proto.secondaryColor;
        star.temp = vary(proto.temp, multiplier);
        star.radius = vary(proto.avgRadius * radiusOfTheSun, multiplier);
        star.lum = Math.log(base + vary(proto.avgLum, multiplier))/Math.log(base);

        return star;
    }

    return {
        getStar: getStar
    }
})(StarTypes);

module.exports = {
    starTypes: StarTypes,
    getStar: StarFactory.getStar
};
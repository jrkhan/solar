describe("AutoTagger", function(){
  var tagger;

  beforeEach(function() {
    tagger = autoTagger;
  });

  it ("should be defined", function(){
    expect(tagger).toBeDefined();
  });


  it ("should be able to find the distance between two cordinates with reasonable accuracy", function() {
    var pointA = {lat: 50, lon: 5};
    var pointB = {lat: 51, lon: 51};

    var distance = tagger.distanceBetweenCoordinates(pointA, pointB);

    expect(distance).toBeCloseTo(3202, 0);

  });


  it ("should let us know if a location belongs with a group", function() {
    var locA = {lat: 50,     lon: 5};
    var locB = {lat: 50.001, lon: 5};
    var locC = {lat: 49.999, lon: 4.999}; //belongs with A and B
    var locD = {lat: 60,     lon: 40};    //does not belogn with A and B
    expect(tagger.doesLocationBelongWithGroup(locC, [locA, locB])).toBe(true);
    expect(tagger.doesLocationBelongWithGroup(locD, [locA, locB])).toBe(false);
  });



  it ("should be able to recognize locations which are not exactly the same but close to each other as belonging to a group", function(){

    var locations = [
      { lat: 80.00001, lon: 10,       },
      { lat: 80,       lon: 10.00001  },
      { lat: 79.99999, lon: 10        },
      { lat: 40,       lon: 12        },
      { lat: 80,       lon: 10        },
    ];

    expect(function(){tagger.groupLocations()}).toThrow(new TypeError("Cannot read property 'length' of undefined"));

    var groups = tagger.groupLocations(locations);
    expect(groups.length).toEqual(2);

    var smaller = groups[0].length < groups[1].length ? groups[0] : groups[1];
    expect(smaller.length).toEqual(1);
    expect(smaller[0].lat).toEqual(40);
    expect(smaller[0].lon).toEqual(12);

    var larger = groups[0].length < groups[1].length ? groups[1] : groups[0];
    expect(larger.length).toEqual(4);

  });
});

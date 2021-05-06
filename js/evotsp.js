(function evoTSPwrapper($) {
  const baseUrl =
    "https://1hykustfe8.execute-api.us-east-1.amazonaws.com/beta";

  var cityData;
  var lengthStoreThreshold = Infinity;
  var best = {
    runID: "", // The ID of the best current path
    bestPath: [], // The array of indices of best current path
    len: Infinity, // The length of the best current path
    coords: [], // The coordinates of the best current path
    lRoute: [[], []], // best route as lat-long data
  };

  function runEvolution() {
    const runId = generateUID(16);
    const initialGeneration = 0;
    $("#runId-text-field").val(runId);
    $("#current-generation").text(initialGeneration);
    $("#best-route-list").text("");

    async.series([  
      initializePopulation, 
      runAllGenerations,    
      showAllDoneAlert,    
    ]);

    function initializePopulation(cb) {
      const populationSize = parseInt($("#population-size-text-field").val());
      console.log(
        `Initializing pop for runId = ${runId} with pop size ${populationSize}, generation = ${initialGeneration}`
      );
      $("#new-route-list").text("");
      async.times(
        populationSize, 
        (counter, rr_cb) => randomRoute(runId, initialGeneration, rr_cb),
        cb
      );
    }
    
    function runAllGenerations(cb) {
      const numGenerations = parseInt($("#num-generations").val());

      async.timesSeries(
        numGenerations,
        runGeneration,
        cb
      );
    }

    function showAllDoneAlert(cb) {
      alert("All done! (but there could still be some GUI updates)");
      cb();
    }

    // Generate a unique ID; lifted from https://stackoverflow.com/a/63363662
    function generateUID(length) {
      return window
        .btoa(
          Array.from(window.crypto.getRandomValues(new Uint8Array(length * 2)))
            .map((b) => String.fromCharCode(b))
            .join("")
        )
        .replace(/[+/]/g, "")
        .substring(0, length);
    }  
  }

  function randomRoute(runId, generation, cb) {
    $.ajax({
        method: 'POST',
        url: baseUrl + '/routes',
        data: JSON.stringify({
            runId: runId,
            generation: generation,
            lengthStoreThreshold: lengthStoreThreshold,
        }),
        contentType: 'application/json',
        success: function onSuccess(newRoute) {
          displayRoute(newRoute);
          cb(null, newRoute);
          },
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
          console.error(
              'Error generating random route: ', 
              textStatus, 
              ', Details: ', 
              errorThrown);
          console.error('Response: ', jqXHR.responseText);
          alert('An error occurred when creating a random route:\n' + jqXHR.responseText);
        }
    })
  }

  function runGeneration(generation, cb) {
    const popSize = parseInt($("#population-size-text-field").val());
    console.log(`Running generation ${generation}`);

    async.waterfall(
      [
        wait5seconds,
        updateGenerationHTMLcomponents,
        async.constant(generation), 
        (gen, log_cb) => logValue("generation", gen, log_cb), 
        getBestRoutes, 
        (parents, log_cb) => logValue("parents", parents, log_cb), 
        displayBestRoutes,   
        updateThresholdLimit, 
        generateChildren,
        (children, log_cb) => logValue("children", children, log_cb),
        displayChildren,  
        updateBestRoute
      ],
      cb
    );

    function logValue(label, value, log_cb) {
      console.log(`In waterfall: ${label} = ${JSON.stringify(value)}`);
      log_cb(null, value);
    }

    function wait5seconds(wait_cb) {
      console.log(`Starting sleep at ${Date.now()}`);
      setTimeout(function () {
        console.log(`Done sleeping gen ${generation} at ${Date.now()}`);
        wait_cb(); // Call wait_cb() after the message to "move on" through the waterfall
      }, 5000);
    }

    function updateGenerationHTMLcomponents(reset_cb) {
      $("#new-route-list").text("");
      $("#current-generation").text(generation + 1);
      reset_cb();
    }

    function generateChildren (parents, genChildren_cb) {
      const numChildren = Math.floor(popSize / parents.length);

      async.concat( 
        parents,
        (parent, makeChildren_cb) => {
          makeChildren(parent, numChildren, generation, makeChildren_cb);
        },
        genChildren_cb
      );
    }

    function updateThresholdLimit(bestRoutes, utl_cb) {
      if (bestRoutes.length == 0) {
        const errorMessage = 'We got no best routes back. We probably overwhelmed the write capacity for the database.';
        alert(errorMessage);
        throw new Error(errorMessage);
      }

      lengthStoreThreshold = bestRoutes[bestRoutes.length - 1].len;
      $("#current-threshold").text(lengthStoreThreshold);
      utl_cb(null, bestRoutes);
    }
  }

  function getBestRoutes(generation, callback) {
    const numToReturn = $("#num-parents").val();
    const runId = $("#runId-text-field").val();

    $.ajax({
      method: 'GET',
      url: baseUrl + `/best?runId=${runId}&generation=${generation}&numToReturn=${numToReturn}`,
      contentType: 'application/json',
      success: (bestRoutes) => callback(null, bestRoutes),
      error: function ajaxError(jqXHR, textStatus, errorThrown) {
          console.error(
              'Error generating best routes: ', 
              textStatus, 
              ', Details: ', 
              errorThrown);
          console.error('Response: ', jqXHR.responseText);
          alert('An error occurred when getting the best routes:\n' + jqXHR.responseText);
      }
  });
  }

  function makeChildren(parent, numChildren, generation, cb) {
    const store = lengthStoreThreshold;
    
    
    $.ajax({
      method: 'POST',
      url: baseUrl + '/mutateRoute',
      data: JSON.stringify({
        routeId: parent.routeId,
        numOfChildren: numChildren,
        lengthStoreThreshold: store
      }),
      contentType: 'application/json',
      success: (result) => cb(null, JSON.parse(result.body)),
      error: function ajaxError(jqXHR, textStatus, errorThrown) {
          console.error(
              'Error generating children: ', 
              textStatus, 
              ', Details: ', 
              errorThrown);
          console.error('Response: ', jqXHR.responseText);
          alert('An error occurred when getting children:\n' + jqXHR.responseText);
      }
  })
  }

  function getRouteById(routeId, callback) {
    $.ajax({
      method: 'GET',
      url: baseUrl + '/routes' + '/' + routeId,
      contentType: 'application/json',
      success: function onSuccess(result) {
        console.log(result);
        callback(result.Item);
      },
      error: function ajaxError(jqXHR, textStatus, errorThrown) {
          console.error(
              'Error getting route: ', 
              textStatus, 
              ', Details: ', 
              errorThrown);
          console.error('Response: ', jqXHR.responseText);
          alert('An error occurred when getting the route:\n' + jqXHR.responseText);
      }
  })
  }

  function fetchCityData(callback) {
    $.ajax({
      method: 'GET',
      url: baseUrl + '/city-data',
      contentType: 'application/json',
      success: (result) => callback(JSON.parse(result.body)),
      error: function ajaxError(jqXHR, textStatus, errorThrown) {
          console.error(
              'Error getting city data: ', 
              textStatus, 
              ', Details: ', 
              errorThrown);
          console.error('Response: ', jqXHR.responseText);
          alert('An error occurred when getting city data:\n' + jqXHR.responseText);
      }
  })
  }

  function displayBestPath() {
    $("#best-length").text(best.len);
    $("#best-path").text(JSON.stringify(best.bestPath));
    $("#best-routeId").text(best.routeId);
    $("#best-route-cities").text("");
    best.bestPath.forEach((index) => {
      const cityName = cityData[index].properties.name;
      $("#best-route-cities").append(`<li>${cityName}</li>`);
    });
  }

  function displayChildren(children, dc_cb) {
    children.forEach(child => displayRoute(child));
    dc_cb(null, children);
  }

  function displayRoute(result) {
    const routeId = result.routeId;
    const length = result.len;
    $('#new-route-list').append(`<li>We generated route ${routeId} with length ${length}.</li>`);
  }

  function displayBestRoutes(bestRoutes, dbp_cb) {
    bestRoutes.forEach(route => {
      const Id = route.routeId;
      const length = route.len;
      $('#best-route-list')
      .append(`<li>Route ID: ${Id} <br>
               Length: ${length} </li>`);
    });

    dbp_cb(null, bestRoutes);
  }

  function updateBestRoute(children, ubr_cb) {
    children.forEach(child => {
      if (child.len < best.len) {
        updateBest(child.routeId);
      }
    });
    ubr_cb(null, children);
  }

  function updateBest(routeId) {
    console.log(routeId + "This is in updateBest");
    getRouteById(routeId, processNewRoute);

    function processNewRoute(route) {
      console.log(best.len + "/" + JSON.stringify(route) + "this is the best");
      if (best.len > route.len && route == "") {
        console.log(`Getting route ${routeId} failed; trying again.`);
        updateBest(routeId);
        return;
      }
      if (best.len > route.len) {
        console.log(`Updating Best Route for ${routeId}`);
        best.routeId = routeId;
        best.len = route.len;
        best.bestPath = route.route;
        displayBestPath(); // Display the best route on the HTML page
        best.bestPath[route.route.length] = route.route[0]; // Loop Back
        updateMapCoordinates(best.bestPath); 
        mapCurrentBestRoute();
      }
    }
  }

  function mapCurrentBestRoute() {
    var lineStyle = {
      dashArray: [10, 20],
      weight: 5,
      color: "#0000FF",
    };

    var fillStyle = {
      weight: 5,
      color: "#FFFFFF",
    };

    if (best.lRoute[0].length == 0) {
      // Initialize first time around
      best.lRoute[0] = L.polyline(best.coords, fillStyle).addTo(mymap);
      best.lRoute[1] = L.polyline(best.coords, lineStyle).addTo(mymap);
    } else {
      best.lRoute[0] = best.lRoute[0].setLatLngs(best.coords);
      best.lRoute[1] = best.lRoute[1].setLatLngs(best.coords);
    }
  }

  function initializeMap(cities) {
    cityData = [];
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      const cityName = city.cityName;
      var geojsonFeature = {
        type: "Feature",
        properties: {
          name: "",
          show_on_map: true,
          popupContent: "CITY",
        },
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
      };
      geojsonFeature.properties.name = cityName;
      geojsonFeature.properties.popupContent = cityName;
      geojsonFeature.geometry.coordinates[0] = city.location[1];
      geojsonFeature.geometry.coordinates[1] = city.location[0];
      cityData[i] = geojsonFeature;
    }

    var layerProcessing = {
      pointToLayer: circleConvert,
      onEachFeature: onEachFeature,
    };

    L.geoJSON(cityData, layerProcessing).addTo(mymap);

    function onEachFeature(feature, layer) {
      // does this feature have a property named popupContent?
      if (feature.properties && feature.properties.popupContent) {
        layer.bindPopup(feature.properties.popupContent);
      }
    }

    function circleConvert(feature, latlng) {
      return new L.CircleMarker(latlng, { radius: 5, color: "#FF0000" });
    }
  }

  function updateMapCoordinates(path) {
    function swap(arr) {
      return [arr[1], arr[0]];
    }
    for (var i = 0; i < path.length; i++) {
      best.coords[i] = swap(cityData[path[i]].geometry.coordinates);
    }
    best.coords[i] = best.coords[0]; // End where we started
  }

  $(function onDocReady() {
    // These set you up with some reasonable defaults.
    $("#population-size-text-field").val(100);
    $("#num-parents").val(20);
    $("#num-generations").val(15);
    $("#run-evolution").click(runEvolution);
    // Get all the city data (names, etc.) once up
    // front to be used in the mapping throughout.
    fetchCityData(initializeMap);
  });
})(jQuery);

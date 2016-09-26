Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    updateInterval: 5 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,
    width: 440,
    testElementID: "forecast-io-test-element",
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-rain-mix',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },

    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'd3.min.js',
      'jsonp.js'
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-forecast-io.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase+'/'+this.config.apiKey+'/'+this.config.latitude+','+this.config.longitude+'?units='+units+'&lang='+this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this));
    }
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      // need this for the initial load
      wrapper.appendChild(this.createTextWidthTestElement());
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var minutely       = this.weatherData.minutely;

    var large = document.createElement("div");
    large.className = "large light";

    var iconClass = this.config.iconTable[minutely.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;
    large.appendChild(icon);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    // remove ending '.' for consistency with the interface
    var summaryText = minutely.summary.replace(/\.$/, '');
    var summary = document.createElement("div");
    summary.className = "small dimmed";
    summary.innerHTML = summaryText;

    wrapper.appendChild(large);
    wrapper.appendChild(summary);

    wrapper.appendChild(this.renderWeatherForecast());

    // need this for subsequent loads
    wrapper.appendChild(this.createTextWidthTestElement());

    return wrapper;
  },

  createTextWidthTestElement: function () {
    var element = document.createElement("div");
    element.id = this.config.testElementID;
    element.style.position = 'absolute';
    element.style.visibility = 'hidden';
    element.style.height = 'auto';
    element.style.width = 'auto';
    element.style['white-space'] = 'nowrap';
    return element;
  },

  getTextWidth: function (text) {
    var element = document.getElementById(this.config.testElementID);
    element.innerHTML = text;
    return element.clientWidth + 1;
  },

  renderForecastRow: function (data, min, max) {
    var width = this.config.width - 20;
    var row = document.createElement("div");
    row.style.width = width;
    var total = max - min;
    var rowMin = Math.round(data.temperatureMin);
    var rowMax = Math.round(data.temperatureMax);
    var percentLeft  = Math.round(100 * ((rowMin - min) / total));
    var percentRight = Math.round(100 * ((max - rowMax) / total));
    row.style["margin-left"]  = percentLeft + "%";
    row.className = "forecast-row";
    var minTempTextDiv = document.createElement("div");
    var minTempText = this.roundTemp(rowMin) + "\u00B0";
    minTempTextDiv.innerHTML = minTempText;
    minTempTextDiv.style.width = this.getTextWidth(minTempText) + "px";
    minTempTextDiv.className = "temp min-temp";
    var maxTempTextDiv = document.createElement("div");
    var maxTempText = this.roundTemp(rowMax) + "\u00B0";
    maxTempTextDiv.innerHTML = maxTempText;
    maxTempTextDiv.style.width = this.getTextWidth(maxTempText) + "px";
    maxTempTextDiv.className = "temp max-temp";
    var bar = document.createElement("div");
    bar.className = "bar";
    var barWidth = width - 100;
    barWidth = Math.round(barWidth * ((rowMax - rowMin) / total));
    bar.style.width = barWidth + 'px';
    row.appendChild(minTempTextDiv);
    row.appendChild(bar);
    row.appendChild(maxTempTextDiv);
    return row;
  },

  // Draw the weekly forecast as a graph, similar to how Dark Sky does.  Each day is drawn as a bar
  // prepresenting the low and high temperature.
  renderWeatherForecast: function () {
    // Add 10 pixels per extra decimal place so that the temperature labels fit
    var marginL       = 85 + (this.config.tempDecimalPlaces * 10);
    var marginR       = 17 + (this.config.tempDecimalPlaces * 10);
    var marginT       =  2;
    var marginB       = 10;
    var lineMargin    =  8;
    var dayRightEdge  = 37;
    var barShift      =  8;
    var barTextMargin =  2;
    var barTextShift  = -2;
    var iconRightEdge = dayRightEdge + 27;
    var w = 200; // parseInt( $('.weekgraph').css('width') );
    var h = 500; // parseInt( $('.weekgraph').css('height') );
    var numDays       =  7;
    var lineHeight    = (h - marginT - marginB) / numDays;
    var opacityShift  =  0.12
    var self          = this;

    var i;

    var filteredDays =
      this.weatherData.daily.data.filter( function(d, i) { return (i < numDays); });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.temperatureMin);
      max = Math.max(max, day.temperatureMax);
    }
    min = Math.round(min);
    max = Math.round(max);

    var display = document.createElement("div");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max)
      display.appendChild(row);
    }
    return display;

    // Set up the SVG
    var weekGraphSVG = document.createElement("svg");
    weekGraphSVG = d3.select(weekGraphSVG)
      .attr('width',  w)
      .attr('height', h)

    // Set up the scale for the temps
    var tempXScale = d3.scaleLinear().domain([ d3.min( filteredDays, function(d) { return d.temperatureMin } ),
      d3.max( filteredDays, function(d) { return d.temperatureMax } ) ])
        .range([ marginL, w - marginR ]);

    // Add the freezing and hot lines
    updateWeatherForcast_UpdateWeeklyGraph_HotColdLine( 32, "freezeLine", "\uf076",  0 )      // f076 is wi-snowflake-cold
    updateWeatherForcast_UpdateWeeklyGraph_HotColdLine( 80, "hotLine",    "\uf072", -4 )      // f076 is wi-hot

    // Draw labels down the left side
    // - Create the labels
    weekGraphSVG.selectAll( ".weekgraphDayText" )
      .data( filteredDays )
      .enter()
      .append( "text" )
      .attr(   "class", "weekgraphDayText" )
      .attr(   "x", dayRightEdge )
      .attr(   "text-anchor", "end")
      .style(  "fill",    function(d,i) { return shadeColor2( "#DDDDDD", -i * opacityShift ) } );

    // - Update all labels
    weekGraphSVG.selectAll( ".weekgraphDayText" )
      .text( function(d) {
        var dt = new Date( d.time * 1000 );
        return moment.weekdaysShort( dt.getDay() );
      })
      .attr( "y", function(d,i) {
        return i * lineHeight + lineHeight + marginT;
      });

    // Draw the weather icon to the right of each day
    // - Create the icon label
    weekGraphSVG.selectAll( ".weekgraphDayIcon" )
      .data( filteredDays )
      .enter()
      .append( "text" )
      .attr(   "class", "weekgraphDayIcon wi" )
      .attr(   "x", iconRightEdge )
      .attr(   "text-anchor", "end")
      .style(  "fill",    function(d,i) { return shadeColor2( "#DDDDDD", -i * opacityShift ) } );

    var iconTable = this.config.svgIconTable;
    weekGraphSVG.selectAll( ".weekgraphDayIcon" )
      .text( function(d) {
        return iconTable[ d.icon ];
      })
      .attr( "y", function(d,i) {
        return i * lineHeight + lineHeight + marginT;
      });

    // Draw rounded rectangles for each day
    // - Add one rect per day
    weekGraphSVG.selectAll( ".weekgraphDayTempBar" )
      .data( filteredDays )
      .enter()
      .append( "rect" )
      .attr(   "class", "weekgraphDayTempBar" )
      .attr(   "y",  function(d,i) {
        return i * lineHeight + marginT + lineMargin + barShift;
      })
      .attr(   "height",   lineHeight - lineMargin*2  )
      .attr(   "ry",      (lineHeight - lineMargin)/4 )
      .attr(   "rx",      (lineHeight - lineMargin)/4 )
      .style(  "fill",    function(d,i) { return shadeColor2( "#DDDDDD", -i * opacityShift ) } );

    // - Update the left and right edges of the rect
    weekGraphSVG.selectAll( ".weekgraphDayTempBar" )
      .attr(   "x",     function(d,i) {
        return tempXScale( d.temperatureMin );
      })
      .attr(   "width", function(d,i) {
        return tempXScale( d.temperatureMax ) - tempXScale( d.temperatureMin );
      });


    // Draw temperature labels on the left and right side of each bar
    // - Create min labels
    weekGraphSVG.selectAll( ".weekgraphTempTextMin" )
      .data( filteredDays )
      .enter()
      .append( "text" )
      .attr(   "class", "weekgraphTempTextMin weekgraphTempText" )
      .attr(   "text-anchor", "end")
      .style(  "fill",    function(d,i) { return shadeColor2( "#DDDDDD", -i * opacityShift ) } );

    // - Update all min labels
    weekGraphSVG.selectAll( ".weekgraphTempTextMin" )
      .text( function(d) {
        return self.roundTemp( d.temperatureMin ).toString() + "\u00B0"; // Unicode for &deg;
      })
      .attr( "x", function(d,i) {
        return tempXScale( d.temperatureMin ) - barTextMargin;
      })
      .attr( "y", function(d,i) {
        return i * lineHeight + lineHeight + marginT + barTextShift;
      });

    // - Create max labels
    weekGraphSVG.selectAll( ".weekgraphTempTextMax" )
      .data( filteredDays )
      .enter()
      .append( "text" )
      .attr(   "class", "weekgraphTempTextMax weekgraphTempText" )
      .attr(   "text-anchor", "begin")
      .style(  "fill",    function(d,i) { return shadeColor2( "#DDDDDD", -i * opacityShift ) } );

    // - Update all max labels
    weekGraphSVG.selectAll( ".weekgraphTempTextMax" )
      .text( function(d) {
        return self.roundTemp( d.temperatureMax ).toString() + "\u00B0"; // Unicode for &deg;
      })
      .attr( "x", function(d,i) {
        return tempXScale( d.temperatureMax ) + barTextMargin;
      })
      .attr( "y", function(d,i) {
        return i * lineHeight + lineHeight + marginT + barTextShift;
      });

    // from http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
    function shadeColor2(color, percent) {
      var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
      return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
    }

    function updateWeatherForcast_UpdateWeeklyGraph_HotColdLine( temp, className, icon, offset ) {  // Subfunction of updateWeatherForcast_UpdateWeeklyGraph() for access to tempXScale
      // Draw a line across the graph and place an icon at a given temperature
      var tempPoint = tempXScale( temp );

      // Add/update the line
      if( weekGraphSVG.select( ".tempGraphHotColdLine ." + className ).empty() ) {
        weekGraphSVG.append( "line").attr("class", "tempGraphHotColdLine " + className );
      }

      weekGraphSVG.select( ".tempGraphHotColdLine." + className).attr("x1", tempPoint ).attr("y1", marginT + lineMargin + barShift )
        .attr("x2", tempPoint ).attr("y2", h - marginB )
        .attr( "opacity", ((tempPoint > marginL) && (tempPoint < (w - marginR))) ? 1.0 : 0.0 );

    }

    return weekGraphSVG.node();
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});

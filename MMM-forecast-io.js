Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    showIndoorTemperature: false,
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
    showForecast: true,
    maxDaysForecast: 7,   // maximum number of days to show in forecast
    enablePrecipitationGraph: true,
    alwaysShowPrecipitationGraph: false,
    precipitationGraphWidth: 400,
    precipitationFillColor: 'white',
    precipitationProbabilityThreshold: 0.1,
    precipitationIntensityScaleTop: 0.2,
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
      'jsonp.js',
      'moment.js'
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

    // still accept the old config
    if (this.config.hasOwnProperty("showPrecipitationGraph")) {
      this.config.enablePrecipitationGraph = this.config.showPrecipitationGraph;
    }

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

    var url = this.config.apiBase + '/' + this.config.apiKey + '/' + this.config.latitude + ',' + this.config.longitude + '?units=' + units + '&lang=' + this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this), this.processWeatherError.bind(this));
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

  processWeatherError: function (error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    // try later
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
      case "INDOOR_TEMPERATURE":
        if (this.config.showIndoorTemperature) {
          this.roomTemperature = payload;
          this.updateDom(this.config.animationSpeed);
        }
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
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var hourly         = this.weatherData.hourly;
    var minutely       = this.weatherData.minutely;

    var large = document.createElement("div");
    large.className = "large light";

    var icon = currentWeather ? currentWeather.icon : hourly.icon;
    var iconClass = this.config.iconTable[icon];
    var icon = document.createElement("span");
    icon.className = 'big-icon wi ' + iconClass;
    large.appendChild(icon);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    if (this.roomTemperature !== undefined) {
      var icon = document.createElement("span");
      icon.className = 'fa fa-home';
      large.appendChild(icon);

      var temperature = document.createElement("span");
      temperature.className = "bright";
      temperature.innerHTML = " " + this.roomTemperature + "&deg;";
      large.appendChild(temperature);
    }

    var summaryText = minutely ? minutely.summary : hourly.summary;
    var summary = document.createElement("div");
    summary.className = "small dimmed summary";
    summary.innerHTML = summaryText;

    wrapper.appendChild(large);
    wrapper.appendChild(summary);

    if (this.config.alwaysShowPrecipitationGraph ||
        (this.config.enablePrecipitationGraph &&
         this.isAnyPrecipitation(minutely))) {
      wrapper.appendChild(this.renderPrecipitationGraph());
    }

    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    return wrapper;
  },

  isAnyPrecipitation: function (minutely) {
    if (!minutely) {
      return false;
    }
    var data = this.weatherData.minutely.data;
    var threshold = this.config.precipitationProbabilityThreshold;
    for (i = 0; i < data.length; i++) {
      if (data[i].precipProbability > threshold) {
        return true;
      }
    }
    return false;
  },

  renderPrecipitationGraph: function () {
    var i;
    var width = this.config.precipitationGraphWidth;
    var height = Math.round(width * 0.3);
    var element = document.createElement('canvas');
    element.className = "precipitation-graph";
    element.width  = width;
    element.height = height;
    var context = element.getContext('2d');

    var sixth = Math.round(width / 6);
    context.save();
    context.strokeStyle = 'gray';
    context.lineWidth = 2;
    for (i = 1; i < 6; i++) {
      context.moveTo(i * sixth, height);
      context.lineTo(i * sixth, height - 10);
      context.stroke();
    }
    context.restore();

    var third = Math.round(height / 3);
    context.save();
    context.strokeStyle = 'gray';
    context.setLineDash([5, 15]);
    context.lineWidth = 1;
    for (i = 1; i < 3; i++) {
      context.moveTo(0, i * third);
      context.lineTo(width, i * third);
      context.stroke();
    }
    context.restore();

    var data = this.weatherData.minutely.data;
    var stepSize = Math.round(width / data.length);
    context.save();
    context.strokeStyle = 'white';
    context.fillStyle = this.config.precipitationFillColor;
    context.globalCompositeOperation = 'xor';
    context.beginPath();
    context.moveTo(0, height);
    var threshold = this.config.precipitationProbabilityThreshold;
    var intensity;

    // figure out how we're going to scale our graph
    var maxIntensity = 0;
    for (i = 0; i < data.length; i++) {
      maxIntensity = Math.max(maxIntensity, data[i].precipIntensity);
    }
    // if current intensity is above our normal scale top, make that the top
    if (maxIntensity < this.config.precipitationIntensityScaleTop) {
      maxIntensity = this.config.precipitationIntensityScaleTop;
    }

    for (i = 0; i < data.length; i++) {
      if (data[i].precipProbability < threshold) {
        intensity = 0;
      } else {
        intensity = height * (data[i].precipIntensity / maxIntensity);
      }
      context.lineTo(i * stepSize, height - intensity);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
    context.restore();

    return element;
  },

  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForecastRow: function (data, min, max) {
    var total = max - min;
    var interval = 100 / total;
    var rowMinTemp = this.roundTemp(data.temperatureMin);
    var rowMaxTemp = this.roundTemp(data.temperatureMax);

    var row = document.createElement("tr");
    row.className = "forecast-row";

    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day"
    dayTextSpan.innerHTML = this.getDayFromTime(data.time);
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    var forecastBar = document.createElement("div");
    forecastBar.className = "forecast-bar";

    var minTemp = document.createElement("span");
    minTemp.innerHTML = rowMinTemp + "&deg;";
    minTemp.className = "temp min-temp";

    var maxTemp = document.createElement("span");
    maxTemp.innerHTML = rowMaxTemp + "&deg;";
    maxTemp.className = "temp max-temp";

    var bar = document.createElement("span");
    bar.className = "bar";
    bar.innerHTML = "&nbsp;";
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';

    var leftSpacer = document.createElement("span");
    leftSpacer.style.width = (interval * (rowMinTemp - min)) + "%";
    var rightSpacer = document.createElement("span");
    rightSpacer.style.width = (interval * (max - rowMaxTemp)) + "%";

    forecastBar.appendChild(leftSpacer);
    forecastBar.appendChild(minTemp);
    forecastBar.appendChild(bar);
    forecastBar.appendChild(maxTemp);
    forecastBar.appendChild(rightSpacer);

    var forecastBarWrapper = document.createElement("td");
    forecastBarWrapper.appendChild(forecastBar);

    row.appendChild(dayTextSpan);
    row.appendChild(icon);
    row.appendChild(forecastBarWrapper);

    return row;
  },

  renderWeatherForecast: function () {
    var numDays =  this.config.maxDaysForecast;
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

    var display = document.createElement("table");
    display.className = "forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max);
      display.appendChild(row);
    }
    return display;
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

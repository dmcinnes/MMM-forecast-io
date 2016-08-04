Module.register("MM-forecast-io", {

  defaults: {
    apikey: "",
    units: config.units,
    updateInterval: 5 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude: null,
    longitude: null,

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
    return ['jsonp.js'];
  },

  getStyles: function () {
    return ["weather-icons.css", "MM-forecast-io.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null && this.config.longitude == null;
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

    var self = this;
    var retry = true;
    var url = 'https://api.forecast.io/forecast/'+this.config.apikey+'/'+this.config.latitude+','+this.config.longitude;
    getJSONP(url, this.processWeather.bind(this));
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.weatherData.currently.temperature;
    if (this.config.units == 'metric') {
      this.temp = (this.temp - 32) / 1.8;
    }
    this.temp = Math.round(this.temp);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apikey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apikey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocaiton lookup failed, please set i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
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

    return wrapper;
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

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  },

});

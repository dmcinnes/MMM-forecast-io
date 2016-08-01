Module.register("MM-forecast-io", {

  defaults: {
    apikey: "",
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,

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
    }
  },

  getTranslations: function() {
    return false;
  },

  start: function() {
    Log.info("Starting module: " + this.name);
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  jsonp: function (url, callback) {
    var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    window[callbackName] = function(data) {
      delete window[callbackName];
      document.body.removeChild(script);
      callback(data);
    };

    var script = document.createElement('script');
    script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
    document.body.appendChild(script);
  },

  updateWeather: function() {
    var self = this;
    var retry = true;
    var url = 'https://api.forecast.io/forecast/'+this.config.apikey+'/'+this.config.latitude+','+this.config.longitude;
    this.jsonp(url, this.processWeather.bind(this));
  },

  processWeather: function (data) {
    console.log('process', data);
  },

  scheduleUpdate: function (delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  },

  renderWeather: function (currentWeather, minuteWeather) {
    var temp = Math.round(currentWeather.temperature);

    var wind = Math.round(currentWeather.windSpeed);

    var iconClass = iconTable[currentWeather.icon];
    var icon = $('<span/>').addClass('icon dimmed wi').addClass(iconClass);
    $('.temp').updateWithText(icon.outerHTML()+temp+'&deg;', 1000);

    if (wind > 0) {
      var bearingIcon = '';
      var bearing = currentWeather.windBearing;
      if (bearing !== undefined) {
        bearing = (bearing + 22.5) % 360;
        var bearingIndex = Math.floor(bearing / 45);
        bearingIcon = $('<span/>').addClass('xdimmed wi').addClass(bearingIcons[bearingIndex]);
      }

      var windString = '<span class="wi wi-strong-wind xdimmed"></span> ' + wind + ' ' + bearingIcon.outerHTML();
      $('.wind').updateWithText(windString, 1000);
    } else {
      $('.wind').updateWithText('', 1000);
    }

    // remove ending '.' for consistancy
    var summary = minuteWeather.summary.replace(/\.$/, '');
    $('.weather-summary').updateWithText(summary, 1000);
  },

  renderForecast: function (forcast) {
    var forecastTable = $('<table />').addClass('forecast-table');
    var weekday = (new Date()).getDay();
    var days = forcast.data;
    var opacity = 1;
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var row = $('<tr />').css('opacity', opacity);
      if (i === 0) {
        row.addClass('today');
      }

      row.append($('<td/>').addClass('day').html(moment.weekdaysShort(weekday)));
      row.append($('<td/>').addClass('temp-min').html(Math.round(day.temperatureMin)));
      row.append($('<td/>').addClass('temp-max').html(Math.round(day.temperatureMax)));
      forecastTable.append(row);
      weekday = (weekday + 1) % 7;
      opacity -= 0.1;
    }

    $('.forecast').updateWithText(forecastTable, 1000);
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apikey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apikey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.config.latitude === "" || this.config.longitude === "") {
      wrapper.innerHTML = "Please set the forcast.io <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      return wrapper;
    }

    // var temp     = document.createElement("div");
    // var summary  = document.createElement("div");
    // var forecast = document.createElement("div");
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

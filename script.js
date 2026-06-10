const WMO = {
  0: ["Clear sky","☀️"], 1: ["Mostly clear","🌤️"], 2: ["Partly cloudy","⛅"], 3: ["Overcast","☁️"],
  45: ["Foggy","🌫️"], 48: ["Icy fog","🌫️"], 51: ["Light drizzle","🌦️"], 53: ["Drizzle","🌦️"],
  55: ["Heavy drizzle","🌧️"], 61: ["Light rain","🌧️"], 63: ["Rain","🌧️"], 65: ["Heavy rain","🌧️"],
  71: ["Light snow","🌨️"], 73: ["Snow","❄️"], 75: ["Heavy snow","❄️"], 77: ["Snow grains","🌨️"],
  80: ["Rain showers","🌦️"], 81: ["Rain showers","🌧️"], 82: ["Violent showers","⛈️"],
  85: ["Snow showers","🌨️"], 86: ["Heavy snow showers","❄️"],
  95: ["Thunderstorm","⛈️"], 96: ["Thunderstorm + hail","⛈️"], 99: ["Heavy thunderstorm","⛈️"]
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function hide(id) { document.getElementById(id).style.display = 'none'; }
function showBlock(id) { document.getElementById(id).style.display = 'block'; }
function showGrid(id) { document.getElementById(id).style.display = 'grid'; }
function setText(id, val) { document.getElementById(id).textContent = val; }
function setError(msg) {
  const el = document.getElementById('error-box');
  el.textContent = msg; el.style.display = 'block';
}
function clearError() { document.getElementById('error-box').style.display = 'none'; }

document.getElementById('city-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchCity();
});

async function searchCity() {
  const q = document.getElementById('city-input').value.trim();
  if (!q) return;
  clearError();
  hide('empty-state');
  showBlock('loading');
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      hide('loading'); setError(`City "${q}" not found. Try a different spelling.`); return;
    }
    const r = geoData.results[0];
    await loadWeather(r.latitude, r.longitude, r.name, r.country || '');
  } catch(e) {
    hide('loading'); setError('Could not connect. Check your internet and try again.');
  }
}

async function getLocation() {
  if (!navigator.geolocation) { setError('Geolocation not supported.'); return; }
  clearError(); hide('empty-state'); showBlock('loading');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      await loadWeather(pos.coords.latitude, pos.coords.longitude, 'My Location', '');
    },
    () => { hide('loading'); setError('Location access denied. Search by city name instead.'); }
  );
}

async function loadWeather(lat, lon, city, country) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,visibility&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    const d = await res.json();
    hide('loading');
    renderWeather(d, city, country);
  } catch(e) {
    hide('loading'); setError('Weather data unavailable. Please try again.');
  }
}

function renderWeather(d, city, country) {
  const cur = d.current;
  const wcode = cur.weather_code;
  const [desc, icon] = WMO[wcode] || ['Unknown', '🌡️'];

  setText('city-name', city);
  setText('city-country', country);
  document.getElementById('temp-big').innerHTML = Math.round(cur.temperature_2m) + '<span class="temp-unit">°C</span>';
  setText('weather-desc', desc);
  setText('feels-like', `Feels like ${Math.round(cur.apparent_temperature)}°C`);
  setText('weather-icon', icon);
  setText('humidity', cur.relative_humidity_2m + '%');
  setText('wind', Math.round(cur.wind_speed_10m) + ' km/h');
  setText('uv', uvLabel(cur.uv_index));
  setText('visibility', cur.visibility >= 1000 ? Math.round(cur.visibility / 1000) + ' km' : cur.visibility + ' m');

  const bgMap = { clear:'#1a6fa8', cloudy:'#5a7a94', rain:'#3a5f7a', snow:'#6a8fa8', storm:'#2a3a4a' };
  let bg = bgMap.clear;
  if ([45,48].includes(wcode)) bg = bgMap.cloudy;
  else if (wcode >= 50 && wcode <= 67) bg = bgMap.rain;
  else if (wcode >= 70 && wcode <= 77) bg = bgMap.snow;
  else if (wcode >= 80 && wcode <= 82) bg = bgMap.rain;
  else if (wcode >= 95) bg = bgMap.storm;
  else if (wcode >= 2) bg = bgMap.cloudy;
  document.getElementById('main-card').style.background = bg;

  showBlock('main-card');
  showGrid('stats-grid');
  renderHourly(d.hourly);
  renderForecast(d.daily);
  setText('update-time', 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
  showBlock('update-time');
}

function renderHourly(hourly) {
  const now = new Date();
  let html = '', count = 0;
  for (let i = 0; i < hourly.time.length && count < 12; i++) {
    const t = new Date(hourly.time[i]);
    if (t < now && t.getHours() !== now.getHours()) continue;
    const isNow = t.getHours() === now.getHours() && t.getDate() === now.getDate();
    const [, icon] = WMO[hourly.weather_code[i]] || ['', '🌡️'];
    const label = isNow ? 'Now' : t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    html += `<div class="hour-chip${isNow?' now':''}">
      <div class="hour-time">${label}</div>
      <div class="hour-icon">${icon}</div>
      <div class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</div>
    </div>`;
    count++;
  }
  document.getElementById('hourly-scroll').innerHTML = html;
  showBlock('hourly-section');
}

function renderForecast(daily) {
  let html = '';
  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i] + 'T12:00:00');
    const day = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[date.getDay()];
    const [desc, icon] = WMO[daily.weather_code[i]] || ['—', '🌡️'];
    html += `<div class="forecast-row">
      <span class="fc-day">${day}</span>
      <span class="fc-icon">${icon}</span>
      <span class="fc-desc">${desc}</span>
      <span class="fc-temps">
        <span class="fc-high">${Math.round(daily.temperature_2m_max[i])}°</span>
        <span class="fc-low">${Math.round(daily.temperature_2m_min[i])}°</span>
      </span>
    </div>`;
  }
  document.getElementById('forecast-list').innerHTML = html;
  showBlock('forecast-section');
}

function uvLabel(uv) {
  if (uv == null) return '—';
  const v = Math.round(uv);
  if (v <= 2) return v + ' Low';
  if (v <= 5) return v + ' Mod';
  if (v <= 7) return v + ' High';
  if (v <= 10) return v + ' V.High';
  return v + ' Extreme';
}
const $ = (id) => document.getElementById(id);

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };

const WEATHER_TEXT = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",
  48:"Depositing rime fog",51:"Light drizzle",53:"Moderate drizzle",55:"Dense drizzle",
  61:"Slight rain",63:"Moderate rain",65:"Heavy rain",71:"Slight snow",73:"Moderate snow",
  75:"Heavy snow",80:"Rain showers",81:"Moderate rain showers",82:"Violent rain showers",
  95:"Thunderstorm",96:"Thunderstorm with hail",99:"Severe thunderstorm with hail"
};

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather service error. Please try again.");
  return r.json();
}

async function fetchRisk(city) {
  const geo = await getJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  if (!geo.results || !geo.results.length) throw new Error(`City '${city}' was not found.`);
  const g = geo.results[0];
  const w = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum&forecast_days=7&timezone=auto`
  );
  return calculateRisk(g.name || city, g.country || "", w, g.latitude, g.longitude);
}

function calculateRisk(location, country, weather, latitude, longitude) {
  const cur = weather.current || {};
  const daily = weather.daily || {};
  const temperature = num(cur.temperature_2m);
  const humidity = num(cur.relative_humidity_2m);
  const precipitation = num(cur.precipitation);
  const wind = num(cur.wind_speed_10m);
  const code = num(cur.weather_code);
  const rain7 = (daily.precipitation_sum || []).reduce((a, x) => a + num(x), 0);

  const heat = temperature <= 25 ? 15 : clamp((temperature - 25) * 7);

  let flood = clamp(rain7 * 1.6) * 0.60 + clamp(precipitation * 15) * 0.40;
  if ([65, 82, 95, 96, 99].includes(code)) flood += 20;
  flood = clamp(flood);

  const drought = clamp((100 - humidity) * 0.55 + clamp(70 - rain7, 0, 70) * 0.45);
  const waterStress = clamp(drought * 0.85 + (100 - humidity) * 0.15);
  const exposure = clamp(35 + heat * 0.25 + flood * 0.25 + drought * 0.15);
  const infra = clamp(30 + heat * 0.25 + flood * 0.40 + drought * 0.20);
  const vegetation = clamp(drought * 0.60 + heat * 0.40);

  const score = Math.round(clamp(
    heat * 0.20 + flood * 0.20 + drought * 0.15 + waterStress * 0.15 +
    exposure * 0.10 + infra * 0.10 + vegetation * 0.10
  ) * 10) / 10;

  let level, priority;
  if (score >= 70) { level = "High"; priority = "Immediate"; }
  else if (score >= 40) { level = "Moderate"; priority = "Planned"; }
  else { level = "Low"; priority = "Routine"; }

  const r1 = x => Math.round(x * 10) / 10;
  const components = {
    "Heat Risk": r1(heat), "Flood Risk": r1(flood), "Drought Risk": r1(drought),
    "Water Stress": r1(waterStress), "Exposure": r1(exposure),
    "Infrastructure": r1(infra), "Vegetation Pressure": r1(vegetation)
  };
  const focus = Object.keys(components).reduce((a, b) => components[a] >= components[b] ? a : b);

  let actions = [];
  if (heat >= 40) actions.push("Heat Action Plan", "Create shaded public spaces", "Increase urban tree cover");
  if (flood >= 40) actions.push("Improve storm-water drainage", "Protect flood-prone infrastructure", "Increase rainwater harvesting");
  if (drought >= 40) actions.push("Use drought-tolerant crops", "Improve irrigation efficiency", "Increase groundwater recharge");
  if (waterStress >= 40) actions.push("Improve water-use efficiency", "Reduce distribution losses");
  if (infra >= 50) actions.push("Climate-proof critical infrastructure", "Strengthen emergency response");
  if (vegetation >= 50) actions.push("Restore green corridors", "Protect wetlands and natural buffers");
  if (!actions.length) actions = ["Continue climate monitoring", "Maintain existing resilience measures", "Perform periodic risk assessments"];

  return {
    location, country, latitude: num(latitude), longitude: num(longitude),
    weather: {
      temperature: r1(temperature), humidity: r1(humidity),
      precipitation: Math.round(precipitation * 100) / 100,
      wind_speed: r1(wind), rainfall_7day: r1(rain7),
      description: WEATHER_TEXT[Math.trunc(code)] || "Unknown"
    },
    score, level, priority, focus, components, actions,
    timestamp: new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    })
  };
}

function saveHistory(result) {
  try {
    const list = JSON.parse(localStorage.getItem("climateHistory") || "[]");
    list.unshift({
      location: result.location, country: result.country,
      score: result.score, level: result.level, created_at: result.timestamp
    });
    localStorage.setItem("climateHistory", JSON.stringify(list.slice(0, 10)));
  } catch (e) { console.error(e); }
}

async function runAssessment() {
  const city = $("location").value.trim();
  if (!city) { alert("Please enter a city name."); return; }

  const button = $("assess");
  button.disabled = true;
  button.textContent = "Searching...";
  try {
    const result = await fetchRisk(city);
    renderResult(result);
    saveHistory(result);
    loadHistory();
  } catch (error) {
    console.error("Assessment error:", error);
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Search & Assess";
  }
}

function renderResult(result) {
    $("locationInfo").classList.remove("hidden");
    $("placeName").textContent = result.location || "Unknown";
    $("country").textContent = result.country || "Unknown";

    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    $("coordinates").textContent =
        Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
        : "Coordinates unavailable";

    const score = Number(result.score);
    $("score").textContent = Number.isFinite(score) ? `${score}/100` : "—";
    $("level").textContent = result.level ? `${result.level} Risk` : "—";
    $("priority").textContent = result.priority || "—";
    $("focus").textContent = `Primary focus: ${result.focus || "—"}`;

    const weather = result.weather || {};
    const temperature = Number(weather.temperature);
    const humidity = Number(weather.humidity);
    const precipitation = Number(weather.precipitation);
    const wind = Number(weather.wind_speed);
    const rainfall = Number(weather.rainfall_7day);

    $("temperatureDisplay").textContent = Number.isFinite(temperature) ? `${temperature}°C` : "—";
    $("weatherTemperature").textContent = Number.isFinite(temperature) ? `${temperature} °C` : "—";
    $("weatherDescription").textContent = weather.description || "—";
    $("condition").textContent = weather.description || "—";
    $("humidity").textContent = Number.isFinite(humidity) ? `${humidity} %` : "—";
    $("precipitation").textContent = Number.isFinite(precipitation) ? `${precipitation} mm` : "—";
    $("wind").textContent = Number.isFinite(wind) ? `${wind} km/h` : "—";
    $("rainfallDisplay").textContent = Number.isFinite(rainfall) ? `${rainfall} mm` : "—";
    $("rainfall7").textContent = Number.isFinite(rainfall) ? `${rainfall} mm` : "—";

    const bars = $("bars");
    bars.innerHTML = "";
    const components = result.components || {};
    const entries = Object.entries(components);

    if (!entries.length) {
        bars.innerHTML = '<div class="empty">Risk components unavailable.</div>';
    } else {
        entries.forEach(([name, value]) => {
            const row = document.createElement("div");
            row.className = "barrow";
            const numericValue = Math.max(0, Math.min(100, Number(value) || 0));
            row.innerHTML = `
                <div class="barline"><span>${escapeHTML(name)}</span><b>${numericValue.toFixed(1)}</b></div>
                <div class="track"><div class="fill" style="width:${numericValue}%"></div></div>`;
            bars.appendChild(row);
        });
    }

    const actions = $("actions");
    actions.innerHTML = "";
    const recommendations = Array.isArray(result.actions) ? result.actions : [];

    if (!recommendations.length) {
        actions.innerHTML = '<span class="muted">No recommendations available.</span>';
    } else {
        recommendations.forEach(action => {
            const item = document.createElement("div");
            item.className = "action";
            item.textContent = `✓ ${action}`;
            actions.appendChild(item);
        });
    }
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function runDemo() {
    $("location").value = "Hyderabad";
    runAssessment();
}

function loadHistory() {
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem("climateHistory") || "[]"); } catch (e) {}
  const history = $("history");
  history.innerHTML = "";
  if (!rows.length) {
    history.innerHTML = '<tr><td colspan="5">No assessments yet.</td></tr>';
    return;
  }
  rows.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><b>${escapeHTML(item.location || "Unknown")}</b></td>
      <td>${escapeHTML(item.country || "—")}</td>
      <td>${item.score ?? "—"}</td>
      <td><span class="level-badge">${escapeHTML(item.level || "—")}</span></td>
      <td>${escapeHTML(item.created_at || "—")}</td>`;
    history.appendChild(row);
  });
}

$("location").addEventListener("keydown", event => {
  if (event.key === "Enter") runAssessment();
});
$("assess").addEventListener("click", runAssessment);
$("demo").addEventListener("click", runDemo);
$("refresh").addEventListener("click", loadHistory);
loadHistory();

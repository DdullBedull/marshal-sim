const TYPE_LABEL = {
  persimpangan: "Persimpangan",
  putar_balik: "Putar balik",
  water_station: "Water station",
  lurus: "Ruas lurus",
};
const TYPE_COLOR = {
  persimpangan: "#dc2626",
  putar_balik: "#9333ea",
  water_station: "#0891b2",
  lurus: "#65a30d",
};

const $ = (id) => document.getElementById(id);
const num = (id) => parseFloat($(id).value);

const map = L.map("map").setView([-6.2, 106.8], 13);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const state = {
  file: null,
  pts: [],
  dist: [],
  length: 0,
  line: null,
  points: [],
  typeCount: {},
};

function setStatus(msg, isErr = false) {
  const s = $("status");
  s.textContent = msg;
  s.className = isErr ? "err" : "";
}

function haversineKm(a, b) {
  const R = 6371.0088, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("File GPX tidak valid");
  const pts = [...doc.getElementsByTagName("trkpt")].map((p) => [
    parseFloat(p.getAttribute("lat")),
    parseFloat(p.getAttribute("lon")),
  ]);
  if (pts.length < 2) throw new Error("GPX harus punya minimal 2 titik track");
  return pts;
}

// cari titik terdekat di garis rute (proyeksi ke segmen), hasilnya km dari start
function snapToRoute(latlng) {
  const kx = 111.32 * Math.cos((latlng.lat * Math.PI) / 180);
  const ky = 110.574;
  let best = { d: Infinity };
  for (let i = 0; i < state.pts.length - 1; i++) {
    const [la1, lo1] = state.pts[i];
    const [la2, lo2] = state.pts[i + 1];
    const ax = (lo1 - latlng.lng) * kx, ay = (la1 - latlng.lat) * ky;
    const bx = (lo2 - latlng.lng) * kx, by = (la2 - latlng.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best.d) {
      best = { d, i, t, lat: la1 + t * (la2 - la1), lng: lo1 + t * (lo2 - lo1) };
    }
  }
  const segLen = state.dist[best.i + 1] - state.dist[best.i];
  best.km = state.dist[best.i] + best.t * segLen;
  return best;
}

function clearPoints() {
  state.points.forEach((p) => map.removeLayer(p.marker));
  state.points = [];
  state.typeCount = {};
  renderPoints();
}

function loadRoute(file, pts) {
  clearPoints();
  if (state.line) map.removeLayer(state.line);
  state.file = file;
  state.pts = pts;
  state.dist = [0];
  for (let i = 1; i < pts.length; i++) {
    state.dist.push(state.dist[i - 1] + haversineKm(pts[i - 1], pts[i]));
  }
  state.length = state.dist[state.dist.length - 1];
  state.line = L.polyline(pts, { color: "#2563eb", weight: 5, interactive: false }).addTo(map);
  map.fitBounds(state.line.getBounds(), { padding: [40, 40] });
  $("routeInfo").textContent = `${file.name}: ${pts.length} titik, ${state.length.toFixed(2)} km`;
  $("run").disabled = false;
  $("results").innerHTML = "";
  setStatus("");
}

function addPoint(km, latlng) {
  const type = $("pointType").value;
  state.typeCount[type] = (state.typeCount[type] || 0) + 1;
  const point = { name: `${TYPE_LABEL[type]} ${state.typeCount[type]}`, km, type };
  point.marker = L.circleMarker(latlng, {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: TYPE_COLOR[type],
    fillOpacity: 1,
    bubblingMouseEvents: false,
  }).addTo(map);
  point.marker.bindTooltip(point.name);
  state.points.push(point);
  state.points.sort((a, b) => a.km - b.km);
  renderPoints();
}

function renderPoints() {
  const box = $("pointList");
  box.innerHTML = "";
  state.points.forEach((p) => {
    const row = document.createElement("div");
    row.className = "pt";

    const name = document.createElement("input");
    name.value = p.name;
    name.addEventListener("input", () => {
      p.name = name.value;
      p.marker.setTooltipContent(p.name || "-");
    });

    const info = document.createElement("small");
    info.textContent = `km ${p.km.toFixed(2)}`;

    const del = document.createElement("button");
    del.className = "ghost";
    del.textContent = "hapus";
    del.addEventListener("click", () => {
      map.removeLayer(p.marker);
      state.points = state.points.filter((x) => x !== p);
      renderPoints();
    });

    row.append(name, info, del);
    box.append(row);
  });
}

function formatError(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc || []).join(".")}: ${d.msg}`).join("; ");
  }
  return "Terjadi kesalahan";
}

function renderResults(r) {
  const box = $("results");
  box.innerHTML = "";

  const h = document.createElement("h2");
  h.textContent = "Rekomendasi pos";
  box.append(h);

  if (!r.recommendations.length) {
    const p = document.createElement("div");
    p.className = "hint";
    p.textContent = "Belum ada pos. Klik di garis rute untuk menambah pos.";
    box.append(p);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.overflowX = "auto";
  const table = document.createElement("table");

  const headRow = table.createTHead().insertRow();
  ["Pos", "Puncak (menit)", "Aktif (menit)", "Marshal"].forEach((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    headRow.append(th);
  });

  const tbody = table.createTBody();
  r.recommendations.forEach((x) => {
    const tr = tbody.insertRow();
    const cells = [
      x.pos,
      x.mulai == null ? "-" : `${x.puncak} (m${x.menit_puncak})`,
      x.mulai == null ? "-" : `${x.mulai}-${x.selesai}`,
      x.marshal,
    ];
    cells.forEach((c) => {
      tr.insertCell().textContent = c;
    });
  });

  wrap.append(table);
  box.append(wrap);

  const total = document.createElement("div");
  total.className = "total";
  total.textContent = `Total: ${r.total_marshal} marshal`;
  box.append(total);
}

$("gpx").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    loadRoute(file, parseGpx(await file.text()));
  } catch (err) {
    setStatus(err.message, true);
  }
});

map.on("click", (e) => {
  if (!state.pts.length) {
    setStatus("Upload file GPX dulu.", true);
    return;
  }
  const snap = snapToRoute(e.latlng);
  const mpp = (40075016.686 * Math.cos((e.latlng.lat * Math.PI) / 180)) /
    (256 * Math.pow(2, map.getZoom()));
  if (snap.d > (25 * mpp) / 1000) {
    setStatus("Klik lebih dekat ke garis rute.", true);
    return;
  }
  const km = Math.min(Math.round(snap.km * 1000) / 1000, Math.max(state.length - 0.005, 0));
  addPoint(km, L.latLng(snap.lat, snap.lng));
  setStatus("");
});

$("run").addEventListener("click", async () => {
  const config = {
    categories: [{
      name: $("catName").value || "Kategori",
      distance_km: num("distance"),
      count: Math.round(num("count")),
      pace_mean: num("paceMean"),
      pace_std: num("paceStd"),
      start_offset_min: num("startOffset"),
      start_spread_min: num("startSpread"),
    }],
    points: state.points.map((p) => ({ name: p.name || "Pos", km: p.km, type: p.type })),
    seed: Math.round(num("seed")),
    capacity: num("capacity"),
  };

  const form = new FormData();
  form.append("gpx", state.file);
  form.append("config", JSON.stringify(config));

  setStatus("Menghitung...");
  $("run").disabled = true;
  try {
    const res = await fetch("/api/simulate", { method: "POST", body: form });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
    if (!res.ok) throw new Error(formatError(body.detail));
    window.lastResult = body;
    renderResults(body);
    setStatus(`Selesai: ${body.n_runners} pelari disimulasikan.`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $("run").disabled = false;
  }
});
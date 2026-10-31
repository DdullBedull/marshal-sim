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
    showCharts(body);
    setStatus(`Selesai: ${body.n_runners} pelari disimulasikan.`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $("run").disabled = false;
  }
});

// ---------- grafik dan heatmap ----------

let chart = null;

const LINE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777"];
const INFERNO = [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]];

function colorAt(v) {
  const x = Math.min(Math.max(v, 0), 1) * (INFERNO.length - 1);
  const i = Math.min(Math.floor(x), INFERNO.length - 2);
  const f = x - i;
  return INFERNO[i].map((c, k) => Math.round(c + (INFERNO[i + 1][k] - c) * f));
}

function niceStep(range, target) {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

function showCharts(r) {
  const panel = $("charts");
  if (!r.recommendations.length) {
    panel.hidden = true;
    map.invalidateSize();
    return;
  }
  panel.hidden = false;
  map.invalidateSize();
  drawChart(r);
  drawHeatmap(r);
}

function drawChart(r) {
  const { density, times_min, step_km } = r.sim;
  const datasets = r.recommendations.map((p, i) => {
    const b = Math.min(Math.floor(p.km / step_km), density[0].length - 1);
    const color = LINE_COLORS[i % LINE_COLORS.length];
    return {
      label: `${p.pos} (km ${p.km})`,
      data: density.map((row) => row[b]),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2,
    };
  });

  if (chart) chart.destroy();
  chart = new Chart($("lineChart"), {
    type: "line",
    data: { labels: times_min, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        title: { display: true, text: "Kepadatan per pos" },
        legend: { position: "bottom", labels: { boxWidth: 12 } },
      },
      scales: {
        x: { title: { display: true, text: "Menit sejak start" }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: "Pelari/km" }, beginAtZero: true },
      },
    },
  });
}

function drawHeatmap(r) {
  const canvas = $("heatmap");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const { density, times_min, step_km } = r.sim;
  const nT = density.length, nB = density[0].length;
  const dt = nT > 1 ? times_min[1] - times_min[0] : 1;
  const xMax = nB * step_km, yMax = nT * dt;
  const maxV = Math.max(...density.map((row) => Math.max(...row))) || 1;

  // grid kepadatan digambar 1 piksel per sel, lalu di-scale ke area plot
  const off = document.createElement("canvas");
  off.width = nB;
  off.height = nT;
  const octx = off.getContext("2d");
  const img = octx.createImageData(nB, nT);
  for (let t = 0; t < nT; t++) {
    for (let b = 0; b < nB; b++) {
      const [rr, g, bl] = colorAt(density[t][b] / maxV);
      const k = ((nT - 1 - t) * nB + b) * 4;   // waktu 0 ada di bawah
      img.data[k] = rr;
      img.data[k + 1] = g;
      img.data[k + 2] = bl;
      img.data[k + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);

  const m = { l: 46, r: 16, t: 28, b: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, m.l, m.t, pw, ph);

  // garis dan nama pos
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  r.recommendations.forEach((p) => {
    const x = m.l + (p.km / xMax) * pw;
    ctx.beginPath();
    ctx.moveTo(x, m.t);
    ctx.lineTo(x, m.t + ph);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  r.recommendations.forEach((p) => {
    const x = m.l + (p.km / xMax) * pw;
    ctx.save();
    ctx.translate(x - 3, m.t + 4);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(p.pos, 0, 0);
    ctx.restore();
  });

  // sumbu
  ctx.fillStyle = "#1d2433";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Heatmap kepadatan (maks ${Math.round(maxV)} pelari/km)`, m.l + pw / 2, 16);
  ctx.fillText("Jarak dari start (km)", m.l + pw / 2, H - 6);

  const xs = niceStep(xMax, 6);
  for (let i = 0; i * xs <= xMax + 1e-9; i++) {
    ctx.fillText(+(i * xs).toFixed(2), m.l + ((i * xs) / xMax) * pw, m.t + ph + 15);
  }

  ctx.textAlign = "right";
  const ys = niceStep(yMax, 5);
  for (let i = 0; i * ys <= yMax + 1e-9; i++) {
    ctx.fillText(+(i * ys).toFixed(2), m.l - 6, m.t + ph - ((i * ys) / yMax) * ph + 4);
  }

  ctx.save();
  ctx.translate(12, m.t + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Menit sejak start", 0, 0);
  ctx.restore();
}

window.addEventListener("resize", () => {
  if (window.lastResult && !$("charts").hidden) {
    map.invalidateSize();
    drawHeatmap(window.lastResult);
  }
});
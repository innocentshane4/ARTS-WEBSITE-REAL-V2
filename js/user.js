/**
 * ARTS - User portal: dashboard, incident reporting with photo and map,
 * report tracking, emergency medical profile, two-factor authentication,
 * and account settings (profile, avatar, theme, language).
 */
(async function () {
const session = await UserAuth.requireAuth();
if (!session) return;
let me = await UserAuth.getUser(session.uid);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- i18n ----------------
   A starting point covering the portal's own labels, not third-party
   content (incident descriptions, admin data). Extend the dictionaries
   below to add more languages or cover more strings. */
const I18N = {
  en: { help: "Help", home: "Home", report: "Report incident", mine: "My reports", medical: "Medical info", security: "Security", settings: "Settings",
    welcome: "Welcome back", panicTitle: "In an emergency", panicBody: "Press and confirm to send your location immediately as a High priority report.",
    panicBtn: "PANIC", quickReport: "Report an incident", quickMine: "Track my reports", quickMedical: "Medical profile", quickSecurity: "Two-factor login" },
  af: { help: "Hulp", home: "Tuis", report: "Rapporteer voorval", mine: "My verslae", medical: "Mediese inligting", security: "Sekuriteit", settings: "Instellings",
    welcome: "Welkom terug", panicTitle: "In 'n noodgeval", panicBody: "Druk en bevestig om jou ligging onmiddellik as 'n Hoë prioriteit verslag te stuur.",
    panicBtn: "PANIEK", quickReport: "Rapporteer 'n voorval", quickMine: "Volg my verslae", quickMedical: "Mediese profiel", quickSecurity: "Twee-faktor aanmelding" },
  zu: { help: "Usizo", home: "Ikhaya", report: "Bika isigameko", mine: "Imibiko yami", medical: "Ulwazi lwezempilo", security: "Ukuphepha", settings: "Izilungiselelo",
    welcome: "Siyakwamukela", panicTitle: "Esimweni esiphuthumayo", panicBody: "Cindezela uqinisekise ukuthumela indawo yakho ngokushesha njengombiko ophuthumayo.",
    panicBtn: "USIZO", quickReport: "Bika isigameko", quickMine: "Landelela imibiko yami", quickMedical: "Iphrofayela yezempilo", quickSecurity: "Ukungena okubili" },
};
function t(key) { const lang = (me.settings && me.settings.language) || "en"; return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
function applyTheme() { document.documentElement.dataset.theme = (me.settings && me.settings.theme) || "light"; }
applyTheme();

function initials(name) { return (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }
function avatarHtml(size) {
  const cls = size === "lg" ? "avatar lg" : "avatar";
  return me.avatarDataUrl ? `<img class="${cls}" src="${me.avatarDataUrl}" alt="">` : `<span class="${cls}">${initials(me.fullName)}</span>`;
}
function renderHeaderIdentity() {
  $("who").innerHTML = `${avatarHtml()} <span style="margin-left:8px;">${esc(me.fullName)}</span>`;
  $("who").style.display = "inline-flex"; $("who").style.alignItems = "center";
}
renderHeaderIdentity();
$("outBtn").onclick = async () => { await UserAuth.logout(); location.href = "index.html"; };

function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 3200); }
function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }
document.querySelectorAll("[data-close-modal]").forEach((b) => (b.onclick = () => closeModal(b.dataset.closeModal)));
document.querySelectorAll(".modal-overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) closeModal(o.id); }));

const view = $("view");
let tab = "home";
function renderTabLabels() {
  document.querySelectorAll(".u-tabs button").forEach((b) => { b.textContent = t(b.dataset.tab); b.classList.toggle("on", b.dataset.tab === tab); });
}
document.querySelectorAll(".u-tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderTab(); }));

/* AI triage. Rule-based for now, the same logic the admin dashboard uses
   for auto-dispatch: assess() is the one place to swap in real Gemini
   calls (through a Firebase Cloud Function so the API key never sits in
   the browser). */
const URGENT = ["fire", "explosion", "trapped", "unconscious", "not breathing", "bleeding", "fatal", "dead", "overturned", "pinned", "fuel leak", "child"];
const FIRE_WORDS = ["fire", "explosion", "trapped", "pinned", "fuel leak"];
const SERVICES_FOR = { Collision: ["Ambulance", "Police", "Traffic"], "Pedestrian Incident": ["Ambulance", "Police"], Breakdown: ["Towing", "Traffic"], Emergency: ["Ambulance", "Police"] };
function assess(i) {
  const text = (i.description + " " + i.type).toLowerCase();
  const hits = URGENT.filter((w) => text.includes(w));
  return { hits, urgent: i.priority === "High" || hits.length >= 2 };
}
/** Works out which active contracted services should be notified. Nothing is written here. */
async function planDispatch(type, hits) {
  const services = (await Store.getAll("contractedServices")).filter((s) => s.active);
  const want = new Set(SERVICES_FOR[type] || ["Ambulance", "Police"]);
  if (hits.some((h) => FIRE_WORDS.includes(h))) want.add("Fire");
  return [...want].map((t) => services.find((s) => s.serviceType === t)).filter(Boolean);
}

/** Writes one dispatch-log entry per notified service, after the incident exists. */
async function logDispatch(incidentId, chosen, now) {
  await Promise.all(chosen.map((s) => Store.add("dispatchLog", { incidentId, serviceId: s.id, serviceName: s.name, forwardedBy: "ai_triage", forwardedAt: now, notes: "Auto-dispatched by AI triage" })));
}

/* Weather. Open-Meteo, no key required. */
async function fetchWeather(lat, lon) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
  if (!res.ok) throw new Error("Weather service unavailable");
  const data = await res.json();
  if (!data.current_weather) throw new Error("No weather data for this location");
  return data.current_weather;
}
const WMO = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
const WEATHER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.7A4 4 0 0 0 6.5 19h11z"/></svg>';
function describeWeather(code) { return WMO[code] || "Conditions unavailable"; }

/* Photo capture. Downscales so each Firestore document stays well under its 1 MB limit; once
   Firebase Storage is connected this becomes an upload instead of a
   data URL, and photoUrl on the incident record becomes a download link. */
function readAndCompressImage(file, maxDim = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("That does not look like a valid image."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- Home tab ---------------- */
const QUICK_LINK_ICONS = {
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  mine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A3.5 3.5 0 0 0 18.5 5c-1.4 0-2.6.7-3.5 1.8A4.4 4.4 0 0 0 11.5 5 3.5 3.5 0 0 0 8 8.5c0 2.3 1.5 4 3 5.5l5 5 5-5z"/><path d="M12 9v4"/><path d="M10 11h4"/></svg>',
  security: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
};

async function renderHome() {
  const mine = await Store.getWhere("incidents", "reporterId", session.uid);
  const open = mine.filter((i) => i.status !== "Resolved").length;
  const resolved = mine.filter((i) => i.status === "Resolved").length;
  const statusLine = open > 0
    ? `You currently have ${open} open report${open === 1 ? "" : "s"} being tracked.`
    : mine.length > 0
      ? "All of your reports have been resolved. You're all clear."
      : "You haven't reported anything yet - ARTS is ready whenever you need it.";

  view.innerHTML = `
    <div class="home-hero">${avatarHtml("lg")}
      <div><h1>${t("welcome")}, ${esc(me.fullName.split(" ")[0])}</h1>
      <p class="home-status">${statusLine}</p></div>
    </div>

    <div class="home-stats">
      <div class="home-stat"><b>${mine.length}</b><span>Total reports</span></div>
      <div class="home-stat"><b>${open}</b><span>Currently open</span></div>
      <div class="home-stat"><b>${resolved}</b><span>Resolved</span></div>
    </div>

    <div class="quick-links">
      <button class="quick-link" data-goto="report"><span class="ql-icon">${QUICK_LINK_ICONS.report}</span><b>${t("quickReport")}</b><span class="ql-desc">Type, location, and photo</span></button>
      <button class="quick-link" data-goto="mine"><span class="ql-icon">${QUICK_LINK_ICONS.mine}</span><b>${t("quickMine")}</b><span class="ql-desc">Status, weather, and QR code</span></button>
      <button class="quick-link" data-goto="medical"><span class="ql-icon">${QUICK_LINK_ICONS.medical}</span><b>${t("quickMedical")}</b><span class="ql-desc">Help responders help you faster</span></button>
      <button class="quick-link" data-goto="security"><span class="ql-icon">${QUICK_LINK_ICONS.security}</span><b>${t("quickSecurity")}</b><span class="ql-desc">${me.totpEnabled ? "Currently on" : "Currently off"}</span></button>
    </div>

    <div class="trust-band">
      <h2>What ARTS does for you</h2>
      <p>ARTS puts you in direct contact with the people who respond to road incidents. The moment you report something urgent, it is matched automatically against our network of ambulance, police, fire, and traffic services and sent straight to them, with your location attached. No call centre, no waiting on hold.</p>
      <p class="u-note">Need help right now? Use the panic button in the corner of the screen - it works from anywhere in ARTS.</p>
    </div>`;
  view.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => { tab = b.dataset.goto; renderTab(); }));
}

$("panicFab").onclick = firePanicButton;

function firePanicButton() {
  if (!navigator.geolocation) { toast("Location is not available on this device or browser."); return; }
  if (!confirm("Send an emergency report with your current location now?")) return;
  const btn = $("panicFab"); btn.disabled = true; btn.querySelector("span").textContent = "...";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      let location = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (res.ok) { const data = await res.json(); if (data.display_name) location = data.display_name; }
      } catch (_) { /* fall back to raw coordinates */ }

      try {
        const now = new Date().toISOString();
        const chosen = await planDispatch("Emergency", ["panic"]);
        const n = chosen.length;
        const inc = await Store.add("incidents", {
          title: `Emergency at ${location}`, type: "Emergency", description: "Panic button activated. Immediate assistance requested.",
          priority: "High", status: n ? "Forwarded" : "Pending", location, latitude, longitude, photoUrl: "", panic: true,
          reporterId: session.uid, reporterName: me.fullName, createdAt: now,
          forwardedTo: chosen.map((x) => x.id), forwardedAt: n ? now : null, autoForwarded: n > 0,
        });
        if (n) await logDispatch(inc.id, chosen, now);
        await Store.add("notifications", { type: "new_incident", incidentId: inc.id, read: false, createdAt: now,
          message: `Panic button pressed by ${me.fullName} at ${location}. Dispatched to ${n} service${n === 1 ? "" : "s"}.` });
      } catch (err) {
        console.error("[ARTS] Panic report failed:", err);
        btn.disabled = false; btn.querySelector("span").textContent = "SOS";
        toast("The emergency report could not be sent. Check your connection and try again.");
        return;
      }
      toast("Emergency services have been notified of your location.");
      btn.disabled = false; btn.querySelector("span").textContent = "SOS";
      tab = "mine"; renderTab();
    },
    () => { btn.disabled = false; btn.querySelector("span").textContent = "SOS"; toast("Location permission was denied, so nothing was sent."); },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ---------------- Report tab ---------------- */
let pickMap = null, pickMarker = null, pickedLat = null, pickedLng = null, reportPhoto = "";
function renderReport() {
  view.innerHTML = `
    <h1>${t("report")}</h1>
    <form class="u-card" id="repForm">
      <div class="field"><label for="type">Type</label><select id="type"><option>Collision</option><option>Pedestrian Incident</option><option>Breakdown</option></select></div>
      <div class="field"><label for="priority">Priority</label><select id="priority"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
      <div class="field"><label for="location">Location</label><input id="location" required maxlength="120" placeholder="Street, landmark, or intersection"></div>
      <div class="field"><label for="description">What happened</label><textarea id="description" required maxlength="600"></textarea></div>
      <button type="button" class="ai-assist-btn" id="aiBtn">AI Assist: tidy up the description and suggest priority</button>

      <label>Photo (optional)</label>
      <div class="photo-drop" id="photoDrop">Tap to add a photo from your camera or files</div>
      <input type="file" accept="image/*" id="photoInput" style="display:none">
      <img class="photo-preview" id="photoPreview" alt="">

      <label style="margin-top:16px;">Pin the location on the map</label>
      <div class="pick-map" id="pickMap"></div>
      <p class="map-hint" id="pickHint">Tap the map to mark exactly where this happened, or use your live location.</p>
      <button type="button" class="ai-assist-btn" id="myLocBtn" style="margin-top:0;">Use my live location</button>
      <button class="btn btn-primary" id="repBtn">Submit report</button>
    </form>`;

  reportPhoto = "";
  // Close any earlier map so its live-location watcher stops running.
  if (pickMap) { try { pickMap.stopLocate(); pickMap.remove(); } catch (_) { /* the old container is already gone */ } }
  pickedLat = null; pickedLng = null; pickMarker = null;

  pickMap = L.map("pickMap").setView([-26.107, 28.056], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(pickMap);

  let addressAutoFilled = false;
  $("location").addEventListener("input", (e) => { if (e.isTrusted) addressAutoFilled = false; });

  /** Puts the pin on a spot, and fills the location box with its street address unless the person typed their own. */
  async function placePin(lat, lng, moveMap) {
    pickedLat = lat; pickedLng = lng;
    if (pickMarker) pickMap.removeLayer(pickMarker);
    pickMarker = L.marker([lat, lng]).addTo(pickMap);
    if (moveMap) pickMap.setView([lat, lng], 16);
    $("pickHint").textContent = `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}. Tap the map to move it.`;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = res.ok ? await res.json() : null;
      const box = $("location");
      if (data && data.display_name && box && (!box.value.trim() || addressAutoFilled)) {
        box.value = data.display_name.slice(0, 120);
        addressAutoFilled = true;
      }
    } catch (_) { /* the address is a convenience; the pin still works without it */ }
  }

  pickMap.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng, false));

  // Live location: a blue dot that follows the device, and the pin is placed there automatically the first time.
  let liveDot = null, liveRing = null;
  pickMap.on("locationfound", (e) => {
    if (liveDot) { liveDot.setLatLng(e.latlng); liveRing.setLatLng(e.latlng).setRadius(e.accuracy); }
    else {
      liveRing = L.circle(e.latlng, { radius: e.accuracy, color: "#2563EB", weight: 1, fillOpacity: 0.08 }).addTo(pickMap);
      liveDot = L.circleMarker(e.latlng, { radius: 7, color: "#FFFFFF", weight: 3, fillColor: "#2563EB", fillOpacity: 1 }).addTo(pickMap);
    }
    if (pickedLat === null) placePin(e.latlng.lat, e.latlng.lng, true);
  });
  pickMap.on("locationerror", () => {
    $("pickHint").textContent = "Your location is not available. Allow location access for this site, or tap the map to place the pin.";
  });
  if (navigator.geolocation) pickMap.locate({ watch: true, enableHighAccuracy: true, setView: false });

  $("myLocBtn").onclick = () => {
    if (liveDot) placePin(liveDot.getLatLng().lat, liveDot.getLatLng().lng, true);
    else toast("Still finding your location. Make sure location is allowed for this site.");
  };

  $("photoDrop").onclick = () => $("photoInput").click();
  $("photoInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      reportPhoto = await readAndCompressImage(file);
      const img = $("photoPreview"); img.src = reportPhoto; img.classList.add("show");
      $("photoDrop").textContent = "Photo attached - tap to replace";
    } catch (err) { toast(err.message); }
  };

  $("aiBtn").onclick = () => {
    const box = $("description");
    let text = box.value.trim();
    if (text.length < 10) return toast("Write a bit more detail first, then try AI Assist.");
    const btn = $("aiBtn"); btn.disabled = true; btn.textContent = "Thinking…";
    setTimeout(() => {
      const tidy = text.charAt(0).toUpperCase() + text.slice(1);
      box.value = /[.!?]$/.test(tidy) ? tidy : tidy + ".";
      const a = assess({ description: text, type: $("type").value, priority: $("priority").value });
      if (a.urgent) $("priority").value = "High";
      btn.disabled = false;
      btn.textContent = "AI Assist: tidy up the description and suggest priority";
      toast(a.urgent ? "Description tidied up. Priority raised to High based on the details given." : "Description tidied up.");
    }, 500);
  };

  $("repForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("repBtn").disabled = true;
    try {
      const now = new Date().toISOString();
      const type = $("type").value, location = $("location").value.trim(), description = $("description").value.trim();
      const a = assess({ description, type, priority: $("priority").value });
      const chosen = a.urgent ? await planDispatch(type, a.hits) : [];
      const n = chosen.length;
      const inc = await Store.add("incidents", {
        title: `${type} at ${location}`, type, description, priority: n ? "High" : $("priority").value,
        status: n ? "Forwarded" : "Pending", location, latitude: pickedLat, longitude: pickedLng, photoUrl: reportPhoto,
        reporterId: session.uid, reporterName: me.fullName, createdAt: now,
        forwardedTo: chosen.map((x) => x.id), forwardedAt: n ? now : null, autoForwarded: n > 0,
      });
      if (n) await logDispatch(inc.id, chosen, now);
      await Store.add("notifications", { type: "new_incident", incidentId: inc.id, read: false, createdAt: now,
        message: n ? `Urgent ${type} at ${location} was auto-dispatched by AI triage to ${n} service${n === 1 ? "" : "s"}.` : `New ${inc.priority} priority ${type} reported at ${location}.` });
      toast(n ? "Report submitted. Emergency services have been dispatched." : "Report submitted. An administrator will review it.");
      pickedLat = null; pickedLng = null; reportPhoto = "";
      tab = "mine"; renderTab();
    } finally { $("repBtn").disabled = false; }
  });
}

/* ---------------- My reports tab ---------------- */
async function renderMine() {
  const list = (await Store.getWhere("incidents", "reporterId", session.uid)).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  view.innerHTML = `<h1>${t("mine")}</h1><div class="u-card">${list.length
    ? `<table class="u-table"><tr><th>Incident</th><th>Priority</th><th>Status</th><th>Reported</th><th></th></tr>${list.map((i) =>
        `<tr><td>${esc(i.type)}<span class="u-note">${esc(i.location)}</span></td><td><span class="u-badge ${esc(i.priority)}">${esc(i.priority)}</span></td>
        <td><span class="u-badge ${esc(i.status)}">${esc(i.status)}</span>${i.autoForwarded ? '<span class="u-note">Dispatched automatically</span>' : ""}</td>
        <td>${new Date(i.createdAt).toLocaleString()}</td><td><button class="btn btn-secondary" style="width:auto;padding:6px 12px;" data-view="${i.id}">View</button></td></tr>`).join("")}</table>`
    : '<p class="u-empty">You have not reported anything yet. Use Report incident to file your first report.</p>'}</div>`;
  view.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => showDetail(b.dataset.view, list)));
}

async function showDetail(id, list) {
  const i = list.find((x) => x.id === id);
  if (!i) return;
  $("detailTitle").textContent = i.type;
  $("detailBody").innerHTML = `
    <div class="detail-row"><span class="k">Location</span><span class="v">${esc(i.location)}</span></div>
    <div class="detail-row"><span class="k">Priority</span><span class="v"><span class="u-badge ${esc(i.priority)}">${esc(i.priority)}</span></span></div>
    <div class="detail-row"><span class="k">Status</span><span class="v"><span class="u-badge ${esc(i.status)}">${esc(i.status)}</span>${i.autoForwarded ? " (dispatched by AI)" : ""}</span></div>
    <div class="detail-row"><span class="k">Reported</span><span class="v">${new Date(i.createdAt).toLocaleString()}</span></div>
    <p style="margin:14px 0;">${esc(i.description)}</p>
    ${i.photoUrl ? `<img src="${i.photoUrl}" alt="Incident photo" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:14px;">` : ""}
    <div id="wxBox"><p class="u-note">Loading weather…</p></div>
    ${i.latitude != null ? '<div class="detail-map" id="detailMap"></div>' : '<p class="u-note">No pinned location on this report.</p>'}
    <label style="margin-top:16px;">Incident QR code</label>
    <div class="qr-box"><div id="qrHolder"></div><span class="u-note">Scannable in the ARTS app to jump straight to this record.</span></div>`;
  openModal("detailModal");

  if (i.latitude != null && i.longitude != null) {
    setTimeout(() => {
      const m = L.map("detailMap", { zoomControl: false, attributionControl: false }).setView([i.latitude, i.longitude], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      L.marker([i.latitude, i.longitude]).addTo(m);
    }, 30);
    fetchWeather(i.latitude, i.longitude)
      .then((w) => { const label = describeWeather(w.weathercode);
        $("wxBox").innerHTML = `<div class="weather-box"><span class="wx-icon">${WEATHER_SVG}</span><div><div class="temp">${Math.round(w.temperature)}°C</div><div class="u-note">${label} · Wind ${Math.round(w.windspeed)} km/h</div></div></div>`; })
      .catch(() => { $("wxBox").innerHTML = '<p class="u-note">Weather is unavailable right now.</p>'; });
  } else {
    $("wxBox").innerHTML = '<p class="u-note">Pin a location on future reports to see local weather here.</p>';
  }

  new QRCode($("qrHolder"), { text: `arts://incident/${i.id}`, width: 148, height: 148, colorDark: "#0F4C3A", colorLight: "#ffffff" });
}

/* ---------------- Medical info tab ---------------- */
function renderMedical() {
  const med = me;
  view.innerHTML = `
    <h1>${t("medical")}</h1>
    <div class="medical-banner">This information is shown to administrators and emergency responders only when you are the reporter on an incident. It helps them treat you correctly if you cannot speak for yourself.</div>
    <form class="u-card" id="medForm">
      <div class="med-grid">
        <div class="med-section-title">Identity</div>
        <div class="field"><label for="mIdNumber">ID number</label><input id="mIdNumber" value="${esc(med.idNumber)}" maxlength="20"></div>
        <div class="field"><label for="mAge">Age</label><input id="mAge" type="number" min="0" max="120" value="${esc(med.age)}"></div>
        <div class="field"><label for="mGender">Gender</label><select id="mGender">
          ${["", "Female", "Male", "Non-binary", "Prefer not to say"].map((g) => `<option ${med.gender === g ? "selected" : ""}>${g}</option>`).join("")}
        </select></div>

        <div class="med-section-title">Medical</div>
        <div class="field"><label for="mBlood">Blood type</label><select id="mBlood">
          ${["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((b) => `<option ${med.bloodType === b ? "selected" : ""}>${b}</option>`).join("")}
        </select></div>
        <div class="field"><label for="mHeight">Height (cm)</label><input id="mHeight" type="number" min="0" max="260" value="${esc(med.heightCm)}"></div>
        <div class="field"><label for="mWeight">Weight (kg)</label><input id="mWeight" type="number" min="0" max="400" value="${esc(med.weightKg)}"></div>
        <div class="field" style="grid-column:1/-1;"><label for="mAllergies">Allergies or conditions</label><textarea id="mAllergies" placeholder="e.g. Penicillin, peanuts">${esc(med.allergiesOrConditions)}</textarea></div>
        <div class="field" style="grid-column:1/-1;"><label for="mChronic">Chronic conditions</label><textarea id="mChronic" placeholder="e.g. Type 1 diabetes, epilepsy">${esc(med.chronicConditions)}</textarea></div>
        <div class="field" style="grid-column:1/-1;"><label for="mMeds">Current medications</label><textarea id="mMeds" placeholder="e.g. Insulin, blood thinners">${esc(med.currentMedications)}</textarea></div>
        <div class="field"><label for="mHospital">Preferred hospital</label><input id="mHospital" value="${esc(med.preferredHospital)}"></div>

        <div class="med-section-title">Medical aid</div>
        <div class="field"><label for="mAidProvider">Provider</label><input id="mAidProvider" value="${esc(med.medicalAidProvider)}"></div>
        <div class="field"><label for="mAidNumber">Membership number</label><input id="mAidNumber" value="${esc(med.medicalAidNumber)}"></div>

        <div class="med-section-title">Emergency contact</div>
        <div class="field"><label for="mEcName">Contact name</label><input id="mEcName" value="${esc(med.emergencyContactName)}"></div>
        <div class="field"><label for="mEcPhone">Contact phone</label><input id="mEcPhone" value="${esc(med.emergencyContactPhone)}"></div>
      </div>
      <button class="btn btn-primary" id="medBtn">Save medical information</button>
    </form>`;

  $("medForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const medical = {
      idNumber: $("mIdNumber").value.trim() || null, age: $("mAge").value || null, gender: $("mGender").value || null,
      bloodType: $("mBlood").value || null, heightCm: $("mHeight").value || null, weightKg: $("mWeight").value || null,
      allergiesOrConditions: $("mAllergies").value.trim() || null, chronicConditions: $("mChronic").value.trim() || null,
      currentMedications: $("mMeds").value.trim() || null, preferredHospital: $("mHospital").value.trim() || null,
      medicalAidProvider: $("mAidProvider").value.trim() || null, medicalAidNumber: $("mAidNumber").value.trim() || null,
      emergencyContactName: $("mEcName").value.trim() || null, emergencyContactPhone: $("mEcPhone").value.trim() || null,
    };
    await UserAuth.saveMedical(session.uid, medical);
    me = await UserAuth.getUser(session.uid);
    toast("Medical information saved.");
  });
}

/* ---------------- Security tab (TOTP 2FA) ---------------- */
function renderSecurity() {
  view.innerHTML = `<h1>${t("security")}</h1>
    <div class="security-status"><div><b>Two-factor authentication</b><div class="u-note">Adds a 6-digit code from an authenticator app to your sign-in.</div></div>
    <span class="pill ${me.totpEnabled ? "on" : "off"}">${me.totpEnabled ? "ON" : "OFF"}</span></div>
    <div class="u-card" id="secCard"></div>`;

  if (me.totpEnabled) {
    $("secCard").innerHTML = `<p>Two-factor authentication is currently on for your account. You will be asked for a code from your authenticator app each time you sign in.</p>
      <button class="btn btn-secondary" id="disableBtn">Turn off two-factor authentication</button>`;
    $("disableBtn").onclick = async () => {
      if (!confirm("Turn off two-factor authentication for your account?")) return;
      await UserAuth.disableTotp(session.uid);
      me = await UserAuth.getUser(session.uid);
      toast("Two-factor authentication turned off.");
      renderSecurity();
    };
  } else {
    const secret = TOTP.generateSecret();
    $("secCard").innerHTML = `<p>Scan this code with Google Authenticator, Authy, or a similar app, or enter the key manually.</p>
      <div class="qr-box"><div id="setupQr"></div></div>
      <div class="secret-box">${secret}</div>
      <div class="field"><label for="confirmCode">Enter the 6-digit code it shows</label>
        <input id="confirmCode" inputmode="numeric" pattern="[0-9]*" maxlength="6"></div>
      <div class="login-error" id="setupError"></div>
      <button class="btn btn-primary" id="confirmBtn">Confirm and turn on</button>`;
    new QRCode($("setupQr"), { text: TOTP.buildOtpAuthUri(secret, me.email), width: 160, height: 160 });
    $("confirmBtn").onclick = async () => {
      const code = $("confirmCode").value;
      const btn = $("confirmBtn"); btn.disabled = true;
      try {
        if (!(await TOTP.verify(secret, code))) throw new Error("That code did not match. Check your authenticator app and try again.");
        await UserAuth.enableTotp(session.uid, secret);
        me = await UserAuth.getUser(session.uid);
        toast("Two-factor authentication is now on.");
        renderSecurity();
      } catch (err) {
        const e = $("setupError"); e.textContent = err.message; e.classList.add("show");
      } finally { btn.disabled = false; }
    };
  }
}

/* ---------------- Settings tab ---------------- */
function renderSettings() {
  const theme = (me.settings && me.settings.theme) || "light";
  const language = (me.settings && me.settings.language) || "en";
  view.innerHTML = `
    <h1>${t("settings")}</h1>
    <div class="u-card">
      <div class="avatar-row">${avatarHtml("lg")}
        <div><button class="btn btn-secondary" style="width:auto;" id="avatarBtn">Change photo</button>
        <input type="file" accept="image/*" id="avatarInput" style="display:none"></div>
      </div>
      <form id="profileForm">
        <div class="field"><label for="pName">Full name</label><input id="pName" value="${esc(me.fullName)}" required></div>
        <div class="field"><label for="pPhone">Phone number</label><input id="pPhone" value="${esc(me.phone)}" placeholder="e.g. 082 123 4567"></div>
        <div class="field"><label>Email address</label><input value="${esc(me.email)}" disabled></div>
        <div class="field"><label>Account created</label><input value="${new Date(me.createdAt).toLocaleDateString()}" disabled></div>
        <button class="btn btn-primary" id="profileBtn">Save profile</button>
      </form>
    </div>
    <div class="u-card">
      <div class="settings-row"><div><b>Appearance</b><div class="desc">Switch between a light and dark interface.</div></div>
        <div class="seg" id="themeSeg"><button data-v="light" class="${theme === "light" ? "on" : ""}">Light</button><button data-v="dark" class="${theme === "dark" ? "on" : ""}">Dark</button></div></div>
      <div class="settings-row"><div><b>Language</b><div class="desc">Applies to the labels in this portal.</div></div>
        <select id="langSelect" style="width:auto;">
          <option value="en" ${language === "en" ? "selected" : ""}>English</option>
          <option value="af" ${language === "af" ? "selected" : ""}>Afrikaans</option>
          <option value="zu" ${language === "zu" ? "selected" : ""}>isiZulu</option>
        </select></div>
    </div>`;

  $("avatarBtn").onclick = () => $("avatarInput").click();
  $("avatarInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readAndCompressImage(file, 300, 0.8);
      await UserAuth.updateAvatar(session.uid, dataUrl);
      me = await UserAuth.getUser(session.uid);
      renderHeaderIdentity();
      renderSettings();
      toast("Profile photo updated.");
    } catch (err) { toast(err.message); }
  };

  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await UserAuth.updateProfile(session.uid, { fullName: $("pName").value, phone: $("pPhone").value });
    me = await UserAuth.getUser(session.uid);
    session.fullName = me.fullName;
    renderHeaderIdentity();
    toast("Profile updated.");
  });

  $("themeSeg").querySelectorAll("button").forEach((b) => (b.onclick = async () => {
    await UserAuth.updateSettings(session.uid, { theme: b.dataset.v });
    me = await UserAuth.getUser(session.uid);
    applyTheme();
    renderSettings();
  }));
  $("langSelect").onchange = async (e) => {
    await UserAuth.updateSettings(session.uid, { language: e.target.value });
    me = await UserAuth.getUser(session.uid);
    renderTabLabels();
    renderSettings();
  };
}


/* ---------------- Help tab ---------------- */
const FAQ = [
  ["Getting started", [
    ["How do I report an accident?", "Open Report incident, choose the type and priority, enter where it happened and describe what you saw. You can tap the map to pin the exact spot and add a photo. Then press Submit report. You can follow it under My reports."],
    ["What does the SOS button do?", "The red SOS button in the corner works from every page. After you confirm, it sends your current location as a High priority emergency and notifies ambulance and police straight away. Your browser will ask permission to use your location the first time."],
    ["Does ARTS replace calling the emergency services?", "No. If someone is in danger, call 112 (any cellphone), 10111 (police) or 10177 (ambulance) first. ARTS helps by sending your location and details to the services we work with."]
  ]],
  ["Reports and alerts", [
    ["How does ARTS decide who to notify?", "A report is treated as urgent if it is marked High priority, or if the description contains two or more warning words such as fire, trapped or unconscious. Urgent reports are sent automatically to the matching active services (for example ambulance, police, traffic or fire). Everything else waits for an administrator to review."],
    ["What do the statuses mean?", "Pending means an administrator has not reviewed it yet. Forwarded means it has been sent to emergency services. Resolved means it has been dealt with."],
    ["Where do I see updates about my reports?", "Under My reports. Open a report to see its status, map, local weather and a QR code that responders can scan to open it."]
  ]],
  ["Your information", [
    ["Why add medical information?", "If you cannot speak for yourself after an accident, responders can see your blood type, allergies, medication, medical aid and emergency contact. Only you and ARTS administrators can see it, and only the administrator side shows it when you are the person who reported an incident."],
    ["Who can see my details?", "Only you and the ARTS administrators. Other users cannot see your profile or your reports."],
    ["How do I change my name, phone number or photo?", "Open Settings. You can edit your name and phone number and change your profile photo. Your email address is locked because it is your sign-in."]
  ]],
  ["Signing in and security", [
    ["Can I sign in with Google?", "Yes. Choose Continue with Google on the sign-in page. A Google sign-in creates your ARTS account the first time you use it."],
    ["How do I turn on two-factor login?", "Open Security and follow the steps: scan the code with Google Authenticator or Authy, then type the 6-digit code it shows. From then on you will be asked for a code each time you sign in."],
    ["I forgot my password.", "On the sign-in page, type your email address and press Forgot password. A reset link is emailed to you. If you signed up with Google, use Continue with Google instead."]
  ]],
  ["Troubleshooting", [
    ["The map or weather does not show on a report.", "That report was submitted without a pinned location. Tap the map when you report next time so the exact spot, and the weather there, are saved."],
    ["The SOS button says location is unavailable.", "Allow location access for this site in your browser settings and make sure the page address starts with https. Then try again."],
    ["I changed the language but some words are still in English.", "Language currently covers the main menu and home page. More of the portal will be translated in future updates."]
  ]]
];

function renderHelp() {
  view.innerHTML = `<h1>${t("help")}</h1>
    <p class="muted">Answers to common questions about reporting, alerts, your information, and signing in.</p>
    ${FAQ.map(([group, items]) => `
      <h2 class="faq-group">${esc(group)}</h2>
      <div class="u-card faq-card">${items.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`).join("")}
    <p class="u-note" style="margin-top:18px;">Still stuck? Contact the ARTS administrator who gave you access.</p>`;
}

function renderTab() {
  renderTabLabels();
  if (tab === "home") renderHome();
  else if (tab === "report") renderReport();
  else if (tab === "mine") renderMine();
  else if (tab === "medical") renderMedical();
  else if (tab === "security") renderSecurity();
  else if (tab === "help") renderHelp();
  else renderSettings();
}
renderTab();
})();

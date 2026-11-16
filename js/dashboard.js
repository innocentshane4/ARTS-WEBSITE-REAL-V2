/**
 * ARTS Admin — Dashboard Shell Controller
 * Handles auth guard, sidebar navigation, the live status strip,
 * and shared helpers (toast, modal open/close, date formatting)
 * that incidents.js / services.js / users.js all rely on.
 */

// Set once the signed-in administrator has been verified (see the guard at the bottom).
// incidents.js reads this when it records who resolved or forwarded an incident.
let session = null;

document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-ZA", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  AuthStore.logout().then(() => (window.location.href = "index.html"));
});

// ---- Section navigation -----------------------------------------------------
const navItems = document.querySelectorAll(".nav-item[data-section]");
const sections = document.querySelectorAll(".section");
const pageTitle = document.getElementById("pageTitle");

const sectionLabels = {
  overview: "Overview",
  incidents: "Incidents",
  map: "Incident Map",
  services: "Contracted Services",
  users: "Registered Users",
  analytics: "Analytics",
};

function showSection(name) {
  navItems.forEach((n) => n.classList.toggle("active", n.dataset.section === name));
  sections.forEach((s) => s.classList.toggle("active", s.id === "section-" + name));
  pageTitle.textContent = sectionLabels[name] || "Overview";
  window.dispatchEvent(new CustomEvent("arts:section-shown", { detail: { section: name } }));
}

navItems.forEach((item) => {
  item.addEventListener("click", () => showSection(item.dataset.section));
});

// ---- Toasts -----------------------------------------------------------------
function showToast(message, variant) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast" + (variant === "danger" ? " danger" : "");
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2900);
}

// ---- Modal helpers ------------------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// Generic confirm dialog — used by incidents/services for destructive actions
function confirmAction(title, body, onConfirm) {
  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalBody").textContent = body;
  const btn = document.getElementById("confirmModalActionBtn");
  const freshBtn = btn.cloneNode(true); // strip old listeners
  btn.replaceWith(freshBtn);
  freshBtn.addEventListener("click", () => {
    closeModal("confirmModal");
    onConfirm();
  });
  openModal("confirmModal");
}

// ---- Date formatting shared across sections ------------------------------------
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hr ago";
  const days = Math.floor(hours / 24);
  return days + " day" + (days === 1 ? "" : "s") + " ago";
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ---- Status strip + nav badge (re-run whenever incidents change) --------------
function refreshStatusStrip() {
  Promise.all([
    Store.getAll("incidents"),
    Store.getAll("contractedServices"),
    Store.getAll("users"),
  ]).then(([incidents, services, users]) => {
    const pending = incidents.filter((i) => i.status === "Pending").length;
    const forwarded = incidents.filter((i) => i.status === "Forwarded").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;

    document.getElementById("statTotal").textContent = incidents.length;
    document.getElementById("statPending").textContent = pending;
    document.getElementById("statForwarded").textContent = forwarded;
    document.getElementById("statResolved").textContent = resolved;
    document.getElementById("statServices").textContent = services.filter((s) => s.active).length;
    document.getElementById("statUsers").textContent = users.length;

    const badge = document.getElementById("navIncidentBadge");
    if (pending > 0) {
      badge.style.display = "inline-block";
      badge.textContent = pending;
    } else {
      badge.style.display = "none";
    }

    renderOverview(incidents, services);
  });
}

// ---- Overview widgets: AI insights, weather, service readiness ---------------
function renderAiWidget(incidents) {
  Store.getAll("dispatchLog").then((log) => {
    const aiEntries = log.filter((l) => l.forwardedBy === "ai_triage").sort((a, b) => new Date(b.forwardedAt) - new Date(a.forwardedAt));
    document.getElementById("aiWidgetCount").textContent = aiEntries.length;
    document.getElementById("aiWidgetSub").textContent = aiEntries.length === 1 ? "urgent incident auto-dispatched" : "urgent incidents auto-dispatched";
    const listEl = document.getElementById("aiWidgetList");
    listEl.innerHTML = aiEntries.length
      ? aiEntries.slice(0, 3).map((l) => `<div class="wi"><b>${escapeHtml(l.serviceName)}</b> notified · ${timeAgo(l.forwardedAt)}</div>`).join("")
      : '<div class="wi">No auto-dispatches yet. High priority reports are sent here automatically.</div>';
  });
}

function renderServiceWidget(services) {
  const active = services.filter((s) => s.active).length;
  const total = services.length;
  document.getElementById("svcWidgetCount").textContent = active;
  document.getElementById("svcWidgetSub").textContent = `of ${total} contracted service${total === 1 ? "" : "s"} active`;
  document.getElementById("svcWidgetBar").style.width = total ? Math.round((active / total) * 100) + "%" : "0%";
}

const WMO_LABELS = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
const WEATHER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.7A4 4 0 0 0 6.5 19h11z"/></svg>';

function refreshWeatherWidget() {
  // HQ coordinates - same Sandton, Johannesburg point the live map is centered on.
  fetch("https://api.open-meteo.com/v1/forecast?latitude=-26.107&longitude=28.056&current_weather=true")
    .then((r) => { if (!r.ok) throw new Error("unavailable"); return r.json(); })
    .then((data) => {
      const w = data.current_weather;
      const body = document.getElementById("weatherWidgetBody");
      if (!w) throw new Error("no data");
      body.innerHTML = `<div class="wx-row"><span class="wx-icon">${WEATHER_SVG}</span>
        <div><div class="wx-temp">${Math.round(w.temperature)}°C</div><div class="u-note">${WMO_LABELS[w.weathercode] || "Conditions unavailable"} · Wind ${Math.round(w.windspeed)} km/h</div></div></div>`;
    })
    .catch(() => { document.getElementById("weatherWidgetBody").innerHTML = '<div class="u-note">Weather is unavailable right now.</div>'; });
}
refreshWeatherWidget();
setInterval(refreshWeatherWidget, 10 * 60 * 1000);

// ---- Overview section ------------------------------------------------------------
function renderOverview(incidents, services) {
  renderAiWidget(incidents);
  renderServiceWidget(services);

  const pendingList = document.getElementById("overviewPendingList");
  const resolvedList = document.getElementById("overviewResolvedList");

  const needsAttention = incidents
    .filter((i) => i.status !== "Resolved")
    .sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.priority] - order[b.priority] || new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 5);

  const recentlyResolved = incidents
    .filter((i) => i.status === "Resolved")
    .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))
    .slice(0, 3);

  pendingList.innerHTML = needsAttention.length
    ? needsAttention.map(renderIncidentRow).join("")
    : emptyStateHtml("Nothing needs attention", "All incidents are either forwarded or resolved.");

  resolvedList.innerHTML = recentlyResolved.length
    ? recentlyResolved.map(renderIncidentRow).join("")
    : emptyStateHtml("No resolved incidents yet", "Resolved incidents will appear here.");

  attachIncidentRowClicks();
}

function emptyStateHtml(title, sub) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5"/></svg>
    <div class="title">${title}</div>
    <div class="sub">${sub}</div>
  </div>`;
}

// Listen for data-changed events fired by incidents.js/services.js/users.js
window.addEventListener("arts:data-changed", refreshStatusStrip);

// Initial paint
refreshStatusStrip();

// ---- Admin guard, live sync and demo data ------------------------------------
function showSidebarIdentity(who) {
  document.getElementById("sidebarName").textContent = who.fullName;
  document.getElementById("sidebarAvatar").textContent = who.fullName
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** Re-renders every section whenever data changes in Firestore, including reports submitted by users. */
function startLiveSync() {
  let timer = null;
  ["incidents", "notifications", "users", "dispatchLog", "contractedServices"].forEach((name) => {
    let first = true;
    fbDb.collection(name).onSnapshot(
      (snap) => {
        if (first) { first = false; return; }
        if (name === "incidents") {
          snap.docChanges().forEach((change) => {
            if (change.type === "added") showToast("New incident reported: " + (change.doc.data().title || "Untitled"));
          });
        }
        clearTimeout(timer);
        timer = setTimeout(() => window.dispatchEvent(new CustomEvent("arts:data-changed")), 300);
      },
      (err) => console.warn("[ARTS] Live sync stopped on " + name + ":", err.code || err.message)
    );
  });
}

async function refreshSeedBanner() {
  document.getElementById("seedBanner").hidden = !(await demoDataNeeded());
}

document.getElementById("seedBtn").addEventListener("click", async () => {
  const btn = document.getElementById("seedBtn");
  btn.disabled = true;
  btn.textContent = "Loading...";
  try {
    await seedDemoData();
    showToast("Demo data loaded.");
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
    await refreshSeedBanner();
  } catch (err) {
    console.error("[ARTS] Loading demo data failed:", err);
    showToast("Could not load demo data: " + (err.code || err.message), "danger");
  } finally {
    btn.disabled = false;
    btn.textContent = "Load demo data";
  }
});

AuthStore.requireAuth().then((who) => {
  if (!who) return;
  session = who;
  showSidebarIdentity(who);
  startLiveSync();
  refreshSeedBanner();
  window.dispatchEvent(new CustomEvent("arts:data-changed"));
});

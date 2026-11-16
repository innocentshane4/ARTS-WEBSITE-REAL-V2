/**
 * ARTS Admin — Incident Map Controller
 * Uses Leaflet.js with free OpenStreetMap tiles — no API key required,
 * the same approach the ARTS Android app uses for its own map.
 */

let mapInstance = null;
let mapMarkers = [];

const PRIORITY_COLORS = { High: "#C81E3A", Medium: "#B8791A", Low: "#1B6B4A" };

function initMap() {
  // Centered on Sandton, Johannesburg — matches where the seed incidents are located
  mapInstance = L.map("incidentMap").setView([-26.107, 28.056], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(mapInstance);
}

function refreshMapMarkers() {
  if (!mapInstance) return;

  mapMarkers.forEach((m) => mapInstance.removeLayer(m));
  mapMarkers = [];

  Store.getAll("incidents").then((incidents) => {
    const plottable = incidents.filter((i) => i.status !== "Resolved" && i.latitude && i.longitude);

    plottable.forEach((incident) => {
      const color = PRIORITY_COLORS[incident.priority] || "#8A9A92";
      const marker = L.circleMarker([incident.latitude, incident.longitude], {
        radius: 9,
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(mapInstance);

      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:180px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(incident.title)}</div>
          <div style="font-size:11.5px;color:#4B5D54;margin-bottom:6px;">${escapeHtml(incident.location)}</div>
          <button onclick="openIncidentDetail('${incident.id}')" style="font-size:12px;background:#0F4C3A;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;">View details</button>
        </div>
      `);

      mapMarkers.push(marker);
    });

    if (!plottable.length) {
      // Nothing to show — leave the map centered on its default view
    }
  });
}

window.addEventListener("arts:section-shown", (e) => {
  if (e.detail.section !== "map") return;
  if (!mapInstance) {
    initMap();
  } else {
    // Leaflet needs a nudge to recalculate size after being hidden via display:none
    setTimeout(() => mapInstance.invalidateSize(), 50);
  }
  refreshMapMarkers();
});

window.addEventListener("arts:data-changed", () => {
  if (mapInstance) refreshMapMarkers();
});

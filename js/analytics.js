/**
 * ARTS Admin — Analytics Controller
 * All figures are computed live from actual stored data — nothing here
 * is a static or placeholder number. The trend, hourly, and hotspot
 * views are historical-frequency patterns, not a trained machine
 * learning model — they're labelled that way in the UI.
 */

function renderBarChart(containerId, data, colorFn) {
  const container = document.getElementById(containerId);
  if (!data.length) {
    container.innerHTML = `<div class="chart-empty">Not enough data yet.</div>`;
    return;
  }
  const max = Math.max(...data.map((d) => d.value));
  container.innerHTML = data
    .map(
      (d) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(d.label)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${max ? (d.value / max) * 100 : 0}%; background:${colorFn ? colorFn(d.label) : "var(--pine)"};"></div>
      </div>
      <div class="bar-value">${d.value}</div>
    </div>`
    )
    .join("");
}

/** Lightweight inline-SVG line chart - no external chart library needed. */
function renderLineChart(containerId, points) {
  const container = document.getElementById(containerId);
  if (!points.length || points.every((p) => p.value === 0)) {
    container.innerHTML = `<div class="chart-empty">Not enough data yet.</div>`;
    return;
  }
  const w = 680, h = 180, pad = 28;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = (w - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (p.value / max) * (h - pad * 2);
    return { x, y, ...p };
  });
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${coords[0].x.toFixed(1)},${h - pad} Z`;
  const everyNth = Math.ceil(points.length / 7);

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="line-svg" preserveAspectRatio="none">
      <path d="${areaPath}" fill="url(#trendFill)" stroke="none"></path>
      <path d="${linePath}" fill="none" stroke="var(--pine)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
      ${coords.map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="var(--forest)"></circle>`).join("")}
      <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--pine)" stop-opacity="0.28"></stop>
        <stop offset="100%" stop-color="var(--pine)" stop-opacity="0"></stop>
      </linearGradient></defs>
    </svg>
    <div class="line-x-labels">
      ${coords.filter((_, i) => i % everyNth === 0 || i === coords.length - 1).map((c) => `<span>${escapeHtml(c.label)}</span>`).join("")}
    </div>`;
}

function dayLabel(d) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function loadAnalytics() {
  Promise.all([Store.getAll("incidents"), Store.getAll("dispatchLog")]).then(([incidents, dispatchLog]) => {
    // ---- Incidents by priority -------------------------------------------
    const priorityCounts = { High: 0, Medium: 0, Low: 0 };
    incidents.forEach((i) => { if (priorityCounts[i.priority] !== undefined) priorityCounts[i.priority]++; });
    renderBarChart(
      "chartPriority",
      Object.entries(priorityCounts).map(([label, value]) => ({ label, value })),
      (label) => ({ High: "var(--alert)", Medium: "var(--amber)", Low: "var(--ok)" }[label])
    );

    // ---- Incidents by type -------------------------------------------------
    const typeCounts = {};
    incidents.forEach((i) => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
    const typeData = Object.entries(typeCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    renderBarChart("chartType", typeData);

    // ---- Average time to resolution -----------------------------------------
    const resolved = incidents.filter((i) => i.status === "Resolved" && i.resolvedAt);
    let avgMins = null;
    if (resolved.length) {
      const totalMins = resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt) - new Date(i.createdAt)) / 60000, 0);
      avgMins = totalMins / resolved.length;
      const display = avgMins >= 60 ? `${(avgMins / 60).toFixed(1)} hrs` : `${Math.round(avgMins)} mins`;
      document.getElementById("avgResolutionTime").textContent = display;
    } else {
      document.getElementById("avgResolutionTime").textContent = "No resolved incidents yet";
    }

    // ---- Most-dispatched services ---------------------------------------------
    const serviceCounts = {};
    dispatchLog.forEach((d) => { serviceCounts[d.serviceName] = (serviceCounts[d.serviceName] || 0) + 1; });
    const serviceData = Object.entries(serviceCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    renderBarChart("chartServices", serviceData);

    // ---- 14-day trend ------------------------------------------------------
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const trendPoints = days.map((d) => {
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = incidents.filter((inc) => {
        const t = new Date(inc.createdAt);
        return t >= d && t < next;
      }).length;
      return { label: dayLabel(d), value: count };
    });
    renderLineChart("chartTrend", trendPoints);

    // ---- Hour-of-day pattern ------------------------------------------------
    const hourCounts = new Array(24).fill(0);
    incidents.forEach((i) => { hourCounts[new Date(i.createdAt).getHours()]++; });
    const hourBuckets = [
      { label: "12am-4am", range: [0, 4] }, { label: "4am-8am", range: [4, 8] },
      { label: "8am-12pm", range: [8, 12] }, { label: "12pm-4pm", range: [12, 16] },
      { label: "4pm-8pm", range: [16, 20] }, { label: "8pm-12am", range: [20, 24] },
    ].map((b) => ({ label: b.label, value: hourCounts.slice(b.range[0], b.range[1]).reduce((a, c) => a + c, 0) }));
    renderBarChart("chartHourly", hourBuckets, () => "var(--pine)");
    const busiestBucket = hourBuckets.slice().sort((a, b) => b.value - a.value)[0];

    // ---- Location hotspots (grouped to roughly 1km grid cells) --------------
    const cellMap = {};
    incidents.forEach((i) => {
      if (i.latitude == null || i.longitude == null) return;
      const key = `${i.latitude.toFixed(2)},${i.longitude.toFixed(2)}`;
      if (!cellMap[key]) cellMap[key] = { count: 0, sampleLocation: i.location };
      cellMap[key].count++;
    });
    const hotspots = Object.values(cellMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ label: c.sampleLocation, value: c.count }));
    renderBarChart("chartHotspots", hotspots, () => "var(--alert)");

    // ---- Written insights ----------------------------------------------------
    const insights = [];
    if (incidents.length === 0) {
      insights.push("No incidents have been reported yet - insights will appear here once reports start coming in.");
    } else {
      if (typeData.length) {
        const top = typeData[0];
        const share = Math.round((top.value / incidents.length) * 100);
        insights.push(`${escapeHtml(top.label)} is the most frequent incident type, making up ${share}% of all reports.`);
      }
      if (busiestBucket && busiestBucket.value > 0) {
        insights.push(`Reports are most frequent between ${busiestBucket.label.replace("-", " and ")}, based on when incidents have historically been logged.`);
      }
      if (hotspots.length) {
        insights.push(`${escapeHtml(hotspots[0].label)} has the highest concentration of reported incidents, with ${hotspots[0].value} on record.`);
      }
      const aiApproved = dispatchLog.filter((d) => d.forwardedBy === "ai_triage").length;
      if (aiApproved > 0) {
        const aiShare = Math.round((aiApproved / Math.max(1, dispatchLog.length)) * 100);
        insights.push(`AI triage has auto-dispatched ${aiApproved} urgent incident${aiApproved === 1 ? "" : "s"} without waiting for manual review, ${aiShare}% of all dispatches.`);
      }
      if (avgMins != null) {
        const display = avgMins >= 60 ? `${(avgMins / 60).toFixed(1)} hours` : `${Math.round(avgMins)} minutes`;
        insights.push(`Resolved incidents take an average of ${display} from report to resolution.`);
      }
      const last7 = incidents.filter((i) => new Date(i.createdAt) >= new Date(Date.now() - 7 * 86400000)).length;
      const prev7 = incidents.filter((i) => {
        const t = new Date(i.createdAt);
        return t < new Date(Date.now() - 7 * 86400000) && t >= new Date(Date.now() - 14 * 86400000);
      }).length;
      if (prev7 > 0) {
        const change = Math.round(((last7 - prev7) / prev7) * 100);
        if (change !== 0) insights.push(`Reports are ${change > 0 ? "up" : "down"} ${Math.abs(change)}% in the last 7 days compared to the 7 days before that.`);
      }
    }
    document.getElementById("insightsList").innerHTML = insights.map((s) => `<li>${s}</li>`).join("");
  });
}

window.addEventListener("arts:section-shown", (e) => {
  if (e.detail.section === "analytics") loadAnalytics();
});

window.addEventListener("arts:data-changed", () => {
  if (document.getElementById("section-analytics").classList.contains("active")) loadAnalytics();
});

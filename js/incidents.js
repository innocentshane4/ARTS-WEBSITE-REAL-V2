/**
 * ARTS Admin — Incidents Controller
 */

let currentIncidentFilter = "All";
let currentIncidentSearch = "";
let activeIncidentId = null;

// ---- Row rendering (shared by Overview + full Incidents list) ---------------
const STALE_THRESHOLD_MINS = 30;

function isStale(incident) {
  if (incident.status !== "Pending") return false;
  const ageMins = (Date.now() - new Date(incident.createdAt).getTime()) / 60000;
  return ageMins > STALE_THRESHOLD_MINS;
}

function renderIncidentRow(incident) {
  const stale = isStale(incident);
  return `
    <div class="incident-row${stale ? " is-stale" : ""}" data-incident-id="${incident.id}">
      <div class="priority-bar ${incident.priority}"></div>
      <div class="incident-body">
        <div class="incident-top">
          <div class="incident-title">${escapeHtml(incident.title)}</div>
          <div class="badge-row">
            ${stale ? `<span class="badge badge-stale"><svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 3"/><path d="M9 3h6"/></svg> Awaiting review</span>` : ""}
            ${incident.autoForwarded ? `<span class="badge badge-ai">Dispatched by AI</span>` : ""}
            <span class="badge badge-${incident.priority}">${incident.priority}</span>
            <span class="badge badge-${incident.status}">${incident.status}</span>
          </div>
        </div>
        <div class="incident-meta">
          <span><svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHtml(incident.location)}</span>
          <span><svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> ${timeAgo(incident.createdAt)}</span>
          <span>Reported by ${escapeHtml(incident.reporterName)}</span>
        </div>
        <div class="incident-desc">${escapeHtml(truncate(incident.description, 140))}</div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len).trim() + "…" : str;
}

function attachIncidentRowClicks() {
  document.querySelectorAll(".incident-row[data-incident-id]").forEach((row) => {
    row.addEventListener("click", () => openIncidentDetail(row.dataset.incidentId));
  });
}

// ---- Full Incidents list (search + filter) -----------------------------------
function loadIncidentsList() {
  Store.getAll("incidents").then((incidents) => {
    let filtered = incidents;

    if (currentIncidentFilter !== "All") {
      filtered = filtered.filter((i) => i.status === currentIncidentFilter);
    }
    if (currentIncidentSearch.trim()) {
      const q = currentIncidentSearch.toLowerCase();
      filtered = filtered.filter(
        (i) => i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const container = document.getElementById("incidentsList");
    container.innerHTML = filtered.length
      ? filtered.map(renderIncidentRow).join("")
      : emptyStateHtml(
          currentIncidentSearch ? `No incidents match "${escapeHtml(currentIncidentSearch)}"` : "No incidents here",
          "Try a different filter or search term."
        );

    attachIncidentRowClicks();
  });
}

document.getElementById("incidentSearch").addEventListener("input", (e) => {
  currentIncidentSearch = e.target.value;
  loadIncidentsList();
});

document.querySelectorAll(".filter-chip[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip[data-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentIncidentFilter = chip.dataset.filter;
    loadIncidentsList();
  });
});

window.addEventListener("arts:section-shown", (e) => {
  if (e.detail.section === "incidents") loadIncidentsList();
});

// ---- Incident detail modal ------------------------------------------------------
function openIncidentDetail(id) {
  activeIncidentId = id;
  Store.getById("incidents", id).then((incident) => {
    if (!incident) return;

    document.getElementById("incidentModalTitle").textContent = incident.title;

    const forwardedLine = incident.forwardedTo && incident.forwardedTo.length
      ? `<div class="detail-row"><span class="k">Forwarded to</span><span class="v" id="forwardedNamesLine">Loading…</span></div>`
      : "";

    const aiLine = incident.autoForwarded
      ? `<div class="detail-row"><span class="k">Dispatch</span><span class="v"><span class="badge badge-ai">Dispatched by AI</span> Sent automatically because this report was urgent. Review and override if needed.</span></div>`
      : "";

    document.getElementById("incidentModalBody").innerHTML = `
      <div class="detail-row"><span class="k">Priority</span><span class="v"><span class="badge badge-${incident.priority}">${incident.priority}</span></span></div>
      <div class="detail-row"><span class="k">Status</span><span class="v"><span class="badge badge-${incident.status}">${incident.status}</span></span></div>
      <div class="detail-row"><span class="k">Type</span><span class="v">${escapeHtml(incident.type)}</span></div>
      <div class="detail-row"><span class="k">Location</span><span class="v">${escapeHtml(incident.location)}</span></div>
      <div class="detail-row"><span class="k">Reported by</span><span class="v">${escapeHtml(incident.reporterName)}</span></div>
      <div class="detail-row"><span class="k">Reported</span><span class="v">${formatDateTime(incident.createdAt)}</span></div>
      ${aiLine}
      ${forwardedLine}
      <div style="margin-top:16px;">
        <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin-bottom:6px;">DESCRIPTION</div>
        <p style="font-size:13.5px;line-height:1.6;">${escapeHtml(incident.description)}</p>
      </div>
      <div style="margin-top:16px;">
        <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin-bottom:8px;">PHOTO EVIDENCE</div>
        ${
          incident.photoUrl
            ? `<img src="${escapeHtml(incident.photoUrl)}" alt="Incident photo" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;border:1px solid var(--line);">
               ${incident.photoIsSample ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:6px;">Sample image — real photos submitted from the app will appear here.</div>` : ""}`
            : `<div style="background:var(--mint-tint);border:1px dashed var(--line);border-radius:10px;padding:24px;text-align:center;color:var(--ink-faint);font-size:13px;">No photo attached to this report.</div>`
        }
      </div>
      <div style="margin-top:16px;" id="medicalSection"></div>
    `;

    if (incident.reporterId) {
      Store.getById("users", incident.reporterId).then((reporter) => {
        const box = document.getElementById("medicalSection");
        if (!box) return;
        const med = reporter;
        const hasAny = med && (med.idNumber || med.bloodType || med.allergiesOrConditions || med.chronicConditions || med.medicalAidProvider || med.emergencyContactName);
        if (!hasAny) {
          box.innerHTML = `<div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin-bottom:8px;">MEDICAL INFORMATION</div>
            <div style="background:var(--mint-tint);border:1px dashed var(--line);border-radius:10px;padding:16px;text-align:center;color:var(--ink-faint);font-size:13px;">No medical information on file for this reporter.</div>`;
          return;
        }
        const row = (label, value) => value ? `<div class="detail-row"><span class="k">${label}</span><span class="v">${escapeHtml(value)}</span></div>` : "";
        box.innerHTML = `<div style="font-size:12.5px;color:var(--alert);font-weight:700;margin-bottom:8px;">MEDICAL INFORMATION — CONFIDENTIAL</div>
          <div style="background:var(--alert-tint);border-radius:10px;padding:4px 14px;">
            ${row("ID number", med.idNumber)}${row("Age", med.age)}${row("Gender", med.gender)}
            ${row("Blood type", med.bloodType)}${row("Height", med.heightCm ? med.heightCm + " cm" : "")}${row("Weight", med.weightKg ? med.weightKg + " kg" : "")}
            ${row("Allergies / conditions", med.allergiesOrConditions)}${row("Chronic conditions", med.chronicConditions)}${row("Current medications", med.currentMedications)}
            ${row("Preferred hospital", med.preferredHospital)}
            ${row("Medical aid", med.medicalAidProvider ? `${med.medicalAidProvider} ${med.medicalAidNumber ? "· " + med.medicalAidNumber : ""}` : "")}
            ${row("Emergency contact", med.emergencyContactName ? `${med.emergencyContactName} · ${med.emergencyContactPhone || "no number given"}` : "")}
          </div>`;
      });
    } else {
      const box = document.getElementById("medicalSection");
      if (box) box.innerHTML = "";
    }

    if (incident.forwardedTo && incident.forwardedTo.length) {
      Promise.all(incident.forwardedTo.map((sid) => Store.getById("contractedServices", sid))).then((services) => {
        const line = document.getElementById("forwardedNamesLine");
        if (line) line.textContent = services.filter(Boolean).map((s) => s.name).join(", ");
      });
    }

    const footer = document.getElementById("incidentModalFooter");
    const buttons = [];

    if (incident.status !== "Resolved") {
      buttons.push(`<button class="btn btn-secondary" id="btnForwardIncident">Forward to Services</button>`);
    }
    if (incident.status !== "Resolved") {
      buttons.push(`<button class="btn btn-primary" id="btnResolveIncident" style="width:auto;">Mark Resolved</button>`);
    }
    buttons.push(`<button class="btn btn-danger" id="btnDeleteIncident">Delete</button>`);

    footer.innerHTML = buttons.join("");

    const forwardBtn = document.getElementById("btnForwardIncident");
    if (forwardBtn) forwardBtn.addEventListener("click", () => openForwardModal(incident.id));

    const resolveBtn = document.getElementById("btnResolveIncident");
    if (resolveBtn) resolveBtn.addEventListener("click", () => resolveIncident(incident.id));

    document.getElementById("btnDeleteIncident").addEventListener("click", () => {
      confirmAction(
        "Delete this incident?",
        "This permanently removes the incident and its dispatch history. This cannot be undone.",
        () => deleteIncident(incident.id)
      );
    });

    openModal("incidentModal");
  });
}

/** Sends the reporter a message that appears on the Alerts screen of the ARTS app. */
function notifyReporter(incidentId, title, message, type) {
  return Store.getById("incidents", incidentId)
    .then((incident) => {
      if (!incident || !incident.reporterId) return null;
      return fbDb.collection("users").doc(incident.reporterId).collection("alerts").add({
        title, message, type: type || "INCIDENT_UPDATE", read: false, createdAt: new Date().toISOString(),
      });
    })
    .catch((err) => console.warn("[ARTS] Could not alert the reporter:", err.code || err.message));
}

function resolveIncident(id) {
  Store.update("incidents", id, {
    status: "Resolved",
    resolvedAt: new Date().toISOString(),
    resolvedBy: session ? session.uid : "admin",
  }).then(() => {
    notifyReporter(id, "Incident resolved", "Your incident report has been marked as resolved.", "INCIDENT_RESOLVED");
    closeModal("incidentModal");
    showToast("Incident marked as resolved.");
    loadIncidentsList();
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
  });
}

function deleteIncident(id) {
  Store.remove("incidents", id).then(() => {
    closeModal("incidentModal");
    showToast("Incident deleted.", "danger");
    loadIncidentsList();
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
  });
}

// ---- Forward-to-service modal ---------------------------------------------------
function openForwardModal(incidentId) {
  activeIncidentId = incidentId;
  Store.query("contractedServices", (s) => s.active).then((services) => {
    const list = document.getElementById("forwardServiceList");
    if (!services.length) {
      list.innerHTML = emptyStateHtml("No active services", "Add a contracted service first.");
      return;
    }
    list.innerHTML = services
      .map(
        (s) => `
      <label class="service-check-item" data-service-checkbox>
        <input type="checkbox" value="${s.id}">
        <div>
          <div class="svc-name">${escapeHtml(s.name)}</div>
          <div class="svc-type">${escapeHtml(s.serviceType)} · ${escapeHtml(s.phone)}</div>
        </div>
      </label>`
      )
      .join("");

    list.querySelectorAll("[data-service-checkbox]").forEach((label) => {
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => label.classList.toggle("checked", checkbox.checked));
    });

    closeModal("incidentModal");
    openModal("forwardModal");
  });
}

document.getElementById("confirmForwardBtn").addEventListener("click", () => {
  const checked = Array.from(document.querySelectorAll("#forwardServiceList input:checked")).map((cb) => cb.value);
  if (!checked.length) {
    showToast("Select at least one service to forward to.", "danger");
    return;
  }
  if (!activeIncidentId) return;

  Store.getById("incidents", activeIncidentId).then((incident) => {
    const forwardedTo = Array.from(new Set([...(incident.forwardedTo || []), ...checked]));
    Store.update("incidents", activeIncidentId, {
      status: "Forwarded",
      forwardedTo,
      forwardedAt: new Date().toISOString(),
    }).then(() => {
      return Promise.all(
        checked.map((serviceId) =>
          Store.getById("contractedServices", serviceId).then((service) =>
            Store.add("dispatchLog", {
              incidentId: activeIncidentId,
              serviceId,
              serviceName: service ? service.name : "Unknown service",
              forwardedBy: session ? session.uid : "admin",
              forwardedAt: new Date().toISOString(),
              notes: "",
            })
          )
        )
      );
    }).then(() => {
      notifyReporter(activeIncidentId, "Help is on the way", `Your report was forwarded to ${checked.length} emergency service${checked.length === 1 ? "" : "s"}.`, "INCIDENT_UPDATE");
      closeModal("forwardModal");
      showToast(`Forwarded to ${checked.length} service${checked.length === 1 ? "" : "s"}.`);
      loadIncidentsList();
      window.dispatchEvent(new CustomEvent("arts:data-changed"));
    });
  });
});

// ---- CSV Export ----------------------------------------------------------------
function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  Store.getAll("incidents").then((incidents) => {
    let filtered = incidents;
    if (currentIncidentFilter !== "All") {
      filtered = filtered.filter((i) => i.status === currentIncidentFilter);
    }
    if (currentIncidentSearch.trim()) {
      const q = currentIncidentSearch.toLowerCase();
      filtered = filtered.filter(
        (i) => i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      showToast("Nothing to export for the current filter.", "danger");
      return;
    }

    const headers = ["Title", "Type", "Priority", "Status", "Location", "Reported By", "Reported At", "Resolved At", "Description"];
    const rows = filtered.map((i) => [
      i.title, i.type, i.priority, i.status, i.location, i.reporterName,
      formatDateTime(i.createdAt), i.resolvedAt ? formatDateTime(i.resolvedAt) : "",
      i.description,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arts-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filtered.length} incident${filtered.length === 1 ? "" : "s"} to CSV.`);
  });
});

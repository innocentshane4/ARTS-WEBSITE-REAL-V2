/**
 * ARTS Admin — Contracted Services Controller
 */

let currentServiceTypeFilter = "All";
let currentServiceSearch = "";

function loadServicesGrid() {
  Store.getAll("contractedServices").then((services) => {
    let filtered = services;

    if (currentServiceTypeFilter !== "All") {
      filtered = filtered.filter((s) => s.serviceType === currentServiceTypeFilter);
    }
    if (currentServiceSearch.trim()) {
      const q = currentServiceSearch.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const grid = document.getElementById("servicesGrid");
    grid.innerHTML = filtered.length
      ? filtered.map(renderServiceCard).join("")
      : emptyStateHtml(
          currentServiceSearch ? `No services match "${escapeHtml(currentServiceSearch)}"` : "No services yet",
          "Add your first contracted service to get started."
        );

    attachServiceCardHandlers();
  });
}

function renderServiceCard(service) {
  return `
    <div class="service-card ${service.active ? "" : "inactive"}" data-service-id="${service.id}">
      <div class="service-card-top">
        <div>
          <div class="svc-name">${escapeHtml(service.name)}</div>
          <span class="svc-type-tag">${escapeHtml(service.serviceType)}</span>
        </div>
      </div>
      <div class="svc-detail"><svg class="svc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8 10a16 16 0 0 0 6 6l1.3-1.4a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2.1z"/></svg> ${escapeHtml(service.phone)}</div>
      ${service.email ? `<div class="svc-detail"><svg class="svc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg> ${escapeHtml(service.email)}</div>` : ""}
      ${service.address ? `<div class="svc-detail"><svg class="svc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHtml(service.address)}</div>` : ""}
      ${!service.active ? `<div class="svc-detail" style="color:var(--alert);font-weight:600;margin-top:8px;">Inactive contract</div>` : ""}
      <div class="service-card-actions">
        <button class="btn btn-secondary btn-sm" data-edit-service="${service.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-toggle-service="${service.id}">${service.active ? "Deactivate" : "Activate"}</button>
        <button class="btn btn-danger btn-sm" data-delete-service="${service.id}">Delete</button>
      </div>
    </div>`;
}

function attachServiceCardHandlers() {
  document.querySelectorAll("[data-edit-service]").forEach((btn) => {
    btn.addEventListener("click", () => openServiceModal(btn.dataset.editService));
  });
  document.querySelectorAll("[data-toggle-service]").forEach((btn) => {
    btn.addEventListener("click", () => toggleServiceActive(btn.dataset.toggleService));
  });
  document.querySelectorAll("[data-delete-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction(
        "Remove this service?",
        "This service will no longer be available to forward incidents to. This cannot be undone.",
        () => deleteService(btn.dataset.deleteService)
      );
    });
  });
}

document.getElementById("serviceSearch").addEventListener("input", (e) => {
  currentServiceSearch = e.target.value;
  loadServicesGrid();
});

document.querySelectorAll(".filter-chip[data-svc-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip[data-svc-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentServiceTypeFilter = chip.dataset.svcFilter;
    loadServicesGrid();
  });
});

window.addEventListener("arts:section-shown", (e) => {
  if (e.detail.section === "services") loadServicesGrid();
});

// ---- Add / Edit modal --------------------------------------------------------
document.getElementById("addServiceBtn").addEventListener("click", () => openServiceModal(null));

function openServiceModal(serviceId) {
  const form = document.getElementById("serviceForm");
  form.reset();
  document.getElementById("svcId").value = "";
  document.getElementById("svcActive").checked = true;

  if (serviceId) {
    document.getElementById("serviceModalTitle").textContent = "Edit Service";
    Store.getById("contractedServices", serviceId).then((service) => {
      if (!service) return;
      document.getElementById("svcId").value = service.id;
      document.getElementById("svcName").value = service.name;
      document.getElementById("svcType").value = service.serviceType;
      document.getElementById("svcPhone").value = service.phone;
      document.getElementById("svcEmail").value = service.email || "";
      document.getElementById("svcAddress").value = service.address || "";
      document.getElementById("svcNotes").value = service.notes || "";
      document.getElementById("svcActive").checked = service.active;
      openModal("serviceModal");
    });
  } else {
    document.getElementById("serviceModalTitle").textContent = "Add Service";
    openModal("serviceModal");
  }
}

document.getElementById("saveServiceBtn").addEventListener("click", () => {
  const name = document.getElementById("svcName").value.trim();
  const phone = document.getElementById("svcPhone").value.trim();

  if (!name || !phone) {
    showToast("Service name and phone number are required.", "danger");
    return;
  }

  const data = {
    name,
    serviceType: document.getElementById("svcType").value,
    phone,
    email: document.getElementById("svcEmail").value.trim(),
    address: document.getElementById("svcAddress").value.trim(),
    notes: document.getElementById("svcNotes").value.trim(),
    active: document.getElementById("svcActive").checked,
  };

  const existingId = document.getElementById("svcId").value;
  const savePromise = existingId
    ? Store.update("contractedServices", existingId, data)
    : Store.add("contractedServices", { ...data, createdAt: new Date().toISOString() });

  savePromise.then(() => {
    closeModal("serviceModal");
    showToast(existingId ? "Service updated." : "Service added.");
    loadServicesGrid();
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
  });
});

function toggleServiceActive(id) {
  Store.getById("contractedServices", id).then((service) => {
    if (!service) return;
    Store.update("contractedServices", id, { active: !service.active }).then(() => {
      showToast(service.active ? "Service deactivated." : "Service activated.");
      loadServicesGrid();
      window.dispatchEvent(new CustomEvent("arts:data-changed"));
    });
  });
}

function deleteService(id) {
  Store.remove("contractedServices", id).then(() => {
    showToast("Service removed.", "danger");
    loadServicesGrid();
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
  });
}

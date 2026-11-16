/**
 * ARTS Admin — Notifications Controller
 * Surfaces the automated alerts fired whenever a new incident comes in.
 */

function refreshNotifications() {
  Store.getAll("notifications").then((notifs) => {
    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unread = notifs.filter((n) => !n.read);

    const countEl = document.getElementById("notifCount");
    if (unread.length > 0) {
      countEl.style.display = "flex";
      countEl.textContent = unread.length;
    } else {
      countEl.style.display = "none";
    }

    const body = document.getElementById("notifPanelBody");
    body.innerHTML = notifs.length
      ? notifs.slice(0, 20).map(renderNotifItem).join("")
      : `<div class="notif-empty">No notifications yet.</div>`;

    body.querySelectorAll("[data-notif-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const notifId = el.dataset.notifId;
        const incidentId = el.dataset.incidentId;
        Store.update("notifications", notifId, { read: true }).then(() => {
          refreshNotifications();
          closeNotifPanel();
          if (incidentId) openIncidentDetail(incidentId);
        });
      });
    });
  });
}

function renderNotifItem(n) {
  return `
    <div class="notif-item${n.read ? "" : " unread"}" data-notif-id="${n.id}" data-incident-id="${n.incidentId || ""}">
      ${!n.read ? `<span class="notif-dot"></span>` : ""}
      <div class="notif-text">
        <div class="notif-msg">${escapeHtml(n.message)}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>`;
}

function openNotifPanel() {
  document.getElementById("notifPanel").classList.add("open");
}
function closeNotifPanel() {
  document.getElementById("notifPanel").classList.remove("open");
}

document.getElementById("notifBellBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("notifPanel");
  panel.classList.contains("open") ? closeNotifPanel() : openNotifPanel();
});

document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".notif-wrap");
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

document.getElementById("markAllReadBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  Store.getAll("notifications").then((notifs) => {
    Promise.all(notifs.filter((n) => !n.read).map((n) => Store.update("notifications", n.id, { read: true })))
      .then(() => refreshNotifications());
  });
});

// Whenever any incident data changes (new report, forward, resolve), notifications may have changed too
window.addEventListener("arts:data-changed", refreshNotifications);

refreshNotifications();

/**
 * ARTS Admin — Users Controller
 */

let currentUserSearch = "";

function loadUsersTable() {
  Store.getAll("users").then((users) => {
    let filtered = users;

    if (currentUserSearch.trim()) {
      const q = currentUserSearch.toLowerCase();
      filtered = filtered.filter(
        (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById("usersTableBody");

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyStateHtml(
        currentUserSearch ? `No users match "${escapeHtml(currentUserSearch)}"` : "No registered users yet",
        "Users will appear here once they sign up in the ARTS app."
      )}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (u) => `
      <tr data-user-id="${u.id}" style="cursor:pointer;">
        <td>
          <div class="name-cell">${escapeHtml(u.fullName)}</div>
          <div class="sub-cell">${escapeHtml(u.gender || "")}${u.age ? ", " + escapeHtml(u.age) + " yrs" : ""}</div>
        </td>
        <td>
          <div>${escapeHtml(u.email)}</div>
          <div class="sub-cell">${escapeHtml(u.phone || "")}</div>
        </td>
        <td>${escapeHtml(u.bloodType || "—")}</td>
        <td>${escapeHtml(u.medicalAidProvider || "—")}</td>
        <td>${formatDateTime(u.createdAt)}</td>
        <td>
          <button class="icon-btn danger" data-delete-user="${u.id}" title="Remove user"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("tr[data-user-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-delete-user]")) return;
        openUserDetail(row.dataset.userId);
      });
    });

    tbody.querySelectorAll("[data-delete-user]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmAction(
          "Remove this user?",
          "This permanently deletes the user's account and medical profile. This cannot be undone.",
          () => deleteUser(btn.dataset.deleteUser)
        );
      });
    });
  });
}

document.getElementById("userSearch").addEventListener("input", (e) => {
  currentUserSearch = e.target.value;
  loadUsersTable();
});

window.addEventListener("arts:section-shown", (e) => {
  if (e.detail.section === "users") loadUsersTable();
});

// ---- User detail modal (full medical profile) --------------------------------
function openUserDetail(userId) {
  Store.getById("users", userId).then((u) => {
    if (!u) return;
    document.getElementById("userModalTitle").textContent = u.fullName;

    document.getElementById("userModalBody").innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin-bottom:8px;">CONTACT</div>
      <div class="detail-row"><span class="k">Email</span><span class="v">${escapeHtml(u.email)}</span></div>
      <div class="detail-row"><span class="k">Phone</span><span class="v">${escapeHtml(u.phone || "—")}</span></div>
      <div class="detail-row"><span class="k">Joined</span><span class="v">${formatDateTime(u.createdAt)}</span></div>

      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin:20px 0 8px;">IDENTITY</div>
      <div class="detail-row"><span class="k">ID Number</span><span class="v">${escapeHtml(u.idNumber || "—")}</span></div>
      <div class="detail-row"><span class="k">Age</span><span class="v">${escapeHtml(u.age || "—")}</span></div>
      <div class="detail-row"><span class="k">Gender</span><span class="v">${escapeHtml(u.gender || "—")}</span></div>

      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin:20px 0 8px;">MEDICAL PROFILE</div>
      <div class="detail-row"><span class="k">Blood Type</span><span class="v">${escapeHtml(u.bloodType || "—")}</span></div>
      <div class="detail-row"><span class="k">Weight / Height</span><span class="v">${escapeHtml(u.weightKg || "—")} kg / ${escapeHtml(u.heightCm || "—")} cm</span></div>
      <div class="detail-row"><span class="k">Allergies</span><span class="v">${escapeHtml(u.allergiesOrConditions || "None")}</span></div>
      <div class="detail-row"><span class="k">Chronic Conditions</span><span class="v">${escapeHtml(u.chronicConditions || "None")}</span></div>
      <div class="detail-row"><span class="k">Current Medications</span><span class="v">${escapeHtml(u.currentMedications || "None")}</span></div>

      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin:20px 0 8px;">MEDICAL AID</div>
      <div class="detail-row"><span class="k">Provider</span><span class="v">${escapeHtml(u.medicalAidProvider || "—")}</span></div>
      <div class="detail-row"><span class="k">Number</span><span class="v">${escapeHtml(u.medicalAidNumber || "—")}</span></div>
      <div class="detail-row"><span class="k">Preferred Hospital</span><span class="v">${escapeHtml(u.preferredHospital || "—")}</span></div>

      <div style="font-size:12.5px;color:var(--ink-soft);font-weight:600;margin:20px 0 8px;">EMERGENCY CONTACT</div>
      <div class="detail-row"><span class="k">Name</span><span class="v">${escapeHtml(u.emergencyContactName || "—")}</span></div>
      <div class="detail-row"><span class="k">Phone</span><span class="v">${escapeHtml(u.emergencyContactPhone || "—")}</span></div>
    `;

    openModal("userModal");
  });
}

/**
 * Removes a user's Firestore profile AND their actual Firebase
 * Authentication account.
 *
 * FIX: this previously only removed the Firestore profile document, which
 * left the person's real login untouched — they could sign back in and the
 * app would quietly recreate a blank profile. Deleting someone else's
 * Authentication account can only be done by a trusted server holding
 * Admin SDK credentials, so this now also calls the free push-server's
 * /api/delete-user endpoint (see firebase.js for ARTS_PUSH_SERVER_URL).
 *
 * If the server URL isn't configured, the Firestore profile is still
 * removed as before — this degrades gracefully rather than blocking the
 * admin from removing a user at all.
 */
function deleteUser(id) {
  Store.remove("users", id).then(async () => {
    await deleteAuthAccount(id);
    showToast("User removed.", "danger");
    loadUsersTable();
    window.dispatchEvent(new CustomEvent("arts:data-changed"));
  });
}

async function deleteAuthAccount(targetUid) {
  if (!ARTS_PUSH_SERVER_URL) return; // feature disabled — Firestore profile removal still happened.

  try {
    const idToken = await fbAuth.currentUser.getIdToken();
    await fetch(`${ARTS_PUSH_SERVER_URL}/api/delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, targetUid }),
    });
  } catch (e) {
    // Non-fatal: the Firestore profile is already gone either way. The
    // person's login account may linger until this is retried or fixed.
    console.warn("Could not delete the Authentication account:", e.message);
  }
}

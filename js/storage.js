/**
 * ARTS - Data and Authentication Layer (Firebase)
 * ------------------------------------------------------------------
 * Store     - generic async access to Cloud Firestore collections.
 *             The method names are unchanged from the earlier
 *             localStorage version, so the dashboard code above this
 *             file did not need to change.
 * UserAuth  - public users: email/password and Google sign-in, profile,
 *             emergency medical information, settings, optional TOTP.
 * AuthStore - administrators: same sign-in methods, but the account
 *             must also have an admins/{uid} document.
 *
 * Passwords are never handled here. Firebase Authentication stores and
 * verifies them (salted and hashed on Google's servers).
 * ------------------------------------------------------------------
 */

function generateId() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/** Firestore rejects undefined values, so turn them into null. */
function cleanForFirestore(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => { out[k] = obj[k] === undefined ? null : obj[k]; });
  return out;
}

function docToRecord(doc) {
  return { id: doc.id, ...doc.data() };
}

const Store = {
  async getAll(collection) {
    await authReady;
    const snap = await fbDb.collection(collection).get();
    return snap.docs.map(docToRecord);
  },

  /** Equality query. Needed for non-admin users, whose security rules only allow reading their own records. */
  async getWhere(collection, field, value) {
    await authReady;
    const snap = await fbDb.collection(collection).where(field, "==", value).get();
    return snap.docs.map(docToRecord);
  },

  async getById(collection, id) {
    await authReady;
    const snap = await fbDb.collection(collection).doc(id).get();
    return snap.exists ? docToRecord(snap) : null;
  },

  async add(collection, data) {
    await authReady;
    const ref = fbDb.collection(collection).doc();
    const clean = cleanForFirestore(data);
    delete clean.id;
    await ref.set(clean);
    console.info("[ARTS] Added " + collection + "/" + ref.id);
    return { id: ref.id, ...clean };
  },

  async update(collection, id, patch) {
    await authReady;
    const ref = fbDb.collection(collection).doc(id);
    await ref.update(cleanForFirestore(patch));
    const snap = await ref.get();
    return docToRecord(snap);
  },

  async remove(collection, id) {
    await authReady;
    await fbDb.collection(collection).doc(id).delete();
    console.info("[ARTS] Removed " + collection + "/" + id);
    return true;
  },

  async query(collection, predicate) {
    return (await this.getAll(collection)).filter(predicate);
  },

  /** Writes many records at once using each record's own id as the document id (used to load demo data). */
  async setMany(collection, records) {
    await authReady;
    for (let i = 0; i < records.length; i += 400) {
      const batch = fbDb.batch();
      records.slice(i, i + 400).forEach((rec) => {
        const data = cleanForFirestore(rec);
        const id = data.id || generateId();
        delete data.id;
        batch.set(fbDb.collection(collection).doc(id), data);
      });
      await batch.commit();
    }
    console.info("[ARTS] Loaded " + records.length + " records into " + collection);
  },
};

/** Turns Firebase error codes into messages a person can act on. */
function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/weak-password": "Use a password of at least 8 characters.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-login-credentials": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before it finished.",
    "auth/cancelled-popup-request": "The Google sign-in window was closed before it finished.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This web address is not authorised for sign-in. Add it under Authentication, Settings, Authorized domains.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase yet.",
  };
  console.warn("[ARTS] Auth error:", err.code || err.message);
  return map[err.code] || err.message || "Something went wrong. Please try again.";
}

function defaultProfile(user, fullName) {
  return {
    fullName: (fullName || user.displayName || (user.email || "").split("@")[0] || "ARTS user").trim(),
    email: user.email || "",
    phone: "",
    createdAt: new Date().toISOString(),
    safetyScore: 85,
    avatarDataUrl: null,
    settings: { theme: "light", language: "en" },
    // Emergency medical profile - flat fields shared with the admin Users view
    idNumber: null, age: null, gender: null, bloodType: null, weightKg: null, heightCm: null,
    allergiesOrConditions: null, chronicConditions: null, currentMedications: null,
    medicalAidProvider: null, medicalAidNumber: null, preferredHospital: null,
    emergencyContactName: null, emergencyContactPhone: null,
  };
}

const UserAuth = {
  _userRef(uid) { return fbDb.collection("users").doc(uid); },
  _securityRef(uid) { return fbDb.collection("users").doc(uid).collection("private").doc("security"); },
  _totpFlag(uid) { return "arts_totp_ok_" + uid; },

  /** Creates the users/{uid} profile the first time someone signs in. */
  async _ensureProfile(user, fullName) {
    const ref = this._userRef(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const profile = defaultProfile(user, fullName);
    await ref.set(profile);
    console.info("[ARTS] Created profile for " + user.uid);
    return profile;
  },

  _session(user, profile) {
    return { uid: user.uid, fullName: profile.fullName, email: user.email };
  },

  /** True if this user has 2FA on and has not yet entered a code in this browser session. */
  async totpPending(uid) {
    if (sessionStorage.getItem(this._totpFlag(uid))) return false;
    const snap = await this._securityRef(uid).get();
    return snap.exists && snap.data().totpEnabled === true;
  },

  async _finishSignIn(user, fullName) {
    const profile = await this._ensureProfile(user, fullName);
    if (await this.totpPending(user.uid)) return { requiresTotp: true, uid: user.uid };
    return { requiresTotp: false, session: this._session(user, profile) };
  },

  async register(fullName, email, password) {
    try {
      const cred = await fbAuth.createUserWithEmailAndPassword(email.trim(), password);
      await cred.user.updateProfile({ displayName: fullName.trim() });
      return await this._finishSignIn(cred.user, fullName);
    } catch (err) { throw new Error(friendlyAuthError(err)); }
  },

  async login(email, password) {
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email.trim(), password);
      return await this._finishSignIn(cred.user);
    } catch (err) { throw new Error(friendlyAuthError(err)); }
  },

  /** Single sign-on through Google. */
  async loginWithGoogle() {
    try {
      const cred = await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      return await this._finishSignIn(cred.user);
    } catch (err) { throw new Error(friendlyAuthError(err)); }
  },

  /** Call after the user enters their 6-digit authenticator code. */
  async completeTotpLogin(uid, code) {
    const snap = await this._securityRef(uid).get();
    if (!snap.exists || !snap.data().totpSecret) throw new Error("Two-factor authentication is not set up for this account.");
    if (!(await TOTP.verify(snap.data().totpSecret, code))) throw new Error("Incorrect code, please try again.");
    sessionStorage.setItem(this._totpFlag(uid), "1");
    const user = fbAuth.currentUser;
    const profile = await this._ensureProfile(user);
    return this._session(user, profile);
  },

  /** Full profile, with the 2FA fields merged in from the private subdocument. */
  async getUser(uid) {
    const [profile, security] = await Promise.all([this._userRef(uid).get(), this._securityRef(uid).get()]);
    if (!profile.exists) return null;
    const sec = security.exists ? security.data() : {};
    return { id: uid, ...profile.data(), totpEnabled: sec.totpEnabled === true, totpSecret: sec.totpSecret || null };
  },

  async enableTotp(uid, secret) {
    await this._securityRef(uid).set({ totpSecret: secret, totpEnabled: true });
    sessionStorage.setItem(this._totpFlag(uid), "1");
  },

  async disableTotp(uid) {
    await this._securityRef(uid).set({ totpSecret: null, totpEnabled: false });
  },

  /** Editable profile fields only - email and account creation date are locked. */
  async updateProfile(uid, { fullName, phone }) {
    const name = fullName.trim();
    await this._userRef(uid).update({ fullName: name, phone: (phone || "").trim() });
    if (fbAuth.currentUser) await fbAuth.currentUser.updateProfile({ displayName: name });
  },

  async updateAvatar(uid, dataUrl) { await this._userRef(uid).update({ avatarDataUrl: dataUrl }); },

  async updateSettings(uid, settings) {
    const current = await this.getUser(uid);
    await this._userRef(uid).update({ settings: { ...(current.settings || { theme: "light", language: "en" }), ...settings } });
  },

  /** Emergency medical profile, shown to admins/officials against any incident this user reports. */
  async saveMedical(uid, medical) { await this._userRef(uid).update(cleanForFirestore(medical)); },

  async logout() {
    if (fbAuth.currentUser) sessionStorage.removeItem(this._totpFlag(fbAuth.currentUser.uid));
    await fbAuth.signOut();
  },

  /** Resolves with a session, or sends the visitor to the sign-in page and resolves null. */
  async requireAuth() {
    const user = await authReady;
    if (!user) { window.location.href = "index.html"; return null; }
    if (await this.totpPending(user.uid)) { window.location.href = "index.html"; return null; }
    const profile = await this._ensureProfile(user);
    return this._session(user, profile);
  },
};

const AuthStore = {
  async _assertAdmin(user) {
    if (await fbIsAdmin(user.uid)) return;
    const uid = user.uid;
    await fbAuth.signOut();
    throw new Error("This account is not an administrator. Account ID: " + uid);
  },

  _session(user) {
    return { uid: user.uid, fullName: user.displayName || user.email, email: user.email };
  },

  async login(email, password) {
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email.trim(), password);
      await this._assertAdmin(cred.user);
      return this._session(cred.user);
    } catch (err) {
      if (err.code) throw new Error(friendlyAuthError(err));
      throw err;
    }
  },

  async loginWithGoogle() {
    try {
      const cred = await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await this._assertAdmin(cred.user);
      return this._session(cred.user);
    } catch (err) {
      if (err.code) throw new Error(friendlyAuthError(err));
      throw err;
    }
  },

  logout() { return fbAuth.signOut(); },

  async requireAuth() {
    const user = await authReady;
    if (!user || !(await fbIsAdmin(user.uid))) { window.location.href = "index.html"; return null; }
    return this._session(user);
  },
};

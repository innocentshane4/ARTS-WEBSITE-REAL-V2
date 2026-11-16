/**
 * ARTS - Firebase connection (project: arts-477f0)
 * ------------------------------------------------------------------
 * Loaded after the Firebase compat SDK scripts. Exposes:
 *   fbAuth     - Firebase Authentication
 *   fbDb       - Cloud Firestore
 *   authReady  - Promise that resolves once with the signed-in user
 *                (or null) after Firebase restores any saved session
 *   fbIsAdmin  - checks whether a user id has an admins/{uid} document
 *
 * The web config values below identify the project; they do not grant
 * access. Access is controlled by firestore.rules.
 * ------------------------------------------------------------------
 */
const firebaseConfig = {
  apiKey: "AIzaSyBT6RcvcWa5NewFozgOLxmqs8QVyqSF1j8",
  authDomain: "arts-477f0.firebaseapp.com",
  projectId: "arts-477f0",
  storageBucket: "arts-477f0.firebasestorage.app",
  messagingSenderId: "296350946511",
  appId: "1:296350946511:web:68a4f7c3cd594f72b613ba",
  measurementId: "G-4KHZYVD8W4",
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();

/**
 * The free push-notification server (Vercel, no Blaze plan required — see
 * /push-server/README.md). Used for anything the browser's own Firebase SDK
 * cannot do by itself: sending a push, or deleting someone else's
 * Authentication account (users.js's deleteUser()).
 *
 * Leave this blank to disable both features gracefully — the rest of the
 * site works fine without it, exactly like the Android app's equivalent
 * constant in local.properties.
 */
const ARTS_PUSH_SERVER_URL = "https://push-server-neon.vercel.app";

const authReady = new Promise((resolve) => {
  const unsubscribe = fbAuth.onAuthStateChanged((user) => {
    unsubscribe();
    resolve(user);
  });
});

async function fbIsAdmin(uid) {
  try {
    const snap = await fbDb.collection("admins").doc(uid).get();
    return snap.exists;
  } catch (err) {
    console.warn("[ARTS] Admin check failed:", err.code || err.message);
    return false;
  }
}
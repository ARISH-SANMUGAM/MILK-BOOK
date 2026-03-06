/**
 * 🔥 FIREBASE CONFIGURATION — MILKBOOK APP
 */

const firebaseConfig = {
  apiKey: "AIzaSyBEhS9KGFLAK_yMhyfRGH3KjCRL8IUDdjE",
  authDomain: "milk-book-66633.firebaseapp.com",
  projectId: "milk-book-66633",
  storageBucket: "milk-book-66633.firebasestorage.app",
  messagingSenderId: "416631232949",
  appId: "1:416631232949:web:34c4ae31e58074ecaf21fc",
  measurementId: "G-FXJQPM4L22"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

let _app, _db, _auth, _analytics;

const IS_DEMO_MODE = false;

if (!IS_DEMO_MODE) {
  _app = initializeApp(firebaseConfig);
  _db = getFirestore(_app);
  _auth = getAuth(_app);
  _analytics = getAnalytics(_app);

  // Enable offline persistence
  enableIndexedDbPersistence(_db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Persistence: Multiple tabs open.");
    }
  });

  // Silent anonymous login since the user removed the login UI
  const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const authPromise = signInAnonymously(_auth)
    .then(() => console.log("🔥 Firebase: Connected (Anonymous Cloud Sync active)"))
    .catch((err) => {
      console.error("🔥 Firebase: Auth error", err);
      return Promise.reject(err);
    });
  window.__FB_READY = authPromise;
} else {
  window.__FB_READY = Promise.resolve();
}

// Export so other modules can use them
window.__FB = { db: _db, auth: _auth, analytics: _analytics, isDemoMode: IS_DEMO_MODE };

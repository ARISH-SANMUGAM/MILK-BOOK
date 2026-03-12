import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBEhS9KGFLAK_yMhyfRGH3KjCRL8IUDdjE",
  authDomain: "milk-book-66633.firebaseapp.com",
  projectId: "milk-book-66633",
  storageBucket: "milk-book-66633.firebasestorage.app",
  messagingSenderId: "416631232949",
  appId: "1:416631232949:web:34c4ae31e58074ecaf21fc",
  measurementId: "G-FXJQPM4L22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Enable offline persistence
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Persistence: Multiple tabs open.");
    }
  });

  signInAnonymously(auth)
    .then(() => console.log("🔥 Firebase: Connected (Anonymous Cloud Sync active)"))
    .catch((err) => {
      console.error("🔥 Firebase: Auth error", err);
    });
}

export { app, db, auth, analytics };

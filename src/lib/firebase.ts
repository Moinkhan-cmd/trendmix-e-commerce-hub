import { initializeApp } from "firebase/app";
import { getAuth, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBHCi9qos1ogWHQQkrqmJMTGoipdhLVK9Y",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trendmix-admin.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trendmix-admin",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:34711943448:web:e42b6339d24cd16dd2066d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trendmix-admin.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "34711943448",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Set session persistence - user will be logged out when browser is closed
// This clears any previously cached auth state from localStorage/IndexedDB
setPersistence(auth, browserSessionPersistence).catch(console.error);

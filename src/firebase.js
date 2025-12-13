// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Import compat versions for FirebaseUI
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Replace everything inside the {} with YOUR real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E",
  authDomain: "strokesnchokes.firebaseapp.com", // Changed from package name to Firebase auth domain
  projectId: "strokesnchokes",
  storageBucket: "strokesnchokes.firebasestorage.app",
  messagingSenderId: "853506983444", // Updated from placeholder to actual sender ID
  appId: "1:853506983444:android:1d60b493b5bda804c40901"
};

// Initialize Firebase (modular SDK)
const app = initializeApp(firebaseConfig);

// Initialize Firebase compat for FirebaseUI
// Only initialize if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export modular SDK versions for the rest of the app
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export compat auth for FirebaseUI
export const authCompat = firebase.auth();

export default app;

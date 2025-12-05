// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace everything inside the {} with YOUR real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E",
  authDomain: "com.strokesnchokes.strokesnchokes",
  projectId: "strokesnchokes",
  storageBucket: "strokesnchokes.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:853506983444:android:1d60b493b5bda804c40901"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export these so the rest of your app can use them
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

/// <reference types="vite/client" />
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import rawConfig from '../../firebase-applet-config.json';

// Safely prioritize environment variables if provided, falling back to provisioned config
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || rawConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || rawConfig.measurementId || '',
  firestoreDatabaseId: rawConfig.firestoreDatabaseId || '(default)'
};

// Prevent Firebase from being initialized more than once
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Authentication
export const auth: Auth = getAuth(app);

// Firestore: pass the explicit database ID provisioned for this project
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Cloud Storage for Firebase
export const storage: FirebaseStorage = getStorage(app);

// Cloud Functions (2nd Gen)
export const functions: Functions = getFunctions(app, 'us-central1');

console.log('[Firebase] Initialized production connection to project:', firebaseConfig.projectId, 'Database:', firebaseConfig.firestoreDatabaseId);

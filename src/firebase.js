import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every(Boolean)
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const googleProvider = app ? new GoogleAuthProvider() : null
export { getRedirectResult, onAuthStateChanged, signInWithPopup, signOut, doc, getDoc, setDoc }

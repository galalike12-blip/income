import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Using standard getFirestore with required databaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Enable Firestore multi-tab offline persistence only if not in an iframe (to avoid IndexedDB blocks in sandboxed environments)
const isIframe = typeof window !== 'undefined' && window.self !== window.top;
if (!isIframe) {
  try {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed-precondition (multiple tabs open)');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence unimplemented');
      }
    });
  } catch (e) {
    console.error('Error enabling Firestore persistence:', e);
  }
} else {
  console.log('Skipping Firestore offline persistence inside iframe to prevent shutdown errors.');
}

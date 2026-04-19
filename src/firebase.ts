import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Using standard getFirestore. 
// We are reverting to the most basic setup to isolate the "Permission Denied" issue.
export const db = getFirestore(app);
export const auth = getAuth(app);

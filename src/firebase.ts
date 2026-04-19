import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Standard initialization to ensure core features work first.
// If assertion errors persist, we'll re-add memory cache via initializeFirestore.
export const db = getFirestore(app);
export const auth = getAuth(app);

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { GoogleSheetsService } from '../services/googleSheets';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleAccessToken: string | null;
  spreadsheetId: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setSpreadsheetId: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('googleAccessToken');
    const expiry = localStorage.getItem('googleTokenExpiry');
    if (stored && expiry && Date.now() < parseInt(expiry, 10)) {
      return stored;
    }
    return null;
  });
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user profile from Firestore
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSpreadsheetIdState(docSnap.data().spreadsheetId || null);
        } else {
          // Create user profile
          await setDoc(docRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            createdAt: serverTimestamp()
          });
        }
      } else {
        setSpreadsheetIdState(null);
        setGoogleAccessToken(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('googleAccessToken', credential.accessToken);
        localStorage.setItem('googleTokenExpiry', (Date.now() + 3500 * 1000).toString()); // ~1 hour
        
        // Check if we need to create a spreadsheet
        const docRef = doc(db, 'users', result.user.uid);
        const docSnap = await getDoc(docRef);
        let currentSpreadsheetId = null;
        
        if (docSnap.exists()) {
          currentSpreadsheetId = docSnap.data().spreadsheetId;
        }

        if (!currentSpreadsheetId) {
          try {
            const sheetsService = new GoogleSheetsService(credential.accessToken);
            const newSpreadsheetId = await sheetsService.createSpreadsheet('Income Tracker Data');
            await sheetsService.setupHeaders(newSpreadsheetId, 'Jobs', [
              'ID', 'Date', 'Customer Must Pay', 'Upfront Cost', 'App Net Income', 'Actual Received', 'Tip', 'Total Net Income'
            ]);
            await setDoc(docRef, { spreadsheetId: newSpreadsheetId }, { merge: true });
            setSpreadsheetIdState(newSpreadsheetId);
          } catch (e) {
            console.error("Failed to create spreadsheet automatically", e);
          }
        }
      }
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGoogleAccessToken(null);
    setSpreadsheetIdState(null);
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenExpiry');
  };

  const setSpreadsheetId = async (id: string) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, { spreadsheetId: id }, { merge: true });
    setSpreadsheetIdState(id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleAccessToken, spreadsheetId, loginWithGoogle, logout, setSpreadsheetId }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

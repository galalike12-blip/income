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

import { toast } from 'sonner';

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
        // DIAGNOSTIC: Try writing to debug collection to check if basic connectivity works
        try {
          await setDoc(doc(db, 'debug', 'connectivity_test'), {
            lastCheck: serverTimestamp(),
            clientTime: new Date().toISOString()
          });
          console.log("Firestore Diagnostic: Basic connectivity SUCCESS");
        } catch (e: any) {
          console.error("Firestore Diagnostic: Basic connectivity FAILED", e);
        }

        // Fetch user profile from Firestore with retry logic
        const docRef = doc(db, 'users', currentUser.uid);
        
        const fetchProfile = async (retries = 3, delay = 1000) => {
          try {
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
          } catch (error: any) {
            if (retries > 0 && (error.code === 'permission-denied' || error.message?.includes('insufficient permissions'))) {
              console.log(`Auth retry: ${retries} attempts left...`);
              setTimeout(() => fetchProfile(retries - 1, delay * 1.5), delay);
            } else {
              console.error("Error fetching user profile after retries:", error);
              // Show detailed error for troubleshooting
              const errorMsg = error?.message || "Unknown error";
              const errorCode = error?.code || "no-code";
              toast.error(`Firebase Error [${errorCode}]: ${errorMsg}`);
            }
          }
        };

        fetchProfile();
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
          } catch (e: any) {
            console.warn("Skipped automatic Google Sheets creation (API might be disabled for this new project). You can still use the app normally.", e);
            // Don't show loud error to user to avoid confusion, they can still use the app.
          }
        }
      }
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      
      if (error.code === 'auth/popup-blocked') {
        toast.error('เบราว์เซอร์บล็อก Pop-up กรุณาอนุญาต Pop-up หรือเปิดแอปในแท็บใหม่ (New Tab)');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('โดเมนนี้ยังไม่ได้รับอนุญาต กรุณาเพิ่มโดเมนใน Firebase Console -> Authentication -> Settings -> Authorized domains');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need for a loud error
      } else {
        toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + (error.message || 'Unknown error') + ' แนะนำให้เปิดแอปในแท็บใหม่');
      }
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

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  ensureUserProfile,
  seedStarterTemplatesIfAdmin,
  updateUserProfileDoc,
} from '../services/firestoreService';
import type { UserProfile } from '../types/cv';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfileInfo: (updates: Partial<Pick<UserProfile, 'fullName' | 'defaultTitle' | 'location'>>) => Promise<void>;
  setUserProfileState: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await ensureUserProfile(
        user.uid,
        user.email || '',
        user.displayName || user.email?.split('@')[0] || 'User',
        user.emailVerified
      );
      setUserProfile(profile);
      if (user.emailVerified && (user.email === BOOTSTRAPPED_ADMIN_EMAIL || profile.role === 'admin')) {
        seedStarterTemplatesIfAdmin().catch((err) => console.warn('Template seed skipped:', err));
      }
    } catch (err) {
      console.error('Failed loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      loadProfile(user);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const registerWithEmail = async (fullName: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (fullName.trim()) {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    }
    await sendEmailVerification(cred.user);
    await loadProfile(cred.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const sendResetEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setFirebaseUser(updated);
    if (updated.emailVerified) {
      await loadProfile(updated);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  const updateProfileInfo = async (
    updates: Partial<Pick<UserProfile, 'fullName' | 'defaultTitle' | 'location'>>
  ) => {
    if (!firebaseUser) return;
    if (updates.fullName && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: updates.fullName });
    }
    if (firebaseUser.emailVerified) {
      await updateUserProfileDoc(firebaseUser.uid, updates);
    }
    setUserProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const isVerified = Boolean(firebaseUser?.emailVerified);
  const isAdmin = Boolean(
    isVerified &&
      (firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL || userProfile?.role === 'admin')
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        isAdmin,
        isVerified,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendResetEmail,
        resendVerification,
        refreshVerification,
        logout,
        updateProfileInfo,
        setUserProfileState: setUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

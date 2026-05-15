import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        // Check if profile exists, if not create it
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          const isBasim = authUser.email === 'basim5252@gmail.com';
          const newProfile: UserProfile = {
            uid: authUser.uid,
            displayName: authUser.displayName || 'User',
            email: authUser.email || '',
            photoURL: authUser.photoURL || '',
            role: isBasim ? 'parent' : 'child', // Assign parent role if it's Basim
            points: 0,
            currencyBalance: 0,
            createdAt: serverTimestamp(),
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        } else {
          // Listen for profile changes
          onSnapshot(docRef, (snapshot) => {
            setProfile(snapshot.data() as UserProfile);
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, profile, loading };
}

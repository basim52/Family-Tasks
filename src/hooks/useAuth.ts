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
          const isAdmin = authUser.email === 'basim5252@gmail.com' || authUser.email === 'Hayatalzaki@gmail.com';
          const isMother = authUser.email === 'Hayatalzaki@gmail.com';
          const newProfile: UserProfile = {
            uid: authUser.uid,
            displayName: authUser.displayName || (isMother ? 'الأم' : 'مسؤول النظام'),
            email: authUser.email || '',
            photoURL: authUser.photoURL || '',
            role: isAdmin ? 'parent' : 'child',
            points: 0,
            currencyBalance: 0,
            tokensBalance: 0,
            createdAt: serverTimestamp(),
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        } else {
          const currentProfile = docSnap.data() as UserProfile;
          const isAdmin = authUser.email === 'basim5252@gmail.com' || authUser.email === 'Hayatalzaki@gmail.com';
          
          // Auto-promote if admin but role is still child
          if (isAdmin && currentProfile.role !== 'parent') {
            const isMother = authUser.email === 'Hayatalzaki@gmail.com';
            await setDoc(docRef, { 
              role: 'parent',
              displayName: !currentProfile.displayName || currentProfile.displayName === 'User' ? (isMother ? 'الأم' : 'مسؤول النظام') : currentProfile.displayName
            }, { merge: true });
          }

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

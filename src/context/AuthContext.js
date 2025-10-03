import React, { createContext, useState, useEffect, useContext } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      setCurrentUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        doc => {
          if (doc.exists) {
            setUserData({ id: doc.id, ...doc.data() });
          }
          setLoading(false);
        },
        error => {
          console.error('Error fetching user data:', error);
          setLoading(false);
        }
      );

    return unsubscribe;
  }, [currentUser]);

  async function signup(email, password, additionalData) {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);

    await firestore()
      .collection('users')
      .doc(userCredential.user.uid)
      .set({
        email: email.toLowerCase(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        ...additionalData,
      });

    return userCredential;
  }

  async function login(email, password) {
    return auth().signInWithEmailAndPassword(email, password);
  }

  async function logout() {
    return auth().signOut();
  }

  async function resetPassword(email) {
    return auth().sendPasswordResetEmail(email);
  }

  async function updateUserProfile(updates) {
    if (!currentUser) return;

    await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .update(updates);
  }

  const value = {
    currentUser,
    userData,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

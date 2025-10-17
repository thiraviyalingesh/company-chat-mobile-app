/**
 * AuthContext - Rebuilt to match web app architecture
 * Supports: Phone OTP, Email/Password, SuperAdmin, Multi-Project, User Roles
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { getUserProjects, isSuperAdmin } from '../utils/roleHelper';
import { verifyOTP } from '../utils/otpGenerator';

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [userProjects, setUserProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * SuperAdmin Login (Email + Password)
   * Phone: +1111111111 → Email: 1111111111@temp.com
   */
  async function loginSuperAdmin(phoneNumber, password) {
    try {
      // Convert phone to email (remove + sign)
      const cleanPhone = phoneNumber.replace('+', '');
      const email = `${cleanPhone}@temp.com`;

      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password
      );

      // Verify this is actually SuperAdmin
      const userDoc = await firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .get();

      if (!userDoc.exists || userDoc.data().globalRole !== 'superadmin') {
        await auth().signOut();
        throw new Error('Invalid SuperAdmin credentials');
      }

      return userCredential;
    } catch (error) {
      console.error('SuperAdmin login error:', error);
      throw error;
    }
  }

  /**
   * User/Project Admin Login (Phone + OTP)
   */
  async function loginWithPhoneOTP(phoneNumber, otp) {
    try {
      // Find user by phone number
      const usersSnapshot = await firestore()
        .collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .get();

      if (usersSnapshot.empty) {
        throw new Error('No user found with this phone number');
      }

      const userDoc = usersSnapshot.docs[0];
      const userDataFromDb = userDoc.data();

      // Verify OTP
      const otpResult = verifyOTP(
        otp,
        userDataFromDb.currentOTP,
        userDataFromDb.otpExpiresAt
      );

      if (!otpResult.valid) {
        throw new Error(otpResult.message);
      }

      // Check if user is blocked
      if (userDataFromDb.isBlocked) {
        throw new Error('Your account has been blocked by an administrator');
      }

      // Clear the OTP after successful login
      await firestore()
        .collection('users')
        .doc(userDoc.id)
        .update({
          currentOTP: null,
          otpExpiresAt: null,
          lastActive: firestore.FieldValue.serverTimestamp(),
        });

      // Sign in anonymously first (workaround for custom auth)
      await auth().signInAnonymously();

      // Link this anonymous account to the user document
      const currentUid = auth().currentUser.uid;
      await firestore()
        .collection('users')
        .doc(userDoc.id)
        .update({
          firebaseAuthUid: currentUid,
        });

      return {
        user: { uid: userDoc.id, phoneNumber: userDataFromDb.phoneNumber },
        userData: userDataFromDb,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Generic login function
   */
  async function login(identifier, credential, loginType = 'phone') {
    if (loginType === 'superadmin') {
      return await loginSuperAdmin(identifier, credential);
    } else if (loginType === 'phone') {
      return await loginWithPhoneOTP(identifier, credential);
    } else {
      throw new Error('Invalid login type');
    }
  }

  /**
   * Logout
   */
  async function logout() {
    try {
      // Update online status
      if (currentUser) {
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .update({
            isOnline: false,
            lastSeen: firestore.FieldValue.serverTimestamp(),
          });
      }

      await auth().signOut();
      setCurrentUser(null);
      setUserData(null);
      setUserProjects([]);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Update online status
   */
  const updateOnlineStatus = async (userId, isOnline) => {
    if (!userId) return;

    try {
      await firestore().collection('users').doc(userId).update({
        isOnline: isOnline,
        lastSeen: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.warn('Could not update online status:', error.message);
    }
  };

  /**
   * Monitor auth state changes
   */
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async user => {
      try {
        if (user) {
          setCurrentUser(user);

          // Fetch user document with error handling
          let userDoc;
          try {
            userDoc = await firestore()
              .collection('users')
              .doc(user.uid)
              .get();
          } catch (fetchError) {
            console.error('Error fetching user document:', fetchError);
            // If permission denied, user might not have document yet
            setLoading(false);
            return;
          }

          // If not found by UID, search by phone (for phone auth)
          if (!userDoc.exists && user.phoneNumber) {
            console.log('Searching for user by phone:', user.phoneNumber);

            let usersSnapshot;
            try {
              usersSnapshot = await firestore()
                .collection('users')
                .where('phoneNumber', '==', user.phoneNumber)
                .get();
            } catch (searchError) {
              console.error('Error searching users by phone:', searchError);
              setLoading(false);
              return;
            }

            if (!usersSnapshot.empty) {
              userDoc = usersSnapshot.docs[0];

              // Create a document with the correct UID
              await firestore()
                .collection('users')
                .doc(user.uid)
                .set({
                  ...userDoc.data(),
                  firebaseAuthUid: user.uid,
                  lastActive: firestore.FieldValue.serverTimestamp(),
                });

              // Re-fetch
              userDoc = await firestore()
                .collection('users')
                .doc(user.uid)
                .get();
            }
          }

          if (userDoc && userDoc.exists) {
            const data = userDoc.data();
            setUserData(data);

            // Fetch user's projects (skip for SuperAdmin)
            if (!isSuperAdmin(data)) {
              try {
                const projects = await getUserProjects(user.uid);
                setUserProjects(projects);
              } catch (projectsError) {
                console.error('Error fetching user projects:', projectsError);
                setUserProjects([]);
              }
            } else {
              setUserProjects([]);
            }

            // Set user as online
            await updateOnlineStatus(user.uid, true);

            // Update online status every 5 minutes
            const interval = setInterval(() => {
              updateOnlineStatus(user.uid, true);
            }, 5 * 60 * 1000);

            return () => {
              clearInterval(interval);
              updateOnlineStatus(user.uid, false);
            };
          }
        } else {
          setCurrentUser(null);
          setUserData(null);
          setUserProjects([]);
        }
      } catch (error) {
        console.error('Error in onAuthStateChanged:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    userProjects,
    isSuperAdmin: isSuperAdmin(userData),
    isProjectAdmin: (projectId) => {
      if (!userData || !projectId) return false;
      if (isSuperAdmin(userData)) return true;
      const project = userProjects.find(p => p.id === projectId);
      return project && project.userRole === 'project_admin';
    },
    login,
    loginSuperAdmin,
    loginWithPhoneOTP,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

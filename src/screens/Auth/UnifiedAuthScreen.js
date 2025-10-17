/**
 * UnifiedAuth Screen - Matches web app's UnifiedAuth.js
 * 3 Tabs: Signup, Login, SuperAdmin
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { formatPhoneNumber, isValidPhoneNumber } from '../../utils/otpGenerator';

export default function UnifiedAuthScreen({ navigation }) {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'signup', 'login', 'superadmin'

  // Signup state
  const [signupStep, setSignupStep] = useState(1); // 1=name, 2=phone, 3=OTP (future)
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  // Login state
  const [loginStep, setLoginStep] = useState(1); // 1=phone, 2=OTP
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginConfirmation, setLoginConfirmation] = useState(null); // Firebase Phone Auth confirmation

  // SuperAdmin state
  const [superadminPhone, setSuperadminPhone] = useState('');
  const [superadminPassword, setSuperadminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // SuperAdmin credentials
  const SUPERADMIN_PHONE = '+1111111111';

  // Reset error when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  // ============ SIGNUP HANDLERS ============
  const handleSignupNameSubmit = () => {
    setError('');

    if (!signupName.trim()) {
      setError('Please enter your name');
      return;
    }

    setSignupStep(2);
  };

  const handleSignupSendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(signupPhone);

      if (!isValidPhoneNumber(formattedPhone)) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }

      // TODO: Implement signup via Cloud Functions
      // For now, direct users to use web app for signup
      Alert.alert(
        'Use Web App for Signup',
        'Please sign up using the web app. After approval, you can login here using your phone number and OTP.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error checking invitation:', error);
      setError('Failed to send OTP. Please try again.');
    }

    setLoading(false);
  };

  // ============ LOGIN HANDLERS ============
  const handleLoginSendOTP = async () => {
    setError('');
    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(loginPhone);

      if (!isValidPhoneNumber(formattedPhone)) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }

      // Check if user exists in Firestore (read-only, allowed by rules)
      const usersSnapshot = await firestore()
        .collection('users')
        .where('phoneNumber', '==', formattedPhone)
        .get();

      if (usersSnapshot.empty) {
        setError('No account found with this phone number. Please contact your administrator.');
        setLoading(false);
        return;
      }

      // Send OTP via Firebase Phone Authentication (real SMS)
      console.log('Sending OTP via Firebase Phone Auth to:', formattedPhone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);

      setLoginConfirmation(confirmation);
      setLoginStep(2);

      Alert.alert(
        'OTP Sent',
        `Verification code sent to ${formattedPhone}`,
        [{ text: 'OK' }]
      );

      console.log('✅ OTP sent successfully via Firebase Phone Auth');

    } catch (error) {
      console.error('Send OTP error:', error);

      if (error.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Please include country code (e.g., +1 or +91)');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError(error.message || 'Failed to send OTP. Please try again.');
      }
    }

    setLoading(false);
  };

  const handleLoginVerifyOTP = async () => {
    setError('');
    setLoading(true);

    try {
      if (!loginOtp.trim() || loginOtp.length !== 6) {
        setError('Please enter a valid 6-digit OTP');
        setLoading(false);
        return;
      }

      console.log('Verifying OTP with Firebase...');

      // Verify OTP using Firebase Phone Auth confirmation
      await loginConfirmation.confirm(loginOtp);

      console.log('✅ OTP verified successfully, user authenticated via Firebase Phone Auth');

      // Navigation will happen automatically via AuthContext (onAuthStateChanged listener)

    } catch (error) {
      console.error('Login error:', error);

      if (error.code === 'auth/invalid-verification-code') {
        setError('Invalid OTP. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        setError('OTP expired. Please request a new one.');
        setLoginStep(1);
      } else {
        setError(error.message || 'Login failed. Please try again.');
      }
    }

    setLoading(false);
  };

  const handleLoginResendOTP = () => {
    setLoginOtp('');
    setLoginConfirmation(null);
    setError('');
    setLoginStep(1);
  };

  // ============ SUPERADMIN HANDLERS ============
  const handleSuperAdminLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(superadminPhone);

      if (formattedPhone !== SUPERADMIN_PHONE) {
        setError('Invalid SuperAdmin phone number');
        setLoading(false);
        return;
      }

      if (superadminPassword !== 'superadmin123') {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      // Login as SuperAdmin
      await login(formattedPhone, superadminPassword, 'superadmin');

      // Navigation will happen automatically via AuthContext

    } catch (error) {
      console.error('SuperAdmin login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>TrunkTalk</Text>
            <Text style={styles.subtitle}>Welcome!</Text>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'signup' && styles.activeTab]}
              onPress={() => handleTabChange('signup')}
            >
              <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>
                Signup
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'login' && styles.activeTab]}
              onPress={() => handleTabChange('login')}
            >
              <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'superadmin' && styles.activeTab]}
              onPress={() => handleTabChange('superadmin')}
            >
              <Text style={[styles.tabText, activeTab === 'superadmin' && styles.activeTabText]}>
                SuperAdmin
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* ============ SIGNUP TAB ============ */}
          {activeTab === 'signup' && (
            <View style={styles.formContainer}>
              {signupStep === 1 && (
                <>
                  <Text style={styles.label}>Your Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                    value={signupName}
                    onChangeText={setSignupName}
                    autoFocus
                  />

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSignupNameSubmit}
                    disabled={loading}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </TouchableOpacity>
                </>
              )}

              {signupStep === 2 && (
                <>
                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 234 567 8900 or +91 98765 43210"
                    placeholderTextColor="#999"
                    value={signupPhone}
                    onChangeText={setSignupPhone}
                    keyboardType="phone-pad"
                    autoFocus
                    editable={!loading}
                  />
                  <Text style={styles.hint}>Include country code (e.g., +1 for USA, +91 for India)</Text>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.disabledButton]}
                    onPress={handleSignupSendOTP}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send OTP</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setSignupStep(1)}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ============ LOGIN TAB ============ */}
          {activeTab === 'login' && (
            <View style={styles.formContainer}>
              {loginStep === 1 && (
                <>
                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+1 234 567 8900 or +91 98765 43210"
                    placeholderTextColor="#999"
                    value={loginPhone}
                    onChangeText={setLoginPhone}
                    keyboardType="phone-pad"
                    autoFocus
                    editable={!loading}
                  />
                  <Text style={styles.hint}>Include country code (e.g., +1 for USA, +91 for India)</Text>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.disabledButton]}
                    onPress={handleLoginSendOTP}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send OTP</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {loginStep === 2 && (
                <>
                  <Text style={styles.label}>Enter OTP *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor="#999"
                    value={loginOtp}
                    onChangeText={setLoginOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    editable={!loading}
                  />
                  <Text style={styles.hint}>OTP sent to {loginPhone}</Text>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.disabledButton]}
                    onPress={handleLoginVerifyOTP}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify & Login</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleLoginResendOTP}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>Resend OTP</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ============ SUPERADMIN TAB ============ */}
          {activeTab === 'superadmin' && (
            <View style={styles.formContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="+1111111111"
                placeholderTextColor="#999"
                value={superadminPhone}
                onChangeText={setSuperadminPhone}
                keyboardType="phone-pad"
                autoFocus
                editable={!loading}
              />
              <Text style={styles.hint}>SuperAdmin phone: +1111111111</Text>

              <Text style={[styles.label, { marginTop: 20 }]}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={superadminPassword}
                onChangeText={setSuperadminPassword}
                secureTextEntry
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={handleSuperAdminLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Login as SuperAdmin</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  formContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

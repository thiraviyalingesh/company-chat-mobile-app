/**
 * App.tsx - Navigation Flow
 *
 * SuperAdmin (DUALITY - Admin First):
 * - Login → SuperAdminDashboard (stats/management)
 * - Has "Chat" button → SuperAdminChatScreen
 *
 * Project Admin & Regular User (Chat First):
 * - Login → DashboardScreen (Chat UI)
 * - Project Admin: Has "Dashboard" button → ProjectAdminDashboard
 * - Regular User: Only Chat UI, no Dashboard button
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import UnifiedAuthScreen from './src/screens/Auth/UnifiedAuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SuperAdminDashboard from './src/screens/SuperAdmin/SuperAdminDashboard';
import SuperAdminChatScreen from './src/screens/SuperAdmin/SuperAdminChatScreen';
import ProjectAdminDashboard from './src/screens/ProjectAdmin/ProjectAdminDashboard';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { currentUser, userData, isSuperAdmin } = useAuth();

  if (currentUser === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {currentUser && userData ? (
          <>
            {isSuperAdmin ? (
              <>
                {/* SuperAdmin: Dashboard → Chat (via button) */}
                <Stack.Screen name="SuperAdmin" component={SuperAdminDashboard} />
                <Stack.Screen name="SuperAdminChat" component={SuperAdminChatScreen} />
              </>
            ) : (
              <>
                {/* Project Admin & Regular User: Chat UI → Dashboard (conditional button) */}
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="ProjectAdmin" component={ProjectAdminDashboard} />
              </>
            )}
          </>
        ) : (
          <>
            {/* Not logged in - show UnifiedAuth */}
            <Stack.Screen name="Auth" component={UnifiedAuthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

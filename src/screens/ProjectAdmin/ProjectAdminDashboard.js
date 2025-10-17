/**
 * Project Admin Dashboard
 * Project Admins can manage their assigned projects
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';
import ProjectManagementScreen from '../SuperAdmin/ProjectManagementScreen';

export default function ProjectAdminDashboard({ navigation }) {
  const { logout, userData, userProjects } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Stats for all admin projects combined
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalChannels, setTotalChannels] = useState(0);

  // Only projects where user is project_admin
  const adminProjects = userProjects ? userProjects.filter(p => p.userRole === 'project_admin') : [];

  useEffect(() => {
    if (userProjects && userProjects.length > 0) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [userProjects]);

  const loadStats = async () => {
    try {
      setLoading(true);

      if (adminProjects.length === 0) {
        setLoading(false);
        return;
      }

      let usersCount = 0;
      let groupsCount = 0;
      let channelsCount = 0;

      for (const project of adminProjects) {
        // Count users in this project
        const userProjectsSnapshot = await firestore()
          .collection('userProjects')
          .where('projectId', '==', project.id)
          .where('isActive', '==', true)
          .get();

        usersCount += userProjectsSnapshot.size;

        // Count groups
        const groupsSnapshot = await firestore()
          .collection('groups')
          .where('projectId', '==', project.id)
          .where('isChannel', '==', false)
          .get();

        groupsCount += groupsSnapshot.size;

        // Count channels
        const channelsSnapshot = await firestore()
          .collection('groups')
          .where('projectId', '==', project.id)
          .where('isChannel', '==', true)
          .get();

        channelsCount += channelsSnapshot.size;
      }

      setTotalUsers(usersCount);
      setTotalGroups(groupsCount);
      setTotalChannels(channelsCount);

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Dashboard')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Chat</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Project Admin</Text>
          <Text style={styles.headerSubtitle}>Welcome, {userData?.name || 'Admin'}!</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {adminProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No Admin Projects</Text>
            <Text style={styles.emptyText}>
              You are not a Project Admin for any projects yet.
            </Text>
            <Text style={styles.emptySubtext}>
              Contact a SuperAdmin to be promoted to Project Admin.
            </Text>
          </View>
        ) : (
          <>
            {/* Stats Overview */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, styles.statCardBlue]}>
                  <Text style={styles.statNumber}>{adminProjects.length}</Text>
                  <Text style={styles.statLabel}>Projects</Text>
                </View>

                <View style={[styles.statCard, styles.statCardGreen]}>
                  <Text style={styles.statNumber}>{totalUsers}</Text>
                  <Text style={styles.statLabel}>Total Users</Text>
                </View>

                <View style={[styles.statCard, styles.statCardOrange]}>
                  <Text style={styles.statNumber}>{totalGroups}</Text>
                  <Text style={styles.statLabel}>Groups</Text>
                </View>

                <View style={[styles.statCard, styles.statCardPurple]}>
                  <Text style={styles.statNumber}>{totalChannels}</Text>
                  <Text style={styles.statLabel}>Channels</Text>
                </View>
              </View>
            </View>

            {/* Projects List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Projects</Text>
              {adminProjects
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(project => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.projectCard}
                    onPress={() => setSelectedProject(project)}
                  >
                    <View style={styles.projectIcon}>
                      <Text style={styles.projectIconText}>📁</Text>
                    </View>
                    <View style={styles.projectInfo}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectRole}>Project Admin</Text>
                    </View>
                    <Text style={styles.projectArrow}>→</Text>
                  </TouchableOpacity>
                ))}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => Alert.alert('Coming Soon', 'User management will be available soon')}
              >
                <Text style={styles.actionIcon}>👥</Text>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Manage Users</Text>
                  <Text style={styles.actionDescription}>
                    Add, remove, or promote users in your projects
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => Alert.alert('Coming Soon', 'Group management will be available soon')}
              >
                <Text style={styles.actionIcon}>💬</Text>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Manage Groups</Text>
                  <Text style={styles.actionDescription}>
                    Create and manage groups in your projects
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => Alert.alert('Coming Soon', 'Channel management will be available soon')}
              >
                <Text style={styles.actionIcon}>📢</Text>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Manage Channels</Text>
                  <Text style={styles.actionDescription}>
                    Create announcements and broadcast channels
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Project Management Screen (reusing SuperAdmin's screen) */}
      <ProjectManagementScreen
        visible={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        project={selectedProject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
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
  header: {
    backgroundColor: '#FF9500',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  statsSection: {
    padding: 15,
    paddingTop: 20,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  statCard: {
    width: '48%',
    margin: '1%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardBlue: {
    backgroundColor: '#007AFF',
  },
  statCardGreen: {
    backgroundColor: '#34C759',
  },
  statCardOrange: {
    backgroundColor: '#FF9500',
  },
  statCardPurple: {
    backgroundColor: '#AF52DE',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  projectIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  projectIconText: {
    fontSize: 24,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  projectRole: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
  },
  projectArrow: {
    fontSize: 20,
    color: '#007AFF',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666',
  },
});

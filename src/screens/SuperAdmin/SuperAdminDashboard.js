/**
 * SuperAdmin Dashboard
 * Full-featured dashboard matching web app
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
import CreateProjectModal from './CreateProjectModal';
import PendingApprovalsScreen from './PendingApprovalsScreen';
import ProjectManagementScreen from './ProjectManagementScreen';

export default function SuperAdminDashboard({ navigation }) {
  const { logout, userData, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, projects
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showPendingApprovals, setShowPendingApprovals] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Stats
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProjectAdmins, setTotalProjectAdmins] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Data
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Listen to pending approvals
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('qrInvitations')
      .where('isPending', '==', true)
      .onSnapshot(
        snapshot => {
          setPendingApprovals(snapshot.size);
        },
        error => {
          console.error('Error listening to pending approvals:', error);
        }
      );

    return unsubscribe;
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all projects
      const projectsSnapshot = await firestore()
        .collection('projects')
        .where('isActive', '==', true)
        .get();

      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProjects(projectsData);
      setTotalProjects(projectsData.length);

      // Get recent projects (last 5)
      const recent = [...projectsData]
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        })
        .slice(0, 5);
      setRecentProjects(recent);

      // Fetch all users (exclude superadmins)
      const usersSnapshot = await firestore()
        .collection('users')
        .where('globalRole', '!=', 'superadmin')
        .get();

      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUsers(usersData);
      setTotalUsers(usersData.length);

      // Count project admins
      const userProjectsSnapshot = await firestore()
        .collection('userProjects')
        .where('role', '==', 'project_admin')
        .where('isActive', '==', true)
        .get();

      // Get unique project admin users
      const uniqueAdmins = new Set(userProjectsSnapshot.docs.map(doc => doc.data().userId));
      setTotalProjectAdmins(uniqueAdmins.size);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
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

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statNumber}>{totalProjects}</Text>
          <Text style={styles.statLabel}>Total Projects</Text>
        </View>

        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statNumber}>{totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>

        <View style={[styles.statCard, styles.statCardOrange]}>
          <Text style={styles.statNumber}>{totalProjectAdmins}</Text>
          <Text style={styles.statLabel}>Project Admins</Text>
        </View>

        <View style={[styles.statCard, styles.statCardRed]}>
          <Text style={styles.statNumber}>{pendingApprovals}</Text>
          <Text style={styles.statLabel}>Pending Approvals</Text>
        </View>
      </View>

      {/* Recent Projects */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Projects</Text>
        {recentProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No projects yet</Text>
          </View>
        ) : (
          recentProjects.map(project => (
            <View key={project.id} style={styles.listItem}>
              <View style={styles.listItemIcon}>
                <Text style={styles.listItemIconText}>📁</Text>
              </View>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{project.name}</Text>
                <Text style={styles.listItemSubtitle}>
                  Created {formatDate(project.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* System Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>System</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Database</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Connected</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Pending Approvals Banner */}
      {pendingApprovals > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => setShowPendingApprovals(true)}
        >
          <Text style={styles.pendingBannerIcon}>⚠️</Text>
          <View style={styles.pendingBannerContent}>
            <Text style={styles.pendingBannerTitle}>
              {pendingApprovals} Pending Approval{pendingApprovals > 1 ? 's' : ''}
            </Text>
            <Text style={styles.pendingBannerText}>Tap to review QR code signups</Text>
          </View>
          <Text style={styles.pendingBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Users List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Users ({totalUsers})</Text>
        </View>

        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users yet</Text>
          </View>
        ) : (
          users
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(user => (
              <View key={user.id} style={styles.listItem}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{user.name || 'Unnamed User'}</Text>
                  <Text style={styles.listItemSubtitle}>{user.phoneNumber || 'No phone'}</Text>
                </View>
                <View style={styles.userStatus}>
                  {user.isBlocked ? (
                    <Text style={styles.userStatusBlocked}>Blocked</Text>
                  ) : (
                    <Text style={styles.userStatusActive}>Active</Text>
                  )}
                </View>
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );

  const renderProjects = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Create Project Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateProject(true)}
      >
        <Text style={styles.createButtonText}>+ Create New Project</Text>
      </TouchableOpacity>

      {/* Projects List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Projects ({totalProjects})</Text>

        {projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No projects yet</Text>
            <Text style={styles.emptySubtext}>Create your first project to get started</Text>
          </View>
        ) : (
          projects
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(project => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => setSelectedProject(project)}
              >
                <View style={styles.projectCardIcon}>
                  <Text style={styles.projectCardIconText}>📁</Text>
                </View>
                <View style={styles.projectCardContent}>
                  <Text style={styles.projectCardTitle}>{project.name}</Text>
                  <Text style={styles.projectCardDate}>
                    Created {formatDate(project.createdAt)}
                  </Text>
                </View>
                <Text style={styles.projectCardArrow}>→</Text>
              </TouchableOpacity>
            ))
        )}
      </View>
    </ScrollView>
  );

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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>SuperAdmin</Text>
          <Text style={styles.headerSubtitle}>Welcome, {userData?.name || 'Admin'}!</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SuperAdminChat')}
            style={styles.chatButton}
          >
            <Text style={styles.chatButtonText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Users
            {pendingApprovals > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingApprovals}</Text>
              </View>
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'projects' && styles.tabActive]}
          onPress={() => setActiveTab('projects')}
        >
          <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>
            Projects
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'projects' && renderProjects()}

      {/* Create Project Modal */}
      <CreateProjectModal
        visible={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSuccess={loadDashboardData}
      />

      {/* Pending Approvals Screen */}
      <PendingApprovalsScreen
        visible={showPendingApprovals}
        onClose={() => setShowPendingApprovals(false)}
      />

      {/* Project Management Screen */}
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
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
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
  chatButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 20,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
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
  statCardRed: {
    backgroundColor: '#FF3B30',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  listItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemIconText: {
    fontSize: 20,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  listItemSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userStatus: {
    marginLeft: 10,
  },
  userStatusActive: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
  },
  userStatusBlocked: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  projectCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  projectCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  projectCardIconText: {
    fontSize: 24,
  },
  projectCardContent: {
    flex: 1,
  },
  projectCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  projectCardDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  projectCardArrow: {
    fontSize: 20,
    color: '#007AFF',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    backgroundColor: '#007AFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingBanner: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    margin: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  pendingBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pendingBannerContent: {
    flex: 1,
  },
  pendingBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#856404',
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#856404',
    marginTop: 2,
  },
  pendingBannerArrow: {
    fontSize: 20,
    color: '#856404',
  },
});

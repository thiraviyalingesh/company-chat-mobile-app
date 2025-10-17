/**
 * Project Management Screen
 * SuperAdmin can view and manage project details, users, groups, channels
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
  Modal,
  TextInput,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function ProjectManagementScreen({ visible, onClose, project }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // overview, people, groups, channels
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Project stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [projectAdmins, setProjectAdmins] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalChannels, setTotalChannels] = useState(0);

  // Data
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [channels, setChannels] = useState([]);

  // Add users modal
  const [showAddUsers, setShowAddUsers] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingUsers, setAddingUsers] = useState(false);

  useEffect(() => {
    if (visible && project) {
      loadProjectData();
    }
  }, [visible, project]);

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // Fetch users in this project
      const userProjectsSnapshot = await firestore()
        .collection('userProjects')
        .where('projectId', '==', project.id)
        .where('isActive', '==', true)
        .get();

      const userIds = userProjectsSnapshot.docs.map(doc => doc.data().userId);
      const usersData = [];
      let adminCount = 0;

      for (const userProjectDoc of userProjectsSnapshot.docs) {
        const userProjectData = userProjectDoc.data();

        // Fetch user details
        const userDoc = await firestore()
          .collection('users')
          .doc(userProjectData.userId)
          .get();

        if (userDoc.exists) {
          usersData.push({
            id: userDoc.id,
            ...userDoc.data(),
            projectRole: userProjectData.role,
          });

          if (userProjectData.role === 'project_admin') {
            adminCount++;
          }
        }
      }

      setUsers(usersData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setTotalUsers(usersData.length);
      setProjectAdmins(adminCount);

      // Fetch groups (not channels)
      const groupsSnapshot = await firestore()
        .collection('groups')
        .where('projectId', '==', project.id)
        .where('isChannel', '==', false)
        .get();

      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setGroups(groupsData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setTotalGroups(groupsData.length);

      // Fetch channels
      const channelsSnapshot = await firestore()
        .collection('groups')
        .where('projectId', '==', project.id)
        .where('isChannel', '==', true)
        .get();

      const channelsData = channelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setChannels(channelsData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setTotalChannels(channelsData.length);

    } catch (error) {
      console.error('Error loading project data:', error);
      Alert.alert('Error', 'Failed to load project data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProjectData();
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePromoteUser = async (user) => {
    Alert.alert(
      'Promote to Project Admin',
      `Promote ${user.name} to Project Admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              // Find userProjects document
              const snapshot = await firestore()
                .collection('userProjects')
                .where('userId', '==', user.id)
                .where('projectId', '==', project.id)
                .get();

              if (!snapshot.empty) {
                await snapshot.docs[0].ref.update({
                  role: 'project_admin',
                });
                Alert.alert('Success', `${user.name} is now a Project Admin`);
                loadProjectData();
              }
            } catch (error) {
              console.error('Error promoting user:', error);
              Alert.alert('Error', 'Failed to promote user');
            }
          },
        },
      ]
    );
  };

  const handleDemoteUser = async (user) => {
    Alert.alert(
      'Demote to Regular User',
      `Demote ${user.name} to Regular User?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          onPress: async () => {
            try {
              // Find userProjects document
              const snapshot = await firestore()
                .collection('userProjects')
                .where('userId', '==', user.id)
                .where('projectId', '==', project.id)
                .get();

              if (!snapshot.empty) {
                await snapshot.docs[0].ref.update({
                  role: 'user',
                });
                Alert.alert('Success', `${user.name} is now a Regular User`);
                loadProjectData();
              }
            } catch (error) {
              console.error('Error demoting user:', error);
              Alert.alert('Error', 'Failed to demote user');
            }
          },
        },
      ]
    );
  };

  const handleRemoveUser = async (user) => {
    Alert.alert(
      'Remove User',
      `Remove ${user.name} from this project?\n\nThey will lose access to all groups and channels in this project.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find and deactivate userProjects document
              const snapshot = await firestore()
                .collection('userProjects')
                .where('userId', '==', user.id)
                .where('projectId', '==', project.id)
                .get();

              if (!snapshot.empty) {
                await snapshot.docs[0].ref.update({
                  isActive: false,
                });
                Alert.alert('Success', `${user.name} removed from project`);
                loadProjectData();
              }
            } catch (error) {
              console.error('Error removing user:', error);
              Alert.alert('Error', 'Failed to remove user');
            }
          },
        },
      ]
    );
  };

  const fetchAllUsers = async () => {
    try {
      // Fetch all users (exclude superadmins)
      const usersSnapshot = await firestore()
        .collection('users')
        .where('isActive', '==', true)
        .get();

      const allUsersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter out users already in project and superadmins
      const projectUserIds = users.map(u => u.id);
      const availableUsers = allUsersData.filter(
        u => !projectUserIds.includes(u.id) && u.globalRole !== 'superadmin'
      );

      setAllUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching all users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const handleAddUsersToProject = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    setAddingUsers(true);

    try {
      let addedCount = 0;

      // Find General channel
      const generalChannelSnapshot = await firestore()
        .collection('groups')
        .where('projectId', '==', project.id)
        .where('isGeneralChannel', '==', true)
        .get();

      const generalChannel = !generalChannelSnapshot.empty
        ? generalChannelSnapshot.docs[0]
        : null;

      for (const userId of selectedUsers) {
        // Check if already exists
        const existingCheck = await firestore()
          .collection('userProjects')
          .where('userId', '==', userId)
          .where('projectId', '==', project.id)
          .get();

        if (!existingCheck.empty) {
          continue;
        }

        // Add to userProjects
        await firestore().collection('userProjects').add({
          userId: userId,
          projectId: project.id,
          role: 'user',
          addedAt: firestore.FieldValue.serverTimestamp(),
          isActive: true,
          addedBy: currentUser.uid,
        });

        // Add to General channel
        if (generalChannel) {
          const currentMembers = generalChannel.data().members || [];
          if (!currentMembers.includes(userId)) {
            await firestore()
              .collection('groups')
              .doc(generalChannel.id)
              .update({
                members: [...currentMembers, userId],
              });
          }
        }

        addedCount++;
      }

      Alert.alert(
        'Success',
        `Added ${addedCount} user(s) to ${project.name}`
      );

      setShowAddUsers(false);
      setSelectedUsers([]);
      setSearchQuery('');
      loadProjectData(); // Reload data
    } catch (error) {
      console.error('Error adding users:', error);
      Alert.alert('Error', 'Failed to add users to project');
    } finally {
      setAddingUsers(false);
    }
  };

  const toggleUserSelection = userId => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statNumber}>{totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>

        <View style={[styles.statCard, styles.statCardOrange]}>
          <Text style={styles.statNumber}>{projectAdmins}</Text>
          <Text style={styles.statLabel}>Project Admins</Text>
        </View>

        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statNumber}>{totalGroups}</Text>
          <Text style={styles.statLabel}>Groups</Text>
        </View>

        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statNumber}>{totalChannels}</Text>
          <Text style={styles.statLabel}>Channels</Text>
        </View>
      </View>

      {/* Project Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Project Name</Text>
            <Text style={styles.infoValue}>{project.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{formatDate(project.createdAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Members</Text>
            <Text style={styles.infoValue}>{totalUsers}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderPeople = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Add Users Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          fetchAllUsers();
          setShowAddUsers(true);
        }}
      >
        <Text style={styles.addButtonText}>+ Add Users to Project</Text>
      </TouchableOpacity>

      {/* Project Admins */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Admins ({projectAdmins})</Text>
        {users.filter(u => u.projectRole === 'project_admin').length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No project admins</Text>
          </View>
        ) : (
          users
            .filter(u => u.projectRole === 'project_admin')
            .map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name || 'Unnamed'}</Text>
                  <Text style={styles.userPhone}>{user.phoneNumber || 'No phone'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.actionButtonSmall}
                  onPress={() => handleDemoteUser(user)}
                >
                  <Text style={styles.actionButtonSmallText}>Demote</Text>
                </TouchableOpacity>
              </View>
            ))
        )}
      </View>

      {/* Regular Users */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Regular Users ({totalUsers - projectAdmins})</Text>
        {users.filter(u => u.projectRole === 'user').length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No regular users</Text>
          </View>
        ) : (
          users
            .filter(u => u.projectRole === 'user')
            .map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name || 'Unnamed'}</Text>
                  <Text style={styles.userPhone}>{user.phoneNumber || 'No phone'}</Text>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.actionButtonPromote]}
                    onPress={() => handlePromoteUser(user)}
                  >
                    <Text style={styles.actionButtonSmallText}>Promote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.actionButtonRemove]}
                    onPress={() => handleRemoveUser(user)}
                  >
                    <Text style={styles.actionButtonSmallText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );

  const renderGroups = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Groups ({totalGroups})</Text>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No groups yet</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupIcon}>
                <Text style={styles.groupIconText}>💬</Text>
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMembers}>
                  {group.members?.length || 0} members
                  {group.requiresApproval && ' • Requires Approval'}
                </Text>
                {group.description && (
                  <Text style={styles.groupDescription} numberOfLines={1}>
                    {group.description}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderChannels = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Channels ({totalChannels})</Text>
        {channels.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No channels yet</Text>
          </View>
        ) : (
          channels.map(channel => (
            <View key={channel.id} style={styles.groupCard}>
              <View style={styles.groupIcon}>
                <Text style={styles.groupIconText}>📢</Text>
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{channel.name}</Text>
                <Text style={styles.groupMembers}>
                  {channel.members?.length || 0} members • Read-only
                </Text>
                {channel.description && (
                  <Text style={styles.groupDescription} numberOfLines={1}>
                    {channel.description}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  if (!project) return null;

  if (loading) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading project...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{project.name}</Text>
            <Text style={styles.headerSubtitle}>Project Management</Text>
          </View>
          <View style={styles.placeholder} />
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
            style={[styles.tab, activeTab === 'people' && styles.tabActive]}
            onPress={() => setActiveTab('people')}
          >
            <Text style={[styles.tabText, activeTab === 'people' && styles.tabTextActive]}>
              People
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
              Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'channels' && styles.tabActive]}
            onPress={() => setActiveTab('channels')}
          >
            <Text style={[styles.tabText, activeTab === 'channels' && styles.tabTextActive]}>
              Channels
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'people' && renderPeople()}
        {activeTab === 'groups' && renderGroups()}
        {activeTab === 'channels' && renderChannels()}
      </View>

      {/* Add Users Modal */}
      <Modal visible={showAddUsers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Users to {project.name}</Text>
              <TouchableOpacity onPress={() => setShowAddUsers(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />

            <ScrollView style={styles.usersList}>
              {allUsers
                .filter(
                  user =>
                    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.phoneNumber?.includes(searchQuery)
                )
                .length === 0 ? (
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No users found' : 'All users already in project'}
                </Text>
              ) : (
                allUsers
                  .filter(
                    user =>
                      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.phoneNumber?.includes(searchQuery)
                  )
                  .map(user => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.userSelectItem,
                        selectedUsers.includes(user.id) && styles.userSelectItemSelected,
                      ]}
                      onPress={() => toggleUserSelection(user.id)}
                    >
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name || 'Unknown'}</Text>
                        <Text style={styles.userPhone}>{user.phoneNumber || 'No phone'}</Text>
                      </View>
                      {selectedUsers.includes(user.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddUsers(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  selectedUsers.length === 0 && styles.confirmButtonDisabled,
                ]}
                onPress={handleAddUsersToProject}
                disabled={selectedUsers.length === 0 || addingUsers}
              >
                {addingUsers ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
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
    padding: 15,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  placeholder: {
    width: 60,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
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
  statCardGreen: {
    backgroundColor: '#34C759',
  },
  statCardOrange: {
    backgroundColor: '#FF9500',
  },
  statCardBlue: {
    backgroundColor: '#007AFF',
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
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  userPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonSmall: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonPromote: {
    backgroundColor: '#34C759',
  },
  actionButtonRemove: {
    backgroundColor: '#FF3B30',
  },
  actionButtonSmallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  groupIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconText: {
    fontSize: 20,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 12,
    color: '#666',
  },
  groupDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    margin: 15,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
  },
  usersList: {
    maxHeight: 400,
  },
  userSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userSelectItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  checkmark: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

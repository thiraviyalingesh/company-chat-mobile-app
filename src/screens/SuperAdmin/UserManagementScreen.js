/**
 * User Management Screen - SuperAdmin
 * Allows SuperAdmin to:
 * - View users in a project
 * - Add users to project
 * - Remove users from project
 * - Promote/demote user roles
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';

export default function UserManagementScreen({ navigation, route }) {
  const { currentUser } = useAuth();
  const { project } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [projectUsers, setProjectUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch users in this project
  useEffect(() => {
    if (!project) return;

    const fetchProjectUsers = async () => {
      try {
        setLoading(true);

        // Get userProjects for this project
        const userProjectsSnapshot = await firestore()
          .collection('userProjects')
          .where('projectId', '==', project.id)
          .where('isActive', '==', true)
          .get();

        // Fetch full user details
        const usersPromises = userProjectsSnapshot.docs.map(async upDoc => {
          const upData = upDoc.data();
          const userDoc = await firestore()
            .collection('users')
            .doc(upData.userId)
            .get();

          if (userDoc.exists) {
            return {
              id: upData.userId,
              userProjectId: upDoc.id, // Keep track of userProjects doc ID
              ...userDoc.data(),
              role: upData.role, // role from userProjects
            };
          }
          return null;
        });

        const users = await Promise.all(usersPromises);
        const filteredUsers = users.filter(u => u !== null);

        // Separate into admins and regular users
        const admins = filteredUsers.filter(u => u.role === 'project_admin');
        const regularUsers = filteredUsers.filter(u => u.role === 'user');

        setProjectUsers([...admins, ...regularUsers]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching project users:', error);
        Alert.alert('Error', 'Failed to load users');
        setLoading(false);
      }
    };

    fetchProjectUsers();
  }, [project]);

  // Fetch all users in the company (for adding)
  const fetchAllUsers = async () => {
    try {
      const usersSnapshot = await firestore()
        .collection('users')
        .where('isActive', '==', true)
        .get();

      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter out users already in project
      const projectUserIds = projectUsers.map(u => u.id);
      const availableUsers = users.filter(
        u => !projectUserIds.includes(u.id) && u.globalRole !== 'superadmin'
      );

      setAllUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching all users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const handleAddUsers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    setProcessing(true);

    try {
      let addedCount = 0;

      // Find General channel for this project
      const generalChannelSnapshot = await firestore()
        .collection('groups')
        .where('projectId', '==', project.id)
        .where('isGeneralChannel', '==', true)
        .get();

      const generalChannel = !generalChannelSnapshot.empty
        ? generalChannelSnapshot.docs[0]
        : null;

      for (const userId of selectedUsers) {
        // Check if already exists (double-check)
        const existingCheck = await firestore()
          .collection('userProjects')
          .where('userId', '==', userId)
          .where('projectId', '==', project.id)
          .get();

        if (!existingCheck.empty) {
          continue; // Skip if already exists
        }

        // Add user to project
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
        `Added ${addedCount} user(s) to ${project.name}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      setShowAddUserModal(false);
      setSelectedUsers([]);
    } catch (error) {
      console.error('Error adding users:', error);
      Alert.alert('Error', 'Failed to add users to project');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveUser = (user) => {
    Alert.alert(
      'Remove User',
      `Remove ${user.name} from ${project.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete userProjects entry
              if (user.userProjectId) {
                await firestore()
                  .collection('userProjects')
                  .doc(user.userProjectId)
                  .delete();
              }

              // Remove from all groups in this project
              const groupsSnapshot = await firestore()
                .collection('groups')
                .where('projectId', '==', project.id)
                .get();

              for (const groupDoc of groupsSnapshot.docs) {
                const groupData = groupDoc.data();
                if (groupData.members?.includes(user.id)) {
                  await firestore()
                    .collection('groups')
                    .doc(groupDoc.id)
                    .update({
                      members: groupData.members.filter(id => id !== user.id),
                    });
                }
              }

              Alert.alert('Success', `${user.name} removed from ${project.name}`);
              navigation.goBack();
            } catch (error) {
              console.error('Error removing user:', error);
              Alert.alert('Error', 'Failed to remove user');
            }
          },
        },
      ]
    );
  };

  const handleToggleRole = (user) => {
    const newRole = user.role === 'user' ? 'project_admin' : 'user';
    const action = newRole === 'project_admin' ? 'Promote' : 'Demote';

    Alert.alert(
      `${action} User`,
      `${action} ${user.name} to ${newRole === 'project_admin' ? 'Project Admin' : 'Regular User'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          onPress: async () => {
            try {
              if (user.userProjectId) {
                await firestore()
                  .collection('userProjects')
                  .doc(user.userProjectId)
                  .update({
                    role: newRole,
                  });

                Alert.alert('Success', `${user.name} ${action.toLowerCase()}d successfully`);
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error changing role:', error);
              Alert.alert('Error', 'Failed to change user role');
            }
          },
        },
      ]
    );
  };

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const filteredUsers = allUsers.filter(
    user =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phoneNumber?.includes(searchQuery)
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Management</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  const projectAdmins = projectUsers.filter(u => u.role === 'project_admin');
  const regularUsers = projectUsers.filter(u => u.role === 'user');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>{project?.name}</Text>
        </View>
      </View>

      {/* Add User Button */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            fetchAllUsers();
            setShowAddUserModal(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Users</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Project Admins Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            PROJECT ADMINS ({projectAdmins.length})
          </Text>
          {projectAdmins.length === 0 ? (
            <Text style={styles.emptyText}>No project admins</Text>
          ) : (
            projectAdmins.map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userPhone}>{user.phoneNumber}</Text>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.demoteButton}
                    onPress={() => handleToggleRole(user)}
                  >
                    <Text style={styles.demoteButtonText}>↓ Demote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveUser(user)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Regular Users Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            REGULAR USERS ({regularUsers.length})
          </Text>
          {regularUsers.length === 0 ? (
            <Text style={styles.emptyText}>No regular users</Text>
          ) : (
            regularUsers.map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userPhone}>{user.phoneNumber}</Text>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.promoteButton}
                    onPress={() => handleToggleRole(user)}
                  >
                    <Text style={styles.promoteButtonText}>↑ Promote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveUser(user)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Users Modal */}
      <Modal
        visible={showAddUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Users to Project</Text>
              <TouchableOpacity onPress={() => setShowAddUserModal(false)}>
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
              {filteredUsers.length === 0 ? (
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No users found' : 'All users already in project'}
                </Text>
              ) : (
                filteredUsers.map(user => (
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
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userPhone}>{user.phoneNumber}</Text>
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
                onPress={() => setShowAddUserModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  selectedUsers.length === 0 && styles.confirmButtonDisabled,
                ]}
                onPress={handleAddUsers}
                disabled={selectedUsers.length === 0 || processing}
              >
                {processing ? (
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
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  actionBar: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  promoteButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  promoteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  demoteButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  demoteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
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

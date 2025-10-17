/**
 * Create Project Modal
 * SuperAdmin can create new projects and assign project admins
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function CreateProjectModal({ visible, onClose, onSuccess }) {
  const { currentUser } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  // Project Admin assignment
  const [allUsers, setAllUsers] = useState([]);
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSelector, setShowUserSelector] = useState(false);

  // Fetch all users when modal opens
  useEffect(() => {
    if (visible) {
      fetchAllUsers();
    }
  }, [visible]);

  const fetchAllUsers = async () => {
    try {
      const usersSnapshot = await firestore()
        .collection('users')
        .where('isActive', '==', true)
        .where('globalRole', '!=', 'superadmin')
        .get();

      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAllUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const toggleAdminSelection = userId => {
    if (selectedAdmins.includes(userId)) {
      setSelectedAdmins(selectedAdmins.filter(id => id !== userId));
    } else {
      setSelectedAdmins([...selectedAdmins, userId]);
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }

    try {
      setLoading(true);

      // Create project document
      const projectRef = await firestore().collection('projects').add({
        name: projectName.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
        isActive: true,
      });

      // Create default "General" channel for the project
      const generalChannelRef = await firestore().collection('groups').add({
        name: 'General',
        description: 'Default channel for project-wide announcements',
        projectId: projectRef.id,
        isChannel: true,
        isGeneralChannel: true, // Mark as General channel
        members: selectedAdmins, // Add project admins to General channel
        createdAt: firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
        requiresApproval: false,
      });

      // Add selected users as project admins
      if (selectedAdmins.length > 0) {
        const userProjectsPromises = selectedAdmins.map(userId =>
          firestore().collection('userProjects').add({
            userId: userId,
            projectId: projectRef.id,
            role: 'project_admin',
            addedAt: firestore.FieldValue.serverTimestamp(),
            addedBy: currentUser.uid,
            isActive: true,
          })
        );

        await Promise.all(userProjectsPromises);
      }

      const message = selectedAdmins.length > 0
        ? `Project "${projectName}" created with ${selectedAdmins.length} project admin(s)!`
        : `Project "${projectName}" created successfully!`;

      Alert.alert(
        'Success',
        message,
        [
          {
            text: 'OK',
            onPress: () => {
              setProjectName('');
              setSelectedAdmins([]);
              setSearchQuery('');
              onSuccess?.();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating project:', error);
      Alert.alert('Error', 'Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setProjectName('');
      setSelectedAdmins([]);
      setSearchQuery('');
      onClose();
    }
  };

  const filteredUsers = allUsers.filter(
    user =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phoneNumber?.includes(searchQuery)
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Create New Project</Text>

            {/* Project Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Project Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Marketing Team, Engineering"
                value={projectName}
                onChangeText={setProjectName}
                editable={!loading}
                maxLength={50}
                autoFocus
              />
            </View>

            {/* Project Admins */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Assign Project Admins (Optional)</Text>
              <Text style={styles.hint}>
                Project admins can manage users and settings for this project
              </Text>

              {selectedAdmins.length > 0 && (
                <View style={styles.selectedAdminsContainer}>
                  <Text style={styles.selectedAdminsLabel}>
                    Selected: {selectedAdmins.length} admin{selectedAdmins.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowUserSelector(!showUserSelector)}
                disabled={loading}
              >
                <Text style={styles.selectButtonText}>
                  {showUserSelector ? '▲ Hide Users' : '▼ Select Project Admins'}
                </Text>
              </TouchableOpacity>

              {showUserSelector && (
                <View style={styles.userSelectorContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                  />

                  <ScrollView style={styles.usersList} nestedScrollEnabled>
                    {filteredUsers.length === 0 ? (
                      <Text style={styles.emptyText}>
                        {searchQuery ? 'No users found' : 'No users available'}
                      </Text>
                    ) : (
                      filteredUsers.map(user => (
                        <TouchableOpacity
                          key={user.id}
                          style={[
                            styles.userItem,
                            selectedAdmins.includes(user.id) && styles.userItemSelected,
                          ]}
                          onPress={() => toggleAdminSelection(user.id)}
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
                          {selectedAdmins.includes(user.id) && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={styles.footerHint}>
              A "General" channel will be created automatically for this project
            </Text>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.buttonTextCancel}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonCreate,
                (loading || !projectName.trim()) && styles.buttonDisabled,
              ]}
              onPress={handleCreate}
              disabled={loading || !projectName.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonTextCreate}>Create Project</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  selectedAdminsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  selectedAdminsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  userSelectorContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    fontSize: 14,
  },
  usersList: {
    maxHeight: 200,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userPhone: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 13,
    color: '#999',
  },
  footerHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonCancel: {
    backgroundColor: '#f0f0f0',
  },
  buttonCreate: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonTextCancel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCreate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

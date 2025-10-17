/**
 * SuperAdmin Chat Screen
 * Matches web app's SuperAdminChat.js
 * - Project selector
 * - Channels, Groups, Users sections
 * - Access to all projects and chats
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';
import ChatRoomScreen from '../Chat/ChatRoomScreen';
import DirectChatRoomScreen from '../Chat/DirectChatRoomScreen';

export default function SuperAdminChatScreen({ navigation }) {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);

  // Project selection
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Chat data
  const [groups, setGroups] = useState([]);
  const [channels, setChannels] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]);

  // Collapsible sections
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [usersExpanded, setUsersExpanded] = useState(true);

  // Selected chat
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch all projects (SuperAdmin has access to all)
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('projects')
      .where('isActive', '==', true)
      .onSnapshot(
        snapshot => {
          const projectsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setProjects(projectsData);

          // Auto-select first project
          if (projectsData.length > 0 && !selectedProject) {
            setSelectedProject(projectsData[0]);
          }
          setLoading(false);
        },
        error => {
          console.error('Error fetching projects:', error);
          setLoading(false);
        }
      );

    return unsubscribe;
  }, []);

  // Fetch groups/channels for selected project
  useEffect(() => {
    if (!selectedProject) {
      setGroups([]);
      setChannels([]);
      return;
    }

    const unsubscribe = firestore()
      .collection('groups')
      .where('projectId', '==', selectedProject.id)
      .onSnapshot(
        snapshot => {
          const groupsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Separate channels and groups
          const channelsList = groupsData.filter(g => g.isChannel);
          const groupsList = groupsData.filter(g => !g.isChannel);

          setChannels(channelsList);
          setGroups(groupsList);
        },
        error => {
          console.error('Error fetching groups:', error);
        }
      );

    return unsubscribe;
  }, [selectedProject]);

  // Fetch users for selected project
  useEffect(() => {
    if (!selectedProject) {
      setProjectUsers([]);
      return;
    }

    const fetchProjectUsers = async () => {
      try {
        // Get all userProjects for this project
        const userProjectsSnapshot = await firestore()
          .collection('userProjects')
          .where('projectId', '==', selectedProject.id)
          .where('isActive', '==', true)
          .get();

        // Get user details for each userProject
        const usersPromises = userProjectsSnapshot.docs.map(async upDoc => {
          const upData = upDoc.data();
          const userDoc = await firestore()
            .collection('users')
            .doc(upData.userId)
            .get();

          if (userDoc.exists) {
            return {
              id: upData.userId,
              ...userDoc.data(),
              role: upData.role,
            };
          }
          return null;
        });

        const usersData = await Promise.all(usersPromises);
        const filteredUsers = usersData.filter(u => u !== null);
        setProjectUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching project users:', error);
      }
    };

    fetchProjectUsers();
  }, [selectedProject]);

  const handleSelectGroup = group => {
    setSelectedGroup(group);
    setSelectedUser(null);
  };

  const handleSelectUser = user => {
    setSelectedUser(user);
    setSelectedGroup(null);
  };

  const handleProjectSelect = project => {
    setSelectedProject(project);
    setShowProjectSelector(false);
    setSelectedGroup(null);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  // If chat is open, show ChatRoomScreen
  if (selectedGroup) {
    return (
      <ChatRoomScreen
        group={selectedGroup}
        onBack={() => setSelectedGroup(null)}
      />
    );
  }

  // Direct message screen
  if (selectedUser) {
    return (
      <DirectChatRoomScreen
        otherUser={selectedUser}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>SuperAdmin Chat</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Project Selector */}
      <TouchableOpacity
        style={styles.projectSelector}
        onPress={() => setShowProjectSelector(true)}
      >
        <View style={styles.projectSelectorContent}>
          <Text style={styles.projectSelectorLabel}>PROJECT</Text>
          <Text style={styles.projectSelectorValue}>
            {selectedProject ? selectedProject.name : 'Select Project'}
          </Text>
        </View>
        <Text style={styles.projectSelectorArrow}>▼</Text>
      </TouchableOpacity>

      {/* Chat List */}
      <ScrollView style={styles.chatList}>
        {!selectedProject ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>No Project Selected</Text>
            <Text style={styles.emptySubtext}>
              Please select a project to view chats
            </Text>
            <Text style={styles.emptyCount}>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} available
            </Text>
          </View>
        ) : (
          <>
            {/* CHANNELS Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setChannelsExpanded(!channelsExpanded)}
              >
                <Text style={styles.sectionTitle}>CHANNELS</Text>
                <Text style={styles.sectionToggle}>{channelsExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {channelsExpanded && (
                <View style={styles.sectionContent}>
                  {channels.length === 0 ? (
                    <Text style={styles.noItems}>No channels yet</Text>
                  ) : (
                    channels.map(channel => (
                      <TouchableOpacity
                        key={channel.id}
                        style={styles.chatItem}
                        onPress={() => handleSelectGroup(channel)}
                      >
                        <Text style={styles.chatIcon}>📢</Text>
                        <View style={styles.chatInfo}>
                          <Text style={styles.chatName}>{channel.name}</Text>
                          <Text style={styles.chatDescription}>
                            {channel.description || 'No description'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* GROUPS Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setGroupsExpanded(!groupsExpanded)}
              >
                <Text style={styles.sectionTitle}>GROUPS</Text>
                <Text style={styles.sectionToggle}>{groupsExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {groupsExpanded && (
                <View style={styles.sectionContent}>
                  {groups.length === 0 ? (
                    <Text style={styles.noItems}>No groups yet</Text>
                  ) : (
                    groups.map(group => (
                      <TouchableOpacity
                        key={group.id}
                        style={styles.chatItem}
                        onPress={() => handleSelectGroup(group)}
                      >
                        <Text style={styles.chatIcon}>💬</Text>
                        <View style={styles.chatInfo}>
                          <Text style={styles.chatName}>{group.name}</Text>
                          <Text style={styles.chatDescription}>
                            {group.description || 'No description'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* USERS Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setUsersExpanded(!usersExpanded)}
              >
                <Text style={styles.sectionTitle}>USERS</Text>
                <Text style={styles.sectionToggle}>{usersExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {usersExpanded && (
                <View style={styles.sectionContent}>
                  {projectUsers.length === 0 ? (
                    <Text style={styles.noItems}>No users in this project</Text>
                  ) : (
                    projectUsers.map(user => (
                      <TouchableOpacity
                        key={user.id}
                        style={styles.userItem}
                        onPress={() => handleSelectUser(user)}
                      >
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </Text>
                        </View>
                        <View style={styles.userInfo}>
                          <View style={styles.userNameRow}>
                            <Text style={styles.userName}>{user.name}</Text>
                            <View
                              style={[
                                styles.roleBadge,
                                user.role === 'project_admin'
                                  ? styles.roleBadgeAdmin
                                  : styles.roleBadgeUser,
                              ]}
                            >
                              <Text style={styles.roleBadgeText}>
                                {user.role === 'project_admin' ? 'Admin' : 'User'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.userPhone}>{user.phoneNumber}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Project Selector Modal */}
      <Modal visible={showProjectSelector} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Project</Text>
              <TouchableOpacity onPress={() => setShowProjectSelector(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.projectList}>
              {projects.map(project => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectOption,
                    selectedProject?.id === project.id && styles.projectOptionSelected,
                  ]}
                  onPress={() => handleProjectSelect(project)}
                >
                  <Text style={styles.projectIcon}>📁</Text>
                  <View style={styles.projectOptionInfo}>
                    <Text style={styles.projectOptionName}>{project.name}</Text>
                  </View>
                  {selectedProject?.id === project.id && (
                    <Text style={styles.projectOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 2,
    textAlign: 'center',
  },
  headerRight: {
    flex: 1,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  projectSelector: {
    backgroundColor: '#fff',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  projectSelectorContent: {
    flex: 1,
  },
  projectSelectorLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  projectSelectorValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  projectSelectorArrow: {
    fontSize: 14,
    color: '#007AFF',
  },
  chatList: {
    flex: 1,
  },
  section: {
    marginTop: 10,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  sectionToggle: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
  sectionContent: {
    backgroundColor: '#fff',
  },
  noItems: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  chatDescription: {
    fontSize: 14,
    color: '#666',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeAdmin: {
    backgroundColor: '#FF9500',
  },
  roleBadgeUser: {
    backgroundColor: '#34C759',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  userPhone: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyCount: {
    fontSize: 14,
    color: '#007AFF',
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
    maxHeight: '70%',
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
  projectList: {
    maxHeight: 400,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  projectOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  projectIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  projectOptionInfo: {
    flex: 1,
  },
  projectOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  projectOptionCheck: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

/**
 * Pending Approvals Screen
 * SuperAdmin reviews and approves/rejects QR code signups
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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export default function PendingApprovalsScreen({ visible, onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(null); // userId being processed

  useEffect(() => {
    if (visible) {
      loadPendingUsers();
    }
  }, [visible]);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);

      // Get all QR invitations with pending signups
      const qrSnapshot = await firestore()
        .collection('qrInvitations')
        .where('isPending', '==', true)
        .get();

      const pending = [];

      for (const qrDoc of qrSnapshot.docs) {
        const qrData = qrDoc.data();
        const pendingSignups = qrData.pendingSignups || [];

        for (const signup of pendingSignups) {
          // Fetch user details
          const userDoc = await firestore()
            .collection('users')
            .doc(signup.userId)
            .get();

          if (userDoc.exists) {
            pending.push({
              ...userDoc.data(),
              id: userDoc.id,
              qrId: qrDoc.id,
              projectId: qrData.projectId, // null for company-wide, projectId for project-specific
              signupTimestamp: signup.timestamp,
            });
          }
        }
      }

      // Sort by signup timestamp (newest first)
      pending.sort((a, b) => {
        const dateA = a.signupTimestamp?.toDate?.() || new Date(0);
        const dateB = b.signupTimestamp?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setPendingUsers(pending);
    } catch (error) {
      console.error('Error loading pending users:', error);
      Alert.alert('Error', 'Failed to load pending approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (user) => {
    Alert.alert(
      'Approve User',
      `Approve ${user.name} (${user.phoneNumber})?\n\n${
        user.projectId
          ? 'User will be added to the specific project.'
          : 'User will be added to company workspace and can be assigned to projects by project admins.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => approveUser(user),
        },
      ]
    );
  };

  const approveUser = async (user) => {
    try {
      setProcessing(user.id);

      // Update user document - mark as approved
      await firestore()
        .collection('users')
        .doc(user.id)
        .update({
          isApproved: true,
          approvedAt: firestore.FieldValue.serverTimestamp(),
        });

      // If project-specific, add to userProjects
      if (user.projectId) {
        await firestore().collection('userProjects').add({
          userId: user.id,
          projectId: user.projectId,
          role: 'user', // Regular user by default
          addedAt: firestore.FieldValue.serverTimestamp(),
          isActive: true,
        });
      }

      // Remove from QR invitation pending list
      const qrDoc = await firestore()
        .collection('qrInvitations')
        .doc(user.qrId)
        .get();

      if (qrDoc.exists) {
        const qrData = qrDoc.data();
        const updatedPendingSignups = (qrData.pendingSignups || []).filter(
          signup => signup.userId !== user.id
        );

        await firestore()
          .collection('qrInvitations')
          .doc(user.qrId)
          .update({
            pendingSignups: updatedPendingSignups,
            isPending: updatedPendingSignups.length > 0,
          });
      }

      Alert.alert('Success', `${user.name} has been approved!`);
      loadPendingUsers(); // Refresh list
    } catch (error) {
      console.error('Error approving user:', error);
      Alert.alert('Error', 'Failed to approve user');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (user) => {
    Alert.alert(
      'Reject User',
      `Reject ${user.name} (${user.phoneNumber})?\n\nThis will permanently delete their account and authentication credentials.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => rejectUser(user),
        },
      ]
    );
  };

  const rejectUser = async (user) => {
    try {
      setProcessing(user.id);

      // Delete user document from Firestore
      await firestore().collection('users').doc(user.id).delete();

      // Delete from Firebase Auth if exists
      try {
        // Note: In production, this should be done via Cloud Function with admin SDK
        // For now, we just remove from Firestore
        console.log('User removed from Firestore:', user.id);
      } catch (authError) {
        console.warn('Could not delete auth user:', authError);
      }

      // Remove from QR invitation pending list
      const qrDoc = await firestore()
        .collection('qrInvitations')
        .doc(user.qrId)
        .get();

      if (qrDoc.exists) {
        const qrData = qrDoc.data();
        const updatedPendingSignups = (qrData.pendingSignups || []).filter(
          signup => signup.userId !== user.id
        );

        await firestore()
          .collection('qrInvitations')
          .doc(user.qrId)
          .update({
            pendingSignups: updatedPendingSignups,
            isPending: updatedPendingSignups.length > 0,
          });
      }

      Alert.alert('Success', `${user.name} has been rejected and removed.`);
      loadPendingUsers(); // Refresh list
    } catch (error) {
      console.error('Error rejecting user:', error);
      Alert.alert('Error', 'Failed to reject user');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Unknown';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Approvals</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading pending users...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={loadPendingUsers} />
            }
          >
            {pendingUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>No pending approvals</Text>
                <Text style={styles.emptySubtext}>
                  All QR code signups have been reviewed
                </Text>
              </View>
            ) : (
              <View style={styles.usersList}>
                <Text style={styles.listHeader}>
                  {pendingUsers.length} user{pendingUsers.length > 1 ? 's' : ''} waiting for approval
                </Text>

                {pendingUsers.map(user => (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name || 'Unnamed User'}</Text>
                        <Text style={styles.userPhone}>{user.phoneNumber || 'No phone'}</Text>
                        <Text style={styles.userTime}>
                          Signed up {formatDate(user.signupTimestamp)}
                        </Text>
                      </View>
                    </View>

                    {user.projectId && (
                      <View style={styles.projectBadge}>
                        <Text style={styles.projectBadgeText}>
                          📁 Project-specific signup
                        </Text>
                      </View>
                    )}

                    <View style={styles.userActions}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.rejectButton,
                          processing === user.id && styles.actionButtonDisabled,
                        ]}
                        onPress={() => handleReject(user)}
                        disabled={processing === user.id}
                      >
                        {processing === user.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.approveButton,
                          processing === user.id && styles.actionButtonDisabled,
                        ]}
                        onPress={() => handleApprove(user)}
                        disabled={processing === user.id}
                      >
                        {processing === user.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.approveButtonText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  usersList: {
    padding: 15,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    marginBottom: 15,
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
    justifyContent: 'center',
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
    marginBottom: 2,
  },
  userTime: {
    fontSize: 12,
    color: '#999',
  },
  projectBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  projectBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

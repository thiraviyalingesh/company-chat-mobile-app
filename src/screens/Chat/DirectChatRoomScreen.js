/**
 * Direct Chat Room Screen
 * 1-on-1 messaging between users
 * Similar to ChatRoomScreen but for direct messages
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';

export default function DirectChatRoomScreen({ otherUser, onBack }) {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Generate conversation ID (sorted user IDs)
  const conversationId = [currentUser.uid, otherUser.id].sort().join('_');

  // Fetch messages for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = firestore()
      .collection('directMessages')
      .where('conversationId', '==', conversationId)
      .onSnapshot(
        snapshot => {
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Sort by timestamp
          messagesData.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeA - timeB;
          });

          setMessages(messagesData);
          setLoading(false);
        },
        error => {
          console.error('Error fetching messages:', error);
          setLoading(false);
        }
      );

    return unsubscribe;
  }, [conversationId]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages]);

  const markAsRead = async () => {
    try {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

      await firestore()
        .collection('userReadStatus')
        .doc(currentUser.uid)
        .set(
          {
            dmTimestamps: {
              [conversationId]: now,
            },
          },
          { merge: true }
        );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const messageData = {
        text: messageText,
        conversationId,
        participants: [currentUser.uid, otherUser.id],
        senderId: currentUser.uid,
        senderName: userData?.name || 'Unknown User',
        senderProfilePic: userData?.profilePictureUrl || null,
        receiverId: otherUser.id,
        receiverName: otherUser.name || 'Unknown',
        type: 'message',
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('directMessages').add(messageData);

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = (messageId, senderId) => {
    if (senderId !== currentUser.uid) {
      Alert.alert('Error', 'You can only delete your own messages');
      return;
    }

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore()
                .collection('directMessages')
                .doc(messageId)
                .delete();
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  const formatTime = timestamp => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDate = timestamp => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMyMessage = item.senderId === currentUser.uid;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator =
      !previousMessage ||
      formatDate(item.createdAt) !== formatDate(previousMessage.createdAt);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessage : styles.theirMessage,
          ]}
          onLongPress={() =>
            isMyMessage && handleDeleteMessage(item.id, item.senderId)
          }
        >
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
            ]}
          >
            {!isMyMessage && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.theirMessageText,
              ]}
            >
              {item.text}
            </Text>
            <Text
              style={[
                styles.timestamp,
                isMyMessage ? styles.myTimestamp : styles.theirTimestamp,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{otherUser?.name || 'User'}</Text>
            <Text style={styles.headerSubtitle}>
              {otherUser?.phoneNumber || ''}
            </Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherUser?.name || 'User'}</Text>
          <Text style={styles.headerSubtitle}>
            {otherUser?.phoneNumber || ''}
          </Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {otherUser?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
      </View>

      {/* Messages List */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation with {otherUser?.name || 'this user'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    padding: 5,
    marginRight: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  messagesList: {
    padding: 15,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 15,
  },
  dateSeparatorText: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  messageContainer: {
    marginBottom: 10,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: '#fff',
    opacity: 0.7,
    textAlign: 'right',
  },
  theirTimestamp: {
    color: '#666',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

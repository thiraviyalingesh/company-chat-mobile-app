import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

export default function ChatRoomScreen({ group, onBack }) {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!group) return;

    const unsubscribe = firestore()
      .collection('messages')
      .where('groupId', '==', group.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        snapshot => {
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log('Snapshot update - Messages count:', messagesData.length);
          setMessages(messagesData);
        },
        error => {
          console.error('Error fetching messages:', error);
          Alert.alert('Error', error.message);
        },
        { includeMetadataChanges: false }
      );

    return unsubscribe;
  }, [group]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !group) return;

    if (group.isChannel && userData?.role !== 'admin') {
      Alert.alert('Error', 'Only admins can post in channels');
      return;
    }

    const messageText = newMessage;
    setNewMessage('');
    setLoading(true);

    try {
      const messageData = {
        text: messageText,
        groupId: group.id,
        senderId: currentUser.uid,
        senderName: userData?.name || 'Unknown User',
        senderProfilePic: userData?.profilePictureUrl || null,
        type: 'message',
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('messages').add(messageData);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setLoading(false);
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Add Image',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => {
            launchCamera({ mediaType: 'photo', quality: 0.8 }, handleImageResponse);
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, handleImageResponse);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleImageResponse = async (response) => {
    if (response.didCancel || response.error) return;

    const asset = response.assets?.[0];
    if (!asset) return;

    try {
      setLoading(true);

      // Upload image to Firebase Storage
      const filename = `chat-images/${currentUser.uid}/${Date.now()}.jpg`;
      const reference = storage().ref(filename);
      await reference.putFile(asset.uri);
      const url = await reference.getDownloadURL();

      // Send message with image
      await firestore().collection('messages').add({
        text: '',
        mediaUrl: url,
        mediaType: 'image',
        groupId: group.id,
        senderId: currentUser.uid,
        senderName: userData?.name || 'Unknown User',
        senderProfilePic: userData?.profilePictureUrl || null,
        type: 'message',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Now';
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Now';
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.senderId === currentUser.uid;

    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        {!isOwn && (
          <View style={styles.messageAvatar}>
            <Text style={styles.avatarText}>
              {item.senderName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}

          {item.mediaUrl && item.mediaType === 'image' && (
            <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
          )}

          {item.text && (
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
              {item.text}
            </Text>
          )}

          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <Text style={styles.headerSubtitle}>
            {group.isChannel ? '📢 Channel' : '💬 Group'} · {group.members?.length || 0} members
          </Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.messagesList}
      />

      {/* Input Area */}
      {(!group.isChannel || userData?.role === 'admin') && (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleImagePicker}
            disabled={loading}
          >
            <Text style={styles.imageButtonText}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || loading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
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
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
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
    opacity: 0.9,
    marginTop: 2,
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '70%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: '#fff',
    opacity: 0.8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  imageButton: {
    padding: 10,
    marginRight: 5,
  },
  imageButtonText: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

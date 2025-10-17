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
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';

export default function ChatRoomScreen({ group, onBack }) {
  const { currentUser, userData, userProjects } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null); // For long-press actions
  const [showReactionPicker, setShowReactionPicker] = useState(null); // messageId
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewingMedia, setViewingMedia] = useState(null); // For full-screen view
  const [typingUsers, setTypingUsers] = useState([]);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Check if user is Project Admin
  const isProjectAdmin = userProjects?.some(up =>
    up.projectId === group?.projectId && up.role === 'project_admin'
  );
  const isSuperAdmin = userData?.globalRole === 'superadmin';

  // Can send messages: Groups - anyone, Channels - only admins
  const canSendMessages = group?.isChannel ? (isProjectAdmin || isSuperAdmin) : true;

  // 📥 FETCH MESSAGES
  useEffect(() => {
    if (!group) return;

    const unsubscribe = firestore()
      .collection('messages')
      .where('groupId', '==', group.id)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .onSnapshot(
        snapshot => {
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setMessages(messagesData);
        },
        error => {
          console.error('Error fetching messages:', error);
        }
      );

    return unsubscribe;
  }, [group]);

  // 👀 LISTEN TO TYPING INDICATORS
  useEffect(() => {
    if (!group) return;

    const unsubscribe = firestore()
      .collection('typing')
      .where('groupId', '==', group.id)
      .onSnapshot(snapshot => {
        const typingData = snapshot.docs
          .map(doc => doc.data())
          .filter(typing => typing.userId !== currentUser.uid); // Don't show own typing
        setTypingUsers(typingData);
      });

    return () => {
      unsubscribe();
      // Clear typing status on unmount
      updateTypingStatus(false);
    };
  }, [group, currentUser]);

  // ⌨️ UPDATE TYPING STATUS
  const updateTypingStatus = async (isTyping) => {
    if (!group || !currentUser) return;

    const typingDocRef = firestore()
      .collection('typing')
      .doc(`${group.id}_${currentUser.uid}`);

    try {
      if (isTyping) {
        await typingDocRef.set({
          groupId: group.id,
          userId: currentUser.uid,
          userName: userData?.name || 'Unknown User',
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await typingDocRef.delete();
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  // 📝 HANDLE INPUT CHANGE
  const handleInputChange = (text) => {
    setNewMessage(text);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing to true
    updateTypingStatus(true);

    // Set timeout to remove typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  };

  // 📤 SEND MESSAGE
  const sendMessage = async () => {
    if (!newMessage.trim() || !group) return;

    if (!canSendMessages) {
      Alert.alert('Error', 'Only admins can post in channels');
      return;
    }

    const messageText = newMessage;
    setNewMessage('');
    setLoading(true);
    updateTypingStatus(false);

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

      // Add reply data if replying
      if (replyingTo) {
        messageData.replyTo = {
          messageId: replyingTo.id,
          text: replyingTo.text || '[Media]',
          senderName: replyingTo.senderName,
        };
        setReplyingTo(null);
      }

      await firestore().collection('messages').add(messageData);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText);
    } finally {
      setLoading(false);
    }
  };

  // 📷 HANDLE IMAGE PICKER
  const handleImagePicker = () => {
    setShowAttachmentMenu(false);
    Alert.alert(
      'Add Image',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => {
            launchCamera({ mediaType: 'photo', quality: 0.8 }, handleMediaResponse);
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, handleMediaResponse);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // 🎥 HANDLE VIDEO PICKER
  const handleVideoPicker = () => {
    setShowAttachmentMenu(false);
    Alert.alert(
      'Add Video',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => {
            launchCamera({ mediaType: 'video', quality: 0.8 }, handleMediaResponse);
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            launchImageLibrary({ mediaType: 'video', quality: 0.8 }, handleMediaResponse);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // 📄 HANDLE DOCUMENT PICKER
  const handleDocumentPicker = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.docx],
      });

      const file = result[0];

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 10MB');
        return;
      }

      handleDocumentUpload(file);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('Document picker error:', error);
        Alert.alert('Error', 'Failed to pick document');
      }
    }
  };

  // 📤 UPLOAD DOCUMENT
  const handleDocumentUpload = async (file) => {
    try {
      setUploadingMedia(true);

      const filename = `chat-documents/${currentUser.uid}/${Date.now()}_${file.name}`;
      const reference = storage().ref(filename);
      await reference.putFile(file.uri);
      const url = await reference.getDownloadURL();

      // Send message with document
      await firestore().collection('messages').add({
        text: '',
        mediaUrl: url,
        mediaType: 'document',
        fileName: file.name,
        groupId: group.id,
        senderId: currentUser.uid,
        senderName: userData?.name || 'Unknown User',
        senderProfilePic: userData?.profilePictureUrl || null,
        type: 'message',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploadingMedia(false);
    }
  };

  // 🖼️ HANDLE MEDIA RESPONSE (IMAGE/VIDEO)
  const handleMediaResponse = async (response) => {
    if (response.didCancel || response.error) return;

    const asset = response.assets?.[0];
    if (!asset) return;

    const isVideo = asset.type?.startsWith('video');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB video, 5MB image

    if (asset.fileSize > maxSize) {
      Alert.alert('Error', `File size must be less than ${isVideo ? '50MB' : '5MB'}`);
      return;
    }

    try {
      setUploadingMedia(true);

      const folder = isVideo ? 'chat-videos' : 'chat-images';
      const ext = isVideo ? 'mp4' : 'jpg';
      const filename = `${folder}/${currentUser.uid}/${Date.now()}.${ext}`;
      const reference = storage().ref(filename);
      await reference.putFile(asset.uri);
      const url = await reference.getDownloadURL();

      // Send message with media
      await firestore().collection('messages').add({
        text: '',
        mediaUrl: url,
        mediaType: isVideo ? 'video' : 'image',
        groupId: group.id,
        senderId: currentUser.uid,
        senderName: userData?.name || 'Unknown User',
        senderProfilePic: userData?.profilePictureUrl || null,
        type: 'message',
        createdAt: firestore.FieldValue.serverTimestamp(),
        ...(replyingTo ? {
          replyTo: {
            messageId: replyingTo.id,
            text: replyingTo.text || '[Media]',
            senderName: replyingTo.senderName,
          }
        } : {}),
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  // 😊 HANDLE REACTION
  const handleReaction = async (messageId, emoji) => {
    try {
      const messageRef = firestore().collection('messages').doc(messageId);
      const messageDoc = await messageRef.get();

      if (!messageDoc.exists) return;

      const messageData = messageDoc.data();
      const reactions = messageData.reactions || {};

      // Check if user already reacted with this emoji
      const userReactions = reactions[emoji] || [];
      const userIndex = userReactions.indexOf(currentUser.uid);

      if (userIndex > -1) {
        // Remove reaction
        userReactions.splice(userIndex, 1);
        if (userReactions.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = userReactions;
        }
      } else {
        // Add reaction
        reactions[emoji] = [...userReactions, currentUser.uid];
      }

      await messageRef.update({ reactions });
      setShowReactionPicker(null);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // 🗑️ DELETE MESSAGE
  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Delete this message for everyone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore().collection('messages').doc(messageId).delete();
              setSelectedMessage(null);
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  // 📅 DATE LABEL FUNCTIONS
  const getDateLabel = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return null;
    const messageDate = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDateOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateOnly.getTime() === todayDateOnly.getTime()) {
      return 'Today';
    } else if (messageDateOnly.getTime() === yesterdayDateOnly.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  const shouldShowDateDivider = (currentMessage, previousMessage) => {
    if (!currentMessage.createdAt) return false;
    if (!previousMessage) return true;

    const currentDate = currentMessage.createdAt.toDate ? currentMessage.createdAt.toDate() : new Date();
    const prevDate = previousMessage.createdAt ? (previousMessage.createdAt.toDate ? previousMessage.createdAt.toDate() : new Date()) : null;

    if (!prevDate) return true;

    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const prevDateOnly = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());

    return currentDateOnly.getTime() !== prevDateOnly.getTime();
  };

  // ⏰ FORMAT TIME
  const formatTime = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Now';
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Now';
    }
  };

  // 💬 RENDER MESSAGE
  const renderMessage = ({ item, index }) => {
    const isOwn = item.senderId === currentUser.uid;
    const previousMessage = messages[index + 1]; // Inverted list
    const showDivider = shouldShowDateDivider(item, previousMessage);

    return (
      <>
        {showDivider && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateDividerText}>{getDateLabel(item.createdAt)}</Text>
          </View>
        )}
        <Pressable
          onLongPress={() => setSelectedMessage(item)}
          style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}
        >
          {!isOwn && (
            <View style={styles.messageAvatar}>
              {item.senderProfilePic ? (
                <Image source={{ uri: item.senderProfilePic }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {item.senderName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              )}
            </View>
          )}
          <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
            {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}

            {/* REPLY PREVIEW */}
            {item.replyTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyLine} />
                <View style={styles.replyContent}>
                  <Text style={styles.replySender}>{item.replyTo.senderName}</Text>
                  <Text style={styles.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
                </View>
              </View>
            )}

            {/* MEDIA */}
            {item.mediaUrl && item.mediaType === 'image' && (
              <TouchableOpacity onPress={() => setViewingMedia({ url: item.mediaUrl, type: 'image' })}>
                <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
              </TouchableOpacity>
            )}

            {item.mediaUrl && item.mediaType === 'video' && (
              <TouchableOpacity onPress={() => setViewingMedia({ url: item.mediaUrl, type: 'video' })}>
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoIcon}>▶️ Video</Text>
                  <Text style={styles.videoText}>Tap to view</Text>
                </View>
              </TouchableOpacity>
            )}

            {item.mediaUrl && item.mediaType === 'document' && (
              <View style={styles.documentContainer}>
                <Text style={styles.documentIcon}>📄</Text>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName} numberOfLines={1}>{item.fileName || 'Document'}</Text>
                  <Text style={styles.documentAction}>Tap to download</Text>
                </View>
              </View>
            )}

            {/* TEXT */}
            {item.text && (
              <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
                {item.text}
              </Text>
            )}

            {/* REACTIONS */}
            {item.reactions && Object.keys(item.reactions).length > 0 && (
              <View style={styles.reactionsContainer}>
                {Object.entries(item.reactions).map(([emoji, users]) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.reactionBadge,
                      users.includes(currentUser.uid) && styles.reactionBadgeActive
                    ]}
                    onPress={() => handleReaction(item.id, emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{users.length}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </Pressable>
      </>
    );
  };

  // 🎨 RENDER
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* HEADER */}
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

      {/* MESSAGES LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.messagesList}
      />

      {/* TYPING INDICATOR */}
      {typingUsers.length > 0 && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {typingUsers.length === 1
              ? `${typingUsers[0].userName} is typing...`
              : `${typingUsers.length} people are typing...`
            }
          </Text>
        </View>
      )}

      {/* INPUT AREA */}
      {canSendMessages ? (
        <View>
          {/* REPLYING TO BANNER */}
          {replyingTo && (
            <View style={styles.replyingBanner}>
              <View style={styles.replyingContent}>
                <Text style={styles.replyingLabel}>Replying to {replyingTo.senderName}</Text>
                <Text style={styles.replyingMessage} numberOfLines={1}>
                  {replyingTo.text || '[Media]'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.replyingClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* UPLOADING INDICATOR */}
          {uploadingMedia && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#007AFF" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
              disabled={loading || uploadingMedia}
            >
              <Text style={styles.attachmentIcon}>📎</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={newMessage}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              editable={!loading && !uploadingMedia}
            />

            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || loading || uploadingMedia) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || loading || uploadingMedia}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>📢 Read-only channel. Only admins can post.</Text>
        </View>
      )}

      {/* ATTACHMENT MENU */}
      {showAttachmentMenu && (
        <View style={styles.attachmentMenu}>
          <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleImagePicker}>
            <Text style={styles.attachmentMenuIcon}>📷</Text>
            <Text style={styles.attachmentMenuText}>Pictures</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleVideoPicker}>
            <Text style={styles.attachmentMenuIcon}>🎥</Text>
            <Text style={styles.attachmentMenuText}>Videos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleDocumentPicker}>
            <Text style={styles.attachmentMenuIcon}>📄</Text>
            <Text style={styles.attachmentMenuText}>Documents</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MESSAGE ACTIONS MODAL */}
      {selectedMessage && (
        <Modal transparent visible={true} animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedMessage(null)}>
            <View style={styles.actionsModal}>
              <Text style={styles.actionsTitle}>Message Actions</Text>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowReactionPicker(selectedMessage.id);
                }}
              >
                <Text style={styles.actionButtonText}>😊 Add Reaction</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setReplyingTo(selectedMessage);
                  setSelectedMessage(null);
                }}
              >
                <Text style={styles.actionButtonText}>↩️ Reply</Text>
              </TouchableOpacity>

              {selectedMessage.senderId === currentUser.uid && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleDeleteMessage(selectedMessage.id)}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                    🗑️ Delete for Everyone
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonCancel]}
                onPress={() => setSelectedMessage(null)}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* REACTION PICKER MODAL */}
      {showReactionPicker && (
        <Modal transparent visible={true} animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowReactionPicker(null)}>
            <View style={styles.reactionPickerModal}>
              <Text style={styles.reactionPickerTitle}>React to message</Text>
              <ScrollView horizontal style={styles.reactionPickerScroll}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'].map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionOption}
                    onPress={() => handleReaction(showReactionPicker, emoji)}
                  >
                    <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* MEDIA VIEWER MODAL */}
      {viewingMedia && (
        <Modal visible={true} animationType="fade" onRequestClose={() => setViewingMedia(null)}>
          <View style={styles.mediaViewerContainer}>
            <TouchableOpacity
              style={styles.mediaViewerClose}
              onPress={() => setViewingMedia(null)}
            >
              <Text style={styles.mediaViewerCloseText}>✕ Close</Text>
            </TouchableOpacity>
            {viewingMedia.type === 'image' ? (
              <Image
                source={{ uri: viewingMedia.url }}
                style={styles.mediaViewerImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.mediaViewerVideoContainer}>
                <Text style={styles.mediaViewerVideoText}>Video playback requires react-native-video</Text>
                <Text style={styles.mediaViewerVideoUrl}>{viewingMedia.url}</Text>
              </View>
            )}
          </View>
        </Modal>
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
  dateDivider: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateDividerText: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#666',
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
  avatarImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
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
  replyPreview: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  replyLine: {
    width: 3,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
  },
  videoPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: '#000',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoIcon: {
    fontSize: 24,
    color: '#fff',
  },
  videoText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  documentAction: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 2,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  reactionBadgeActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
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
  typingContainer: {
    padding: 10,
    backgroundColor: '#fff',
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  replyingBanner: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#007AFF',
    alignItems: 'center',
  },
  replyingContent: {
    flex: 1,
  },
  replyingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  replyingMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  replyingClose: {
    fontSize: 20,
    color: '#666',
    paddingHorizontal: 10,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
  },
  uploadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  attachmentButton: {
    padding: 10,
    marginRight: 5,
  },
  attachmentIcon: {
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
  readOnlyBanner: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#FFE69C',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
  },
  attachmentMenu: {
    position: 'absolute',
    bottom: 70,
    left: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  attachmentMenuIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  attachmentMenuText: {
    fontSize: 15,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  actionButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  actionButtonDanger: {
    backgroundColor: '#FFE5E5',
  },
  actionButtonCancel: {
    backgroundColor: '#e0e0e0',
  },
  actionButtonText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#333',
  },
  actionButtonTextDanger: {
    color: '#DC3545',
    fontWeight: '600',
  },
  reactionPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxWidth: 350,
  },
  reactionPickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  reactionPickerScroll: {
    flexDirection: 'row',
  },
  reactionOption: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reactionOptionEmoji: {
    fontSize: 32,
  },
  mediaViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  mediaViewerCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  mediaViewerImage: {
    width: '100%',
    height: '100%',
  },
  mediaViewerVideoContainer: {
    padding: 20,
    alignItems: 'center',
  },
  mediaViewerVideoText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  mediaViewerVideoUrl: {
    color: '#007AFF',
    fontSize: 12,
    textAlign: 'center',
  },
});

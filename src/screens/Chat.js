import PropTypes from 'prop-types';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import EmojiModal from 'react-native-emoji-modal';
import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Send, Bubble, GiftedChat, InputToolbar } from 'react-native-gifted-chat';
import { ref, getStorage, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import {
  View,
  Text,
  Alert,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { colors } from '../config/constants';
import { auth, database } from '../config/firebase';

const link = 'http://192.168.1.7:8080';

const RenderLoadingUpload = () => (
  <View style={styles.loadingContainerUpload}>
    <ActivityIndicator size="large" color={colors.teal} />
  </View>
);

const RenderLoading = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.teal} />
  </View>
);

const RenderBubble = (props) => (
  <Bubble
    {...props}
    wrapperStyle={{
      right: { backgroundColor: colors.primary },
      left: { backgroundColor: '#1a1818' },
    }}
    renderMessageText={(bubbleProps) => (
      <View>
        <Text style={{ color: 'white', padding: 5 }}>
          {bubbleProps.currentMessage.translatedText}
        </Text>
        <Text style={{ fontSize: 10, color: 'white', padding: 5 }}>
          ({bubbleProps.currentMessage.originalText})
        </Text>
      </View>
    )}
  />
);

const RenderAttach = (props) => (
  <TouchableOpacity {...props} style={styles.addImageIcon}>
    <View>
      <Ionicons name="attach-outline" size={32} color={colors.teal} />
    </View>
  </TouchableOpacity>
);

const RenderInputToolbar = (props, handleEmojiPanel) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 40,
      paddingTop: 10,
      backgroundColor: 'white',
    }}
  >
    <InputToolbar
      {...props}
      renderActions={() => RenderActions(handleEmojiPanel)}
      containerStyle={styles.inputToolbar}
    />
    <Send {...props}>
      <View style={styles.sendIconContainer}>
        <Ionicons name="send" size={24} color={colors.teal} />
      </View>
    </Send>
  </View>
);

const RenderActions = (handleEmojiPanel) => (
  <TouchableOpacity style={styles.emojiIcon} onPress={handleEmojiPanel}>
    <View>
      <Ionicons name="happy-outline" size={32} color={colors.teal} />
    </View>
  </TouchableOpacity>
);

function Chat({ route }) {
  const [messages, setMessages] = useState([]);
  const [modal, setModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, setUserLanguage] = useState('en');

  useEffect(() => {
    const fetchUserLanguage = async () => {
      const userDoc = await getDoc(doc(database, 'users', auth?.currentUser?.email));
      if (userDoc.exists()) {
        setUserLanguage(userDoc.data().language || 'en');
      }
    };
    fetchUserLanguage();
  }, []);

  useEffect(() => {
    const fetchUserLanguage = async () => {
      const userDoc = await getDoc(doc(database, 'users', auth?.currentUser?.email));
      return userDoc.exists() ? userDoc.data().language : 'en';
    };

    const unsubscribe = onSnapshot(doc(database, 'chats', route.params.id), async (document) => {
      const userLang = await fetchUserLanguage();

      const chatMessages = await Promise.all(
        document.data().messages.map(async (message) => {
          const createdAt = message.createdAt?.toDate?.() || new Date();

          if (message.language !== userLang) {
            const translatedText = await translateText(message.originalText, userLang);
            return { ...message, translatedText, createdAt };
          }

          return { ...message, createdAt };
        })
      );

      setMessages(chatMessages);
    });

    return () => unsubscribe();
  }, [route.params.id]);
  // useEffect(() => {
  //   const fetchUserLanguage = async () => {
  //     const userDoc = await getDoc(doc(database, 'users', auth?.currentUser?.email));
  //     return userDoc.exists() ? userDoc.data().language : 'en';
  //   };

  //   const unsubscribe = onSnapshot(doc(database, 'chats', route.params.id), async (document) => {
  //     const userLang = await fetchUserLanguage();

  //     const chatMessages = await Promise.all(
  //       document.data().messages.map(async (message) => {
  //         const createdAt = message.createdAt?.toDate?.() || new Date();

  //         // Check if translation is needed
  //         if (message.language !== userLang) {
  //           // If message already has translatedText for this language, skip translation
  //           if (!message.translatedText) {
  //             const translatedText = await translateText(message.originalText, userLang);
  //             return { ...message, translatedText, createdAt };
  //           }
  //         }

  //         return { ...message, createdAt };
  //       })
  //     );

  //     setMessages(chatMessages);
  //   });

  //   return () => unsubscribe();
  // }, [route.params.id]);

  const translateText = async (text, targetLanguage) => {
    try {
      const response = await fetch(`${link}/translate_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: text,
          requested_language: targetLanguage,
        }),
      });
      const data = await response.json();
      return data.translatedText || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const onSend = useCallback(
    async (m = []) => {
      if (m.length === 0) return;

      const originalText = m[0].text;

      const chatDoc = await getDoc(doc(database, 'chats', route.params.id));
      const chatData = chatDoc.data();
      const receiverLanguage = chatData?.receiverLanguage || 'en';

      const translatedText = await translateText(originalText, receiverLanguage);

      const messageWithTranslation = {
        ...m[0],
        sent: true,
        received: false,
        originalText,
        translatedText,
        language: receiverLanguage,
        createdAt: new Date(),
      };

      const chatMessages = GiftedChat.append(chatData.messages || [], [messageWithTranslation]);

      await setDoc(
        doc(database, 'chats', route.params.id),
        {
          messages: chatMessages,
          lastUpdated: Date.now(),
        },
        { merge: true }
      );
    },
    [route.params.id]
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      await uploadImageAsync(result.assets[0].uri);
    }
  };

  const uploadImageAsync = async (uri) => {
    setUploading(true);
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

    const randomString = uuid.v4();
    const fileRef = ref(getStorage(), randomString);
    const uploadTask = uploadBytesResumable(fileRef, blob);

    uploadTask.on(
      'state_changed',
      null,
      (error) => console.log(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        setUploading(false);
        onSend([
          {
            _id: randomString,
            createdAt: new Date(),
            text: '',
            image: downloadUrl,
            user: {
              _id: auth?.currentUser?.email,
              name: auth?.currentUser?.displayName,
            },
          },
        ]);
      }
    );
  };

  const handleEmojiPanel = useCallback(() => {
    setModal((prevModal) => {
      Keyboard.dismiss();
      return !prevModal;
    });
  }, []);

  const analyzeTodayMessages = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayMessages = messages
      .filter((msg) => msg.createdAt >= today && msg.text)
      .map((msg) => msg.originalText || msg.text);

    if (todayMessages.length === 0) {
      Alert.alert('Sentiment Analysis', 'No messages from today to analyze.');
      return;
    }

    try {
      const response = await fetch(`${link}/predict_sentiment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: todayMessages }),
      });

      const data = await response.json();
      Alert.alert(
        'Sentiment Analysis',
        `Today's chat sentiment is: ${data.positive}% positive, ${data.neutral}% neutral and ${data.negative}% negative`
      );
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      console.log(todayMessages);
      Alert.alert('Sentiment Analysis', 'Error analyzing sentiment.');
    }
  };

  // const analyzeTodayMessages = async () => {
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0);

  //   const todayMessages = messages
  //     .filter((msg) => msg.createdAt >= today && msg.text)
  //     .map((msg) => msg.originalText || msg.text);

  //   if (todayMessages.length === 0) {
  //     Alert.alert('Sentiment Analysis', 'No messages from today to analyze.');
  //     return;
  //   }

  //   try {
  //     // 🧪 MOCKED response (instead of calling real API)
  //     console.log('[Mock] Analyzing:', todayMessages);

  //     // Fake logic: if any message contains "sad", return negative
  //     let sentiment = 'neutral';
  //     if (todayMessages.some((text) => text.toLowerCase().includes('sad'))) {
  //       sentiment = 'negative';
  //     } else if (todayMessages.some((text) => text.toLowerCase().includes('love'))) {
  //       sentiment = 'positive';
  //     }

  //     // Show popup with fake result
  //     Alert.alert('Sentiment Analysis', `Mocked sentiment result: ${sentiment}`);
  //   } catch (error) {
  //     console.error('Sentiment mock error:', error);
  //     Alert.alert('Sentiment Analysis', 'Error analyzing sentiment.');
  //   }
  // };

  return (
    <>
      {uploading && RenderLoadingUpload()}

      {/* ➕ Floating Button to Trigger Sentiment Analysis */}
      <TouchableOpacity style={styles.sentimentButton} onPress={analyzeTodayMessages}>
        <Ionicons name="stats-chart" size={24} color="white" />
      </TouchableOpacity>

      <GiftedChat
        messages={messages}
        showAvatarForEveryMessage={false}
        showUserAvatar={false}
        onSend={(messagesArr) => onSend(messagesArr)}
        imageStyle={{ height: 212, width: 212 }}
        messagesContainerStyle={{ backgroundColor: '#fff' }}
        textInputStyle={{ backgroundColor: '#fff', borderRadius: 20 }}
        user={{
          _id: auth?.currentUser?.email,
          name: auth?.currentUser?.displayName,
        }}
        renderBubble={(props) => RenderBubble(props)}
        renderSend={(props) => RenderAttach({ ...props, onPress: pickImage })}
        renderUsernameOnMessage
        renderAvatarOnTop
        renderInputToolbar={(props) => RenderInputToolbar(props, handleEmojiPanel)}
        minInputToolbarHeight={56}
        scrollToBottom
        onPressActionButton={handleEmojiPanel}
        scrollToBottomStyle={styles.scrollToBottomStyle}
        renderLoading={RenderLoading}
      />

      {modal && (
        <EmojiModal
          onPressOutside={handleEmojiPanel}
          modalStyle={styles.emojiModal}
          containerStyle={styles.emojiContainerModal}
          backgroundStyle={styles.emojiBackgroundModal}
          columns={5}
          emojiSize={66}
          activeShortcutColor={colors.primary}
          onEmojiSelected={(emoji) => {
            onSend([
              {
                _id: uuid.v4(),
                createdAt: new Date(),
                text: emoji,
                user: {
                  _id: auth?.currentUser?.email,
                  name: auth?.currentUser?.displayName,
                },
              },
            ]);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addImageIcon: {
    borderRadius: 16,
    bottom: 8,
    height: 32,
    width: 32,
  },
  emojiBackgroundModal: {},
  emojiContainerModal: {
    height: 348,
    width: 396,
  },
  emojiIcon: {
    borderRadius: 16,
    bottom: 5,
    height: 32,
    marginLeft: 4,
    width: 32,
  },
  emojiModal: {},
  inputToolbar: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: colors.grey,
    borderRadius: 22,
    borderWidth: 0.5,
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainerUpload: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 999,
  },
  scrollToBottomStyle: {
    borderColor: colors.grey,
    borderRadius: 28,
    borderWidth: 1,
    bottom: 12,
    height: 56,
    position: 'absolute',
    right: 12,
    width: 56,
  },
  sendIconContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: colors.grey,
    borderRadius: 22,
    borderWidth: 0.5,
    height: 44,
    justifyContent: 'center',
    marginRight: 8,
    width: 44,
  },
  sentimentButton: {
    backgroundColor: colors.teal,
    borderRadius: 28,
    left: 5,
    padding: 10,
    position: 'absolute',
    top: 300,
    zIndex: 999,
  },
});

Chat.propTypes = {
  route: PropTypes.object.isRequired,
};

export default Chat;

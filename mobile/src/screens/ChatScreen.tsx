import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIdentityKeyPair } from '../crypto/keys';
import { getRatchetState, getChatMessages, saveChatMessage, getUserId, deleteChatMessage, deleteChatHistory } from '../storage/db';
import sodium from 'libsodium-wrappers';
import { messageService } from '../services/MessageService';

import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageBubble, Message } from '../components/chat/MessageBubble';
import { MessageInput } from '../components/chat/MessageInput';
import { SystemMessage } from '../components/chat/SystemMessage';

export const ChatScreen = ({ route, navigation }: any) => {
  const { peerId, peerUsername } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking security...');
  const [timer, setTimer] = useState<number>(0); 
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const myKeysRef = useRef<any>(null);
  const myIdRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleDeleteChat = () => {
      Alert.alert(
          "Clear Chat",
          "Are you sure you want to delete all messages? This will also reset the E2EE secure channel.",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive", 
                  onPress: async () => {
                      await deleteChatHistory(peerId);
                      setMessages([]);
                      setSessionActive(false);
                      setStatusMessage("Secure channel reset. Type to reconnect.");
                  } 
              }
          ]
      );
  };

  useEffect(() => {
    // Hide the default React Navigation header so we can use our custom modular ChatHeader
    navigation.setOptions({ headerShown: false });

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    // 1. Initialize: ensure session + load messages
    (async () => {
      await sodium.ready;

      const keys = await getIdentityKeyPair();
      myKeysRef.current = keys;
      const myId = await getUserId();
      myIdRef.current = myId;

      const storedMsgs = await getChatMessages(peerId);
      setMessages(storedMsgs.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp)
      })));

      setStatusMessage('Establishing secure channel...');
      const ready = await messageService.ensureSession(peerId);
      if (ready) {
          setSessionActive(true);
          setStatusMessage('');
      } else {
          setStatusMessage('Could not fetch peer keys. Check connection.');
      }
    })();

    // 2. UI listener: refresh messages + session status whenever MessageService processes something
    const loadMessages = async () => {
        const loadedState = await getRatchetState(peerId);
        if (loadedState) {
            setSessionActive(true);
            setStatusMessage('');
        } else {
            setSessionActive(false);
            setStatusMessage('Re-establishing secure channel...');
        }

        const storedMsgs = await getChatMessages(peerId);
        setMessages(storedMsgs.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
        })));
    };

    messageService.addUIListener(loadMessages);

    // 3. Cleanup expired messages every second
    const cleanupInterval = setInterval(async () => {
        const now = new Date();
        setMessages(prev => {
            const expired = prev.filter(m => m.expiresAt && new Date(m.expiresAt) <= now);
            if (expired.length > 0) {
                expired.forEach(m => deleteChatMessage(peerId, m.id));
                return prev.filter(m => !(m.expiresAt && new Date(m.expiresAt) <= now));
            }
            return prev;
        });
    }, 1000);

    return () => {
        messageService.removeUIListener(loadMessages);
        clearInterval(cleanupInterval);
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const plaintext = inputText.trim();
    setInputText('');

    try {
        await messageService.encryptAndSendMessage(peerId, plaintext, timer);

        let expiresAt: string | undefined;
        if (timer > 0) {
            expiresAt = new Date(Date.now() + timer * 1000).toISOString();
        }

        const newMsg: Message = {
            id: Date.now().toString(),
            text: plaintext,
            isSender: true,
            timestamp: new Date(),
            expiresAt
        };

        await saveChatMessage(peerId, {
            ...newMsg,
            timestamp: newMsg.timestamp.toISOString(),
            expiresAt
        } as any);

        setMessages(prev => [...prev, newMsg]);
        setSessionActive(true);
        setStatusMessage('');
    } catch(e) {
       console.error("Send failed:", e);
       setStatusMessage('Send failed. Retrying...');
       messageService.ensureSession(peerId).then(ready => {
           if (ready) {
               setSessionActive(true);
               setStatusMessage('');
           }
       });
    }
  };

  const cycleTimer = () => {
    const options = [0, 5, 30, 60, 3600];
    const currentIndex = options.indexOf(timer);
    const nextIndex = (currentIndex + 1) % options.length;
    setTimer(options[nextIndex]);
  };

  const renderItem = React.useCallback(({ item }: { item: Message }) => {
    return <MessageBubble message={item} isAnonymousMode={isAnonymousMode} peerUsername={peerUsername} />;
  }, [isAnonymousMode, peerUsername]);

  return (
    <View style={[styles.container, isAnonymousMode && styles.anonymousContainer]}>
      <ChatHeader 
        peerUsername={peerUsername}
        sessionActive={sessionActive}
        statusMessage={statusMessage}
        isAnonymousMode={isAnonymousMode}
        onClear={handleDeleteChat}
        onToggleAnonymous={() => setIsAnonymousMode(!isAnonymousMode)}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          inverted
          ListFooterComponent={
              <View>
                {!sessionActive && statusMessage !== '' && (
                    <SystemMessage text={statusMessage} isAnonymousMode={isAnonymousMode} />
                )}
                {messages.length === 0 && sessionActive && (
                    <SystemMessage 
                        text={isAnonymousMode ? "Start an anonymous conversation 👻" : "Start the conversation \nSend your first message"} 
                        isAnonymousMode={isAnonymousMode} 
                    />
                )}
              </View>
          }
        />

        <MessageInput 
          inputText={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          sessionActive={sessionActive}
          isAnonymousMode={isAnonymousMode}
          timer={timer}
          onCycleTimer={cycleTimer}
          heightOffset={keyboardVisible ? 10 : Math.max(insets.bottom, 10)}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  anonymousContainer: {
    backgroundColor: '#030008',
  },
  keyboardView: { 
    flex: 1,
  },
  messageList: { 
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
});

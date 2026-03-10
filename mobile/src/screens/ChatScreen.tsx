import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createHandshakeInit } from '../crypto/handshake';
import { getIdentityKeyPair, generateIdentityKeyPair } from '../crypto/keys';
import { socketService } from '../services/socket';
import { getRatchetState, saveRatchetState, getChatMessages, saveChatMessage, LocalMessage, getUserId, deleteChatMessage } from '../storage/db';
import sodium from 'libsodium-wrappers';
import { messageService } from '../services/MessageService';

interface Message {
  id: string;
  text: string;
  isSender: boolean;
  timestamp: Date;
}

export const ChatScreen = ({ route }: any) => {
  const { peerId, peerUsername } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking security...');
  const [timer, setTimer] = useState<number>(0); 
  const insets = useSafeAreaInsets();
  const myKeysRef = useRef<any>(null);
  const myIdRef = useRef<string | null>(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    // 1. Initialize Sodium and load any existing Ratchet state + messages from DB
    const initChat = async () => {
      await sodium.ready;

      myIdRef.current = await getUserId();
      let keys = await getIdentityKeyPair();
      if (!keys) {
          keys = await generateIdentityKeyPair();
      }
      myKeysRef.current = keys;
      
      const loadedState = await getRatchetState(peerId);
      if (loadedState) {
          setSessionActive(true);
          setStatusMessage('');
      } else {
          setStatusMessage('Initiating secure handshake...');
          // Generate fresh ephemeral ratchet key for this session
          const ratchetKeys = sodium.crypto_box_keypair();
          const handshake = await createHandshakeInit(myIdRef.current!, peerId, keys, ratchetKeys);
          socketService.sendHandshake(peerId, handshake);
      }

      const storedMsgs = await getChatMessages(peerId);
      if (storedMsgs.length > 0) {
          setMessages(storedMsgs.map(m => ({
              ...m,
              timestamp: new Date(m.timestamp)
          })));
      }
    };
    
    initChat();


    const loadMessages = async () => {
        // 1. Reload Ratchet State to see if a background handshake finished
        const loadedState = await getRatchetState(peerId);
        if (loadedState) {
            if (!sessionActive) {
                setSessionActive(true);
                setStatusMessage('');
            }
        }

        // 2. Load messages
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
            const expired = prev.filter(m => (m as any).expiresAt && new Date((m as any).expiresAt) <= now);
            if (expired.length > 0) {
                expired.forEach(m => deleteChatMessage(peerId, m.id));
                return prev.filter(m => !((m as any).expiresAt && new Date((m as any).expiresAt) <= now));
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
    if (!inputText.trim() || !sessionActive) return;
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
        } as any;

        await saveChatMessage(peerId, {
            ...newMsg,
            timestamp: newMsg.timestamp.toISOString(),
            expiresAt
        });

        setMessages(prev => [...prev, newMsg]);

    } catch(e) {
       console.error("Encryption failed:", e); 
    }
  };

  const renderItem = React.useCallback(({ item }: { item: Message }) => {
    const isExpired = (item as any).expiresAt && new Date((item as any).expiresAt) <= new Date();
    if (isExpired) return null;

    return (
        <View style={[styles.messageBubble, item.isSender ? styles.senderBubble : styles.receiverBubble]}>
        <Text style={[styles.messageText, item.isSender ? styles.senderText : styles.receiverText]}>
            {item.text}
        </Text>
        {(item as any).expiresAt && (
            <Text style={{ fontSize: 10, color: '#ff4444', marginTop: 4 }}>
                Destructs in {Math.max(0, Math.round((new Date((item as any).expiresAt).getTime() - Date.now()) / 1000))}s
            </Text>
        )}
        </View>
    );
  }, []);

  const cycleTimer = () => {
    const options = [0, 5, 30, 60, 3600];
    const currentIndex = options.indexOf(timer);
    const nextIndex = (currentIndex + 1) % options.length;
    setTimer(options[nextIndex]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
      >
        <View style={styles.header}>
            <Text style={styles.headerTitle}>{peerUsername}</Text>
            {sessionActive ? (
                <View style={styles.secureBadge}>
                    <Text style={styles.secureText}>E2EE ACTIVE</Text>
                </View>
            ) : (
                <Text style={styles.statusText}>{statusMessage}</Text>
            )}
        </View>

        {!sessionActive && (
             <View style={styles.warningBox}>
                <Text style={styles.warningText}>Securing Channel...</Text>
             </View>
        )}

        <FlatList
          data={[...messages].reverse()} // Reverse for inverted list
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          inverted
        />

        <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity onPress={cycleTimer} style={styles.timerButton}>
             <Text style={styles.timerText}>{timer === 0 ? "∞" : `${timer}s`}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="G-SEC Secure message..."
            placeholderTextColor="#666"
            editable={sessionActive}
            multiline
          />
          <TouchableOpacity 
            onPress={sendMessage} 
            disabled={!sessionActive || !inputText.trim()} 
            style={[styles.sendBtn, (!sessionActive || !inputText.trim()) && styles.disabledBtn]}
          >
            <Text style={styles.sendBtnText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  keyboardView: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  secureBadge: { backgroundColor: '#004d00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  secureText: { color: '#0f0', fontSize: 10, fontWeight: 'bold' },
  statusText: { color: '#888', fontSize: 12 },
  warningBox: { backgroundColor: '#331111', padding: 8, alignItems: 'center' },
  warningText: { color: '#ff4444', fontWeight: 'bold', fontSize: 12 },
  messageList: { padding: 15 },
  messageBubble: { maxWidth: '85%', padding: 12, borderRadius: 18, marginVertical: 6 },
  senderBubble: { alignSelf: 'flex-end', backgroundColor: '#0f0', borderBottomRightRadius: 4 },
  receiverBubble: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  senderText: { color: '#000' },
  receiverText: { color: '#fff' },
  inputContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#222', 
    alignItems: 'center',
    backgroundColor: '#000'
  },
  input: { 
    flex: 1, 
    backgroundColor: '#111', 
    color: '#fff', 
    paddingHorizontal: 15, 
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, 
    borderRadius: 22, 
    marginRight: 10,
    maxHeight: 120 
  },
  timerButton: { padding: 10, backgroundColor: '#1a1a1a', borderRadius: 25, marginRight: 8, minWidth: 45, alignItems: 'center' },
  timerText: { color: '#0f0', fontWeight: 'bold', fontSize: 14 },
  sendBtn: { backgroundColor: '#0f0', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20 },
  disabledBtn: { backgroundColor: '#333' },
  sendBtnText: { color: '#000', fontWeight: 'bold' },
  headerTitle: { color: '#0f0', fontSize: 18, fontWeight: 'bold' }
});

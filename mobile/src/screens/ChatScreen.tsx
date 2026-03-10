import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity } from 'react-native';
import { ratchetEncrypt, ratchetDecrypt, RatchetState, RatchetMessageHeader } from '../crypto/ratchet';
import { createHandshakeInit, createHandshakeResponse, processHandshake, HandshakeMessage } from '../crypto/handshake';
import { getIdentityKeyPair, generateIdentityKeyPair } from '../crypto/keys';
import { socketService } from '../services/socket';
import { getRatchetState, saveRatchetState, getChatMessages, saveChatMessage, LocalMessage, getUserId, deleteChatMessage } from '../storage/db';
import sodium from 'libsodium-wrappers';

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
  const [timer, setTimer] = useState<number>(0); // 0 = disabled
  const ratchetStateRef = useRef<RatchetState | null>(null);
  const myKeysRef = useRef<any>(null);
  const myIdRef = useRef<string | null>(null);
  const handshakePendingRef = useRef(false);

  useEffect(() => {
    // 1. Initialize Sodium and load any existing Ratchet state + messages from DB
    const initChat = async () => {
      await sodium.ready;
      socketService.connect();

      myIdRef.current = await getUserId();
      let keys = await getIdentityKeyPair();
      if (!keys) {
          keys = await generateIdentityKeyPair();
      }
      myKeysRef.current = keys;
      
      const loadedState = await getRatchetState(peerId);
      if (loadedState) {
          ratchetStateRef.current = loadedState;
          setSessionActive(true);
          setStatusMessage('');
      } else {
          setStatusMessage('Initiating secure handshake...');
          // Let's send a handshake init if we don't have a state
          if (!handshakePendingRef.current) {
              const handshake = await createHandshakeInit(myIdRef.current!, keys, keys); // Using identity key as initial ratchet key for simplification
              socketService.sendHandshake(peerId, handshake);
              handshakePendingRef.current = true;
          }
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

    // 2. Listen to incoming WebSockets
    const handleIncomingMessage = async (payload: any) => {
        if (payload.type === 'key_exchange' || payload.type === 'key_exchange_response') {
            console.log(`[Handshake] Received ${payload.type} from ${payload.senderId}`);
            
            if (!myKeysRef.current || !myIdRef.current) return;

            const isInitiator = payload.type === 'key_exchange_response';
            const { state } = await processHandshake(payload, myKeysRef.current, myKeysRef.current, isInitiator);
            
            ratchetStateRef.current = state;
            await saveRatchetState(peerId, state);
            setSessionActive(true);
            setStatusMessage('');

            if (payload.type === 'key_exchange') {
                // Respond to their init
                const response = await createHandshakeResponse(myIdRef.current, myKeysRef.current, myKeysRef.current);
                socketService.sendHandshake(peerId, response);
            }
            return;
        }

        if (payload.type !== 'chat_message') return;
        if (!ratchetStateRef.current) {
            console.warn("Received chat message but no E2EE session active. Ignoring.");
            return;
        }
        
        try {
            // Convert flat arrays back to Uint8Arrays for cryptography
            const ciphertext = new Uint8Array(payload.ciphertext);
            const header: RatchetMessageHeader = {
                DHs: new Uint8Array(payload.header.DHs),
                pn: payload.header.pn,
                n: payload.header.n
            };

            const dec = await ratchetDecrypt(ratchetStateRef.current, header, ciphertext, sodium.from_string("g-sec-chat"));
            ratchetStateRef.current = dec.state;
            
            // Persist the ratcheted state securely
            await saveRatchetState(peerId, ratchetStateRef.current);

            const incomingText = sodium.to_string(dec.plaintext);
            console.log(`[Ratchet] Decrypted message: "${incomingText}" (Length: ${incomingText.length})`);
            
            let expiresAt: string | undefined;
            if (payload.timer && payload.timer > 0) {
                expiresAt = new Date(Date.now() + payload.timer * 1000).toISOString();
            }

            const newMsg: Message = {
                id: Date.now().toString(),
                text: incomingText,
                isSender: false,
                timestamp: new Date(),
                expiresAt
            } as any;

            await saveChatMessage(peerId, {
                ...newMsg,
                timestamp: newMsg.timestamp.toISOString(),
                expiresAt
            });

            setMessages(prev => [...prev, newMsg]);
            
        } catch (e) {
            console.error("Failed to decrypt incoming message", e);
        }
    };

    socketService.addListener(handleIncomingMessage);

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
        socketService.removeListener(handleIncomingMessage);
        clearInterval(cleanupInterval);
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || !ratchetStateRef.current) return;
    const plaintext = inputText.trim();
    setInputText('');
    
    try {
        const ad = sodium.from_string("g-sec-chat");
        const enc = await ratchetEncrypt(ratchetStateRef.current, sodium.from_string(plaintext), ad);
        
        // Update local ratchet state and persist
        ratchetStateRef.current = enc.state;
        await saveRatchetState(peerId, ratchetStateRef.current);
        
        // Serialize header for JSON
        const flatHeader = {
            DHs: Array.from(enc.header.DHs),
            pn: enc.header.pn,
            n: enc.header.n
        };

        socketService.sendChatMessage(peerId, enc.ciphertext, flatHeader, timer);
        
        console.log(`[Ratchet] Encrypted and sending (Timer: ${timer}s): "${plaintext}"`);

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {!sessionActive && (
             <View style={styles.warningBox}>
                <Text style={styles.warningText}>{statusMessage}</Text>
                <Text style={styles.subWarning}>Secure P2P Signaling in Progress</Text>
             </View>
        )}
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
        />
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={cycleTimer} style={styles.timerButton}>
             <Text style={styles.timerText}>{timer === 0 ? "∞" : `${timer}s`}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Secure message..."
            placeholderTextColor="#666"
            editable={sessionActive}
          />
          <Button title="Send" onPress={sendMessage} disabled={!sessionActive || !inputText.trim()} color="#0f0" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  keyboardView: { flex: 1 },
  warningBox: { backgroundColor: '#331111', padding: 15, alignItems: 'center' },
  warningText: { color: '#ff4444', fontWeight: 'bold' },
  subWarning: { color: '#aa3333', fontSize: 12 },
  messageList: { padding: 15, paddingBottom: 20 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginVertical: 4 },
  senderBubble: { alignSelf: 'flex-end', backgroundColor: '#004d00', borderBottomRightRadius: 4 },
  receiverBubble: { alignSelf: 'flex-start', backgroundColor: '#333', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 20 },
  senderText: { color: '#0f0' },
  receiverText: { color: '#fff' },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
  timerButton: { padding: 8, backgroundColor: '#222', borderRadius: 20, marginRight: 8, minWidth: 40, alignItems: 'center' },
  timerText: { color: '#0f0', fontWeight: 'bold' }
});

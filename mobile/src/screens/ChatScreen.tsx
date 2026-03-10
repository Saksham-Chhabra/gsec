import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import sodium from 'libsodium-wrappers';
import { ratchetEncrypt, ratchetDecrypt, RatchetState, RatchetMessageHeader } from '../crypto/ratchet';
import { socketService } from '../services/socket';
import { getRatchetState, saveRatchetState, getChatMessages, saveChatMessage, LocalMessage } from '../storage/db';

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
  const ratchetStateRef = useRef<RatchetState | null>(null);

  useEffect(() => {
    // 1. Initialize Sodium and load any existing Ratchet state + messages from DB
    const initChat = async () => {
      await sodium.ready;
      socketService.connect();
      
      const loadedState = await getRatchetState(peerId);
      if (loadedState) {
          ratchetStateRef.current = loadedState;
          setSessionActive(true);
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
        if (!ratchetStateRef.current) return;
        
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
            
            const newMsg: Message = {
                id: Date.now().toString(),
                text: incomingText,
                isSender: false,
                timestamp: new Date()
            };

            await saveChatMessage(peerId, {
                ...newMsg,
                timestamp: newMsg.timestamp.toISOString()
            });

            setMessages(prev => [...prev, newMsg]);
            
        } catch (e) {
            console.error("Failed to decrypt incoming message", e);
        }
    };

    socketService.addListener(handleIncomingMessage);

    return () => {
        socketService.removeListener(handleIncomingMessage);
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

        socketService.sendChatMessage(peerId, enc.ciphertext, flatHeader);
        
        console.log(`[Ratchet] Encrypted and sending: "${plaintext}" (Length: ${plaintext.length})`);

        const newMsg: Message = {
            id: Date.now().toString(),
            text: plaintext,
            isSender: true,
            timestamp: new Date()
        };

        await saveChatMessage(peerId, {
            ...newMsg,
            timestamp: newMsg.timestamp.toISOString()
        });

        setMessages(prev => [...prev, newMsg]);

    } catch(e) {
       console.error("Encryption failed:", e); 
    }
  };

  const renderItem = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.isSender ? styles.senderBubble : styles.receiverBubble]}>
      <Text style={[styles.messageText, item.isSender ? styles.senderText : styles.receiverText]}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {!sessionActive && (
             <View style={styles.warningBox}>
                <Text style={styles.warningText}>No Active E2EE Session Found.</Text>
                <Text style={styles.subWarning}>Waiting for Key Exchange (Task 5.1)</Text>
             </View>
        )}
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
        />
        <View style={styles.inputContainer}>
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
  input: { flex: 1, backgroundColor: '#111', color: '#fff', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10 }
});

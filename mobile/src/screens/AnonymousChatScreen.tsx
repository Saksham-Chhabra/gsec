import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageInput } from '../components/chat/MessageInput';
import { MessageBubble } from '../components/chat/MessageBubble';
import { SystemMessage } from '../components/chat/SystemMessage';
import { getAnonymousRoomDetails, leaveAnonymousRoom, pollAnonymousMessages, sendAnonymousMessage } from '../services/api';

export const AnonymousChatScreen = ({ route, navigation }: any) => {
    const { roomId, myIdentity } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [members, setMembers] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);
    const pollTimerRef = useRef<any>(null);
    const lastPollRef = useRef<number>(0);

    // Load room details on mount
    useEffect(() => {
        let mounted = true;
        const loadRoom = async () => {
            const data = await getAnonymousRoomDetails(roomId);
            if (data && mounted) setMembers(data.members);
        };
        loadRoom();
        return () => { mounted = false; };
    }, [roomId]);

    // HTTP Polling for messages
    useEffect(() => {
        let active = true;

        const poll = async () => {
            if (!active) return;
            try {
                const newMsgs = await pollAnonymousMessages(roomId, lastPollRef.current);
                if (newMsgs.length > 0 && active) {
                    const otherMsgs = newMsgs
                        .filter((m: any) => m.senderId !== myIdentity || !messages.some(prev => prev.id === m.id.toString()))
                        .map((m: any) => ({
                            id: m.id.toString(),
                            content: m.text,
                            senderId: m.senderId,
                            timestamp: m.timestamp,
                            isMe: m.senderId === myIdentity,
                        }));

                    if (otherMsgs.length > 0) {
                        setMessages(prev => {
                            // Deduplicate
                            const existingIds = new Set(prev.map(p => p.id));
                            const uniqueNew = otherMsgs.filter(o => !existingIds.has(o.id));
                            if (uniqueNew.length === 0) return prev;
                            return [...prev, ...uniqueNew];
                        });
                    }

                    // Update poll cursor
                    const maxTs = Math.max(...newMsgs.map((m: any) => m.timestamp));
                    lastPollRef.current = maxTs;
                }
            } catch (e) {
                console.error('[AnonChat] Poll error:', e);
            }
        };

        pollTimerRef.current = setInterval(poll, 2000);
        poll(); 

        return () => {
            active = false;
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [roomId, myIdentity]);

    // Security: leave room on app background
    useEffect(() => {
        const sub = AppState.addEventListener('change', async (nextState) => {
            if (nextState !== 'active') {
                await leaveAnonymousRoom(roomId);
                navigation.navigate('Login');
            }
        });
        return () => sub.remove();
    }, []);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const text = inputText.trim();
        setInputText('');

        try {
            await sendAnonymousMessage(roomId, text);
            // The poll will pick it up or we can add it optimistically
        } catch (e) {
            console.error('[AnonChat] Send failed:', e);
            Alert.alert('Send Failed', 'Could not deliver message.');
        }
    };

    const handleLeave = async () => {
        Alert.alert(
            'Leave Room?',
            'Once you leave, this session is permanently destroyed for you.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Leave', 
                    style: 'destructive',
                    onPress: async () => {
                        await leaveAnonymousRoom(roomId);
                        navigation.navigate('Friends');
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleLeave} style={styles.backBtn}>
                    <Text style={styles.leaveText}>🏃 Leave</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title}>Room: {roomId}</Text>
                    <Text style={styles.subtitle}>{members.length} Entity(s) present</Text>
                </View>
                <View style={styles.identityBadge}>
                    <Text style={styles.identityText}>You: {myIdentity.split('-')[0]}</Text>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListHeaderComponent={
                    <SystemMessage 
                        text={`Privacy First.\nYou are known here only as ${myIdentity}.\nThis room self-destructs 5 minutes after everyone leaves.`} 
                        isAnonymousMode={true} 
                    />
                }
                renderItem={({ item }) => (
                    <MessageBubble 
                        message={{
                            id: item.id,
                            text: item.content,
                            isSender: item.isMe,
                            timestamp: new Date(item.timestamp)
                        }} 
                        isAnonymousMode={true} 
                        senderName={item.isMe ? 'You' : item.senderId}
                    />
                )}
            />

            <MessageInput 
                inputText={inputText}
                onChangeText={setInputText}
                onSend={handleSend} 
                isAnonymousMode={true} 
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#12001A' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#1E0B2D',
        borderBottomWidth: 1,
        borderBottomColor: '#3B1A54',
    },
    backBtn: { padding: 5 },
    leaveText: { color: '#ff4444', fontSize: 15, fontWeight: 'bold' },
    headerCenter: { alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
    subtitle: { fontSize: 12, color: '#A892BA', marginTop: 2 },
    identityBadge: {
        backgroundColor: '#3B1A54',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    identityText: { color: '#E0C2FF', fontSize: 11, fontWeight: '700' },
    listContent: { paddingVertical: 20 },
});

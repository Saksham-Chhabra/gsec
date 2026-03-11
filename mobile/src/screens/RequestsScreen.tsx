import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getIncomingFriendRequests, respondToFriendRequest } from '../services/api';

interface FriendRequestItem {
    id: string;
    senderId: string;
    senderUsername: string;
    createdAt: string;
}

export const RequestsScreen = ({ navigation }: any) => {
    const [requests, setRequests] = useState<FriendRequestItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadRequests = useCallback(async () => {
        const data = await getIncomingFriendRequests();
        setRequests(data);
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadRequests();
        setRefreshing(false);
    };

    const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
        const success = await respondToFriendRequest(requestId, action);
        if (success) {
            Alert.alert('Done', action === 'accept' ? 'Friend added!' : 'Request rejected.');
            setRequests(prev => prev.filter(r => r.id !== requestId));
        } else {
            Alert.alert('Error', 'Could not process request. Try again.');
        }
    };

    const renderRequest = ({ item }: { item: FriendRequestItem }) => (
        <View style={styles.requestCard}>
            <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.senderUsername.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.nameContainer}>
                    <Text style={styles.username}>{item.senderUsername}</Text>
                    <Text style={styles.timestamp}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity 
                    style={styles.acceptBtn} 
                    onPress={() => handleRespond(item.id, 'accept')}
                >
                    <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.rejectBtn} 
                    onPress={() => handleRespond(item.id, 'reject')}
                >
                    <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Friend Requests</Text>
                <View style={{ width: 80 }} />
            </View>

            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderRequest}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f0" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={styles.emptyTitle}>No pending requests</Text>
                        <Text style={styles.emptySubtitle}>When someone adds you, it'll appear here</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 80,
    },
    backText: {
        color: '#0f0',
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    listContent: {
        paddingTop: 8,
        flexGrow: 1,
    },
    requestCard: {
        backgroundColor: '#0a0a0a',
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    avatarText: {
        color: '#0f0',
        fontSize: 18,
        fontWeight: 'bold',
    },
    nameContainer: {
        flex: 1,
    },
    username: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    timestamp: {
        color: '#555',
        fontSize: 12,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    acceptBtn: {
        backgroundColor: '#004d00',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 10,
    },
    acceptText: {
        color: '#0f0',
        fontWeight: '700',
        fontSize: 14,
    },
    rejectBtn: {
        backgroundColor: '#220000',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
    },
    rejectText: {
        color: '#ff4444',
        fontWeight: '700',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    emptySubtitle: {
        color: '#666',
        fontSize: 14,
        marginTop: 6,
    },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFriendsList, getIncomingFriendRequests, PeerUser } from '../services/api';

export const FriendsListScreen = ({ navigation }: any) => {
    const [friends, setFriends] = useState<PeerUser[]>([]);
    const [requestCount, setRequestCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        const [friendsData, requests] = await Promise.all([
            getFriendsList(),
            getIncomingFriendRequests()
        ]);
        setFriends(friendsData);
        setRequestCount(requests.length);
    }, []);

    useEffect(() => {
        loadData();
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [loadData, navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const renderFriend = ({ item }: { item: PeerUser }) => (
        <TouchableOpacity 
            style={styles.friendItem} 
            onPress={() => navigation.navigate('Chat', { peerId: item.id, peerUsername: item.username })}
            activeOpacity={0.7}
        >
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.username}</Text>
                <Text style={styles.friendStatus}>Tap to chat securely</Text>
            </View>
            <Text style={styles.lockIcon}>🔒</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>G-SEC</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => navigation.navigate('Requests')} style={styles.headerBtn}>
                        <Text style={styles.headerBtnText}>
                            📬 {requestCount > 0 ? `(${requestCount})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.headerBtn}>
                        <Text style={styles.headerBtnText}>🔍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerBtn}>
                        <Text style={styles.headerBtnText}>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Anonymous Mode Banner */}
            <TouchableOpacity 
                style={styles.anonBanner} 
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AnonymousGateway')}
            >
                <Text style={styles.anonIcon}>🕶️</Text>
                <View>
                    <Text style={styles.anonTitle}>Enter Anonymous Mode</Text>
                    <Text style={styles.anonSubtitle}>Chat without revealing your identity</Text>
                </View>
            </TouchableOpacity>

            {/* Friends List */}
            <FlatList
                data={friends}
                keyExtractor={item => item.id}
                renderItem={renderFriend}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f0" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>👋</Text>
                        <Text style={styles.emptyTitle}>No friends yet</Text>
                        <Text style={styles.emptySubtitle}>Tap 🔍 to find and add people</Text>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    title: {
        color: '#0f0',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerBtn: {
        padding: 8,
        marginLeft: 8,
    },
    headerBtnText: {
        fontSize: 22,
    },
    anonBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d0714',
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2b1044',
    },
    anonIcon: {
        fontSize: 28,
        marginRight: 16,
    },
    anonTitle: {
        color: '#d488ff',
        fontSize: 16,
        fontWeight: '700',
    },
    anonSubtitle: {
        color: '#7a4aa0',
        fontSize: 12,
        marginTop: 2,
    },
    listContent: {
        paddingTop: 8,
        flexGrow: 1,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    avatarText: {
        color: '#0f0',
        fontSize: 20,
        fontWeight: 'bold',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    friendStatus: {
        color: '#555',
        fontSize: 13,
        marginTop: 3,
    },
    lockIcon: {
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

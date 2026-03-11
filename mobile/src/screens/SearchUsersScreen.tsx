import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchPeerUser, sendFriendRequest, PeerUser } from '../services/api';

export const SearchUsersScreen = ({ navigation }: any) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<PeerUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setSearched(true);
        const users = await searchPeerUser(searchQuery.trim());
        setResults(users);
        setLoading(false);
    };

    const handleAddFriend = async (user: PeerUser) => {
        const success = await sendFriendRequest(user.username);
        if (success) {
            setSentRequests(prev => new Set(prev).add(user.id));
            Alert.alert('Sent!', `Friend request sent to ${user.username}`);
        } else {
            Alert.alert('Error', 'Could not send friend request. Maybe already sent or already friends.');
        }
    };

    const renderResult = ({ item }: { item: PeerUser }) => {
        const alreadySent = sentRequests.has(item.id);
        return (
            <View style={styles.resultItem}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.addBtn, alreadySent && styles.addBtnSent]}
                    onPress={() => !alreadySent && handleAddFriend(item)}
                    disabled={alreadySent}
                >
                    <Text style={[styles.addBtnText, alreadySent && styles.addBtnTextSent]}>
                        {alreadySent ? 'Sent ✓' : 'Add Friend'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Find People</Text>
                <View style={{ width: 80 }} />
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Enter exact username..."
                    placeholderTextColor="#555"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                />
                <TouchableOpacity 
                    style={[styles.searchBtn, (!searchQuery.trim() || loading) && styles.searchBtnDisabled]} 
                    onPress={handleSearch}
                    disabled={!searchQuery.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" size="small" />
                    ) : (
                        <Text style={styles.searchBtnText}>Search</Text>
                    )}
                </TouchableOpacity>
            </View>

            <FlatList
                data={results}
                keyExtractor={item => item.id}
                renderItem={renderResult}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    searched && !loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No user found with that username</Text>
                        </View>
                    ) : null
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#111',
        color: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#222',
    },
    searchBtn: {
        backgroundColor: '#0f0',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 14,
        marginLeft: 10,
    },
    searchBtnDisabled: {
        backgroundColor: '#333',
    },
    searchBtnText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 14,
    },
    listContent: {
        paddingTop: 8,
        flexGrow: 1,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
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
    userInfo: {
        flex: 1,
    },
    username: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    addBtn: {
        backgroundColor: '#004d00',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
    },
    addBtnSent: {
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
    },
    addBtnText: {
        color: '#0f0',
        fontWeight: '700',
        fontSize: 13,
    },
    addBtnTextSent: {
        color: '#555',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
});

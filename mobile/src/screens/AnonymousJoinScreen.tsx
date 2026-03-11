import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { joinAnonymousRoom } from '../services/api';

export const AnonymousJoinScreen = ({ navigation }: any) => {
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        if (!roomId.trim() || !password.trim()) {
            Alert.alert('Required', 'Please enter both Room ID and Password.');
            return;
        }

        setLoading(true);
        try {
            const data = await joinAnonymousRoom(roomId.trim(), password.trim());
            if (data) {
                // Successfully joined
                navigation.replace('AnonymousChat', {
                    roomId: data.roomId,
                    myIdentity: data.myIdentity
                });
            }
        } catch (error: any) {
            Alert.alert('Access Denied', error.message || 'Invalid Room ID or Password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Join Room</Text>
                <View style={{ width: 80 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.iconText}>🎭</Text>
                <Text style={styles.subtitle}>Enter the Shadows</Text>
                <Text style={styles.description}>
                    Provide the Room ID and Password shared with you to connect anonymously.
                </Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Room ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 7XK9A2"
                        placeholderTextColor="#555"
                        value={roomId}
                        onChangeText={setRoomId}
                        autoCapitalize="characters"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 4TLMQ"
                        placeholderTextColor="#555"
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry
                        onSubmitEditing={handleJoin}
                    />

                    <TouchableOpacity 
                        style={[styles.joinBtn, loading && styles.joinBtnDisabled]} 
                        onPress={handleJoin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.joinBtnText}>Join Room</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
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
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2D0040',
    },
    backBtn: { width: 80 },
    backText: { color: '#B266FF', fontSize: 16, fontWeight: '600' },
    title: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        paddingTop: 40,
    },
    iconText: { fontSize: 60, marginBottom: 16 },
    subtitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
    description: {
        color: '#A892BA',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
    },
    form: { width: '100%' },
    label: {
        color: '#B266FF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#1E1E1E',
        color: '#fff',
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 24,
        letterSpacing: 2,
    },
    joinBtn: {
        backgroundColor: '#B266FF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    joinBtnDisabled: {
        backgroundColor: '#5A3380',
    },
    joinBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});

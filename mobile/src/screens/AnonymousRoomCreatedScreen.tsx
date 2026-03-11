import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAnonymousRoom } from '../services/api';

export const AnonymousRoomCreatedScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [roomData, setRoomData] = useState<{ roomId: string, password: string, myIdentity: string } | null>(null);

    useEffect(() => {
        const initRoom = async () => {
            const data = await createAnonymousRoom();
            if (data) {
                setRoomData(data);
            } else {
                Alert.alert('Error', 'Failed to create room.');
                navigation.goBack();
            }
            setLoading(false);
        };
        initRoom();
    }, []);

    const handleShare = async () => {
        if (!roomData) return;
        try {
            await Share.share({
                message: `Join my Anonymous Room on G-SEC!\nID: ${roomData.roomId}\nPassword: ${roomData.password}`,
            });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const handleEnter = () => {
        if (!roomData) return;
        navigation.replace('AnonymousChat', { 
            roomId: roomData.roomId, 
            myIdentity: roomData.myIdentity 
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#B266FF" />
                <Text style={styles.loadingText}>Generating Secure Room...</Text>
            </SafeAreaView>
        );
    }

    if (!roomData) return null;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Discard</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Room Created</Text>
                <View style={{ width: 80 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.iconText}>🔐</Text>
                <Text style={styles.subtitle}>Credentials Generated</Text>
                
                <View style={styles.credentialsBox}>
                    <View style={styles.credRow}>
                        <Text style={styles.credLabel}>Room ID</Text>
                        <Text style={styles.credValue}>{roomData.roomId}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.credRow}>
                        <Text style={styles.credLabel}>Password</Text>
                        <Text style={styles.credValue}>{roomData.password}</Text>
                    </View>
                </View>

                <View style={styles.identityBox}>
                    <Text style={styles.identityLabel}>Your Temporary Identity:</Text>
                    <Text style={styles.identityValue}>{roomData.myIdentity}</Text>
                </View>

                <Text style={styles.warningText}>
                    Share these details securely. Once you enter the room, it will automatically expire if empty for 5 minutes.
                </Text>

                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Text style={styles.shareBtnText}>Share via Normal Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.enterBtn} onPress={handleEnter}>
                    <Text style={styles.enterBtnText}>Enter Room Now</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#12001A' },
    loadingContainer: { flex: 1, backgroundColor: '#12001A', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#B266FF', marginTop: 16, fontSize: 16, fontWeight: '600' },
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
    backText: { color: '#ff4444', fontSize: 16, fontWeight: '600' },
    title: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        paddingTop: 30,
    },
    iconText: { fontSize: 60, marginBottom: 16 },
    subtitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
    credentialsBox: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#444',
        padding: 20,
        marginBottom: 20,
    },
    credRow: {
        flexDirection: 'column',
    },
    credLabel: {
        color: '#888',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    credValue: {
        color: '#0f0', // Neon green for credentials to make them pop
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 3,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 20,
    },
    identityBox: {
        width: '100%',
        backgroundColor: '#2D0040',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    identityLabel: { color: '#B266FF', fontSize: 14, marginBottom: 4 },
    identityValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
    warningText: {
        color: '#A892BA',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    shareBtn: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#444',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    enterBtn: {
        width: '100%',
        backgroundColor: '#B266FF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    enterBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});

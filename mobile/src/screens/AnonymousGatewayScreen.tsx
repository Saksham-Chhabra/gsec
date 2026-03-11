import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const AnonymousGatewayScreen = ({ navigation }: any) => {
    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Friends</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Anonymous Mode</Text>
                <View style={{ width: 80 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.iconText}>🕶️</Text>
                <Text style={styles.subtitle}>Welcome to the Shadows</Text>
                <Text style={styles.description}>
                    In Anonymous Mode, your real identity is completely hidden. 
                    A temporary, encrypted session is used for maximum privacy.
                </Text>

                <View style={styles.cardContainer}>
                    <TouchableOpacity 
                        style={[styles.card, styles.createCard]}
                        onPress={() => navigation.navigate('AnonymousRoomCreated')}
                    >
                        <Text style={styles.cardIcon}>➕</Text>
                        <Text style={styles.cardTitle}>Create Room</Text>
                        <Text style={styles.cardDesc}>
                            Generate a secure temporary room to invite others.
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.card, styles.joinCard]}
                        onPress={() => navigation.navigate('AnonymousJoin')}
                    >
                        <Text style={styles.cardIcon}>🔑</Text>
                        <Text style={styles.cardTitle}>Join Room</Text>
                        <Text style={styles.cardDesc}>
                            Enter a Room ID and Password to connect.
                        </Text>
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
    cardContainer: { width: '100%', gap: 16 },
    card: {
        width: '100%',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    createCard: { backgroundColor: '#2D0040', borderColor: '#B266FF' },
    joinCard: { backgroundColor: '#1E1E1E', borderColor: '#444' },
    cardIcon: { fontSize: 32, marginBottom: 12 },
    cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    cardDesc: { color: '#ccc', fontSize: 14, textAlign: 'center' },
});

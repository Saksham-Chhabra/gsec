import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, SafeAreaView } from 'react-native';
import sodium from 'libsodium-wrappers';
import { searchPeerUser } from '../services/api';
import { initRatchetSender } from '../crypto/ratchet';
import { performKeyExchange } from '../crypto/exchange';
import { getIdentityKeyPair } from '../crypto/keys';
import { saveRatchetState } from '../storage/db';

export const SearchUsersScreen = ({ navigation }: any) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        
        try {
            const peer = await searchPeerUser(searchQuery.trim());
            
            if (peer) {
                Alert.alert(
                    "User Found",
                    `Start E2EE Chat with ${peer.username}?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { 
                            text: "Start Secure Chat", 
                            onPress: () => initiateRatchetSession(peer) 
                        }
                    ]
                );
            } else {
                Alert.alert("Not Found", "No user found with that exact username.");
            }
        } catch (error) {
            Alert.alert("Error", "Could not connect to discovery server.");
        } finally {
            setLoading(false);
        }
    };

    const initiateRatchetSession = async (peer: any) => {
        try {
            await sodium.ready;

            // 1. Load our own keys
            const localKeys = await getIdentityKeyPair();
            if (!localKeys) {
                Alert.alert("Error", "Local identity keys missing. Please re-login.");
                return;
            }

            // 2. Decode Peer's Public Identity Key
            // Based on backend design, public keys are typically strings. We need to agree on format.
            // Assuming the backend saved the Key as a Base64 string:
            const bobIdentityPublicKey = sodium.from_base64(peer.identityKeyPublic);

            // 3. X3DH Shared Secret Derivation (Mocking a simple DH for now, standard Signal uses PreKeys)
            const sharedMasterSecret = await performKeyExchange(localKeys.privateKey, bobIdentityPublicKey);

            // 4. In a full X3DH setup, Alice needs Bob's One-Time PreKey (BobRatchetKeyPair.publicKey).
            // For Phase 5 simplification bridging, we initialize the ratchet directly using the peer's Identity Key.
            // *WARNING*: True Signal protocol requires fetching Pre-Keys to prevent replay attacks and ensure freshness.
            const aliceRatchetState = await initRatchetSender(sharedMasterSecret, bobIdentityPublicKey);

            // 5. Securely persist our ratcheting state mapped to this exact peer ID.
            await saveRatchetState(peer.id, aliceRatchetState);

            // 6. Navigate to the Chat Screen!
            navigation.navigate('Chat', { peerId: peer.id, peerUsername: peer.username });
            
        } catch (e) {
            console.error("Ratchet Handshake Failed:", e);
            Alert.alert("Handshake Failed", "Could not establish a secure channel.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                <Text style={styles.title}>Find Peer</Text>
                <Text style={styles.subtitle}>Enter an exact username to establish a secure E2EE connection.</Text>
                
                <TextInput
                    style={styles.input}
                    placeholder="Enter Username"
                    placeholderTextColor="#555"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
                
                <View style={{ marginTop: 20 }}>
                     <Button 
                        title={loading ? "Searching Local Network..." : "Discover User"} 
                        onPress={handleSearch} 
                        color="#0f0" 
                        disabled={loading || !searchQuery.trim()} 
                    />
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    inner: { flex: 1, padding: 20, justifyContent: 'center' },
    title: { color: '#0f0', fontSize: 32, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { color: '#888', fontSize: 16, marginBottom: 30, textAlign: 'center' },
    input: {
        backgroundColor: '#111',
        color: '#fff',
        padding: 15,
        borderRadius: 10,
        fontSize: 18,
        borderWidth: 1,
        borderColor: '#333'
    }
});

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';
import { socketService } from '../services/socket';
import { saveAuthToken, saveUserId, bumpKeyVersion } from '../storage/db';
import { generateIdentityKeyPair, getIdentityKeyPair, generatePreKeyPair, getPreKeyPair } from '../crypto/keys';

export const LoginScreen = ({ navigation }: any) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const insets = useSafeAreaInsets();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    React.useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Please enter both email and password");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(username)) {
            Alert.alert("Error", "Please enter a valid email address");
            return;
        }

        if (password.length < 8) {
            Alert.alert("Error", "Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            // Step 1: Authenticate first (no keys in this call)
            const response = await apiClient.post('/auth/login', { username, password });
            const { token, userId } = response.data;
            
            await saveAuthToken(token);
            await saveUserId(userId); // MUST be saved before key gen so storage keys match

            // Step 2: Check for existing keys, generate only if missing
            console.log("[Login] Preparing cryptographic keys...");
            let identityKeys = await getIdentityKeyPair();
            let preKeys = await getPreKeyPair();

            if (!identityKeys) {
                console.log("[Login] No existing identity keys. Generating fresh pair...");
                identityKeys = await generateIdentityKeyPair();
            } else {
                console.log("[Login] Reusing existing identity keys from Keychain.");
            }

            if (!preKeys) {
                console.log("[Login] No existing pre keys. Generating fresh pair...");
                preKeys = await generatePreKeyPair();
            } else {
                console.log("[Login] Reusing existing pre keys from Keychain.");
            }

            // Step 3: Upload keys to server (pre-serialized as JSON strings)
            try {
                await apiClient.post('/auth/login', { 
                    username, 
                    password,
                    identityKeyPublic: JSON.stringify(Array.from(identityKeys.publicKey)),
                    preKeyPublic: JSON.stringify(Array.from(preKeys.publicKey))
                });
                console.log("[Login] Keys uploaded to server successfully.");
                await bumpKeyVersion(); // Invalidate all old ratchet sessions
            } catch (keyErr) {
                console.warn("[Login] Key upload failed (non-fatal):", keyErr);
            }

            Alert.alert("Success", "Logged in successfully!");
            socketService.connect();
            navigation.replace('Friends');
        } catch (error: any) {
            console.error("Login failed:", error);
            const msg = error.response?.data?.error || "Connection failed. Please check if your computer's IP and phone's Wi-Fi match.";
            Alert.alert("Login Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView 
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardVisible ? 20 : insets.bottom }]} 
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.inner}>
                        <Text style={styles.title}>G-SEC</Text>
                        <Text style={styles.subtitle}>Secure Messaging</Text>
                        
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>EMAIL ADDRESS</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor="#333"
                                value={username}
                                onChangeText={setUsername}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                        
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Enter password"
                                    placeholderTextColor="#333"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
                                    <Text style={styles.toggleText}>{showPassword ? "HIDE" : "SHOW"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        <TouchableOpacity 
                            style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
                            onPress={handleLogin} 
                            disabled={loading}
                        >
                            <Text style={styles.loginBtnText}>{loading ? "AUTHENTICATING..." : "LOGIN TO SECURE NET"}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { flexGrow: 1, paddingBottom: 20 },
    inner: { padding: 30 },
    title: { color: '#0f0', fontSize: 48, fontWeight: '900', textAlign: 'center', letterSpacing: 5 },
    subtitle: { color: '#444', fontSize: 12, marginBottom: 40, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
    inputWrapper: { marginBottom: 20 },
    label: { color: '#0f0', fontSize: 10, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
    input: {
        backgroundColor: '#0a0a0a',
        color: '#fff',
        padding: 16,
        borderRadius: 4,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    passwordInput: {
        flex: 1,
        color: '#fff',
        padding: 16,
        fontSize: 16,
    },
    toggleBtn: { padding: 16 },
    toggleText: { color: '#0f0', fontSize: 12, fontWeight: 'bold' },
    loginBtn: {
        backgroundColor: '#0f0',
        padding: 18,
        borderRadius: 4,
        alignItems: 'center',
        marginTop: 10,
    },
    loginBtnDisabled: { backgroundColor: '#003300' },
    loginBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    seedHint: { color: '#333', fontSize: 11, textAlign: 'center', marginTop: 30 },
});

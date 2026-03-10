import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../services/api';
import { socketService } from '../services/socket';
import { saveAuthToken, saveUserId } from '../storage/db';
import { generateIdentityKeyPair } from '../crypto/keys';

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
            const response = await apiClient.post('/auth/login', { username, password });
            const { token, userId } = response.data;
            
            await saveAuthToken(token);
            await saveUserId(userId);

            // ALWAYS generate fresh identity keys on login to ensure clean crypto state.
            // Old ratchet states from previous sessions are incompatible after key regen.
            console.log("[Login] Generating fresh identity keys for clean session...");
            await generateIdentityKeyPair();

            Alert.alert("Success", "Logged in successfully!");
            socketService.connect(); // Connect immediately after login
            navigation.replace('Search');
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
                        <Text style={styles.subtitle}>Quantum-Resistant Tactical Messaging</Text>
                        
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

                        <Text style={styles.seedHint}>
                            Compatible with seeded accounts: dhimansabhya@gmail.com
                        </Text>
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

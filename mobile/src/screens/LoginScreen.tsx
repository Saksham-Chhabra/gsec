import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, SafeAreaView, TouchableOpacity } from 'react-native';
import { apiClient } from '../services/api';
import { saveAuthToken, saveUserId } from '../storage/db';
import { generateIdentityKeyPair, getIdentityKeyPair } from '../crypto/keys';

export const LoginScreen = ({ navigation }: any) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Please enter both username and password");
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post('/auth/login', { username, password });
            const { token, userId } = response.data;
            
            await saveAuthToken(token);
            await saveUserId(userId);

            // Ensure we have identity keys generated
            const existingKeys = await getIdentityKeyPair();
            if (!existingKeys) {
                console.log("Generating new identity keys for user...");
                await generateIdentityKeyPair();
            }

            Alert.alert("Success", "Logged in successfully!");
            navigation.replace('Search');
        } catch (error: any) {
            console.error("Login failed:", error);
            const msg = error.response?.data?.error || "Invalid credentials or network error";
            Alert.alert("Login Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.inner}>
                <Text style={styles.title}>G-SEC Login</Text>
                <Text style={styles.subtitle}>Secure End-to-End Encrypted Messaging</Text>
                
                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#555"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
                
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#555"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
                
                <View style={{ marginTop: 20 }}>
                     <Button 
                        title={loading ? "Authenticating..." : "Login"} 
                        onPress={handleLogin} 
                        color="#0f0" 
                        disabled={loading} 
                    />
                </View>

                <TouchableOpacity style={{ marginTop: 20 }}>
                    <Text style={{ color: '#888', textAlign: 'center' }}>
                        Don't have an account? (Seed users Alice/Bob with password: password123)
                    </Text>
                </TouchableOpacity>
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
        borderColor: '#333',
        marginBottom: 15
    }
});

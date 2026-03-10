import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, SafeAreaView, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { getSettings, saveSettings } from '../storage/db';

export const SettingsScreen = ({ navigation }: any) => {
    const [settings, setSettings] = useState({
        torEnabled: false,
        screenshotProtection: true,
        backgroundBlur: true
    });

    useEffect(() => {
        const loadSettings = async () => {
            const saved = await getSettings();
            setSettings(saved);
        };
        loadSettings();
    }, []);

    const toggleSetting = async (key: string) => {
        const newSettings = { ...settings, [key]: !((settings as any)[key]) };
        setSettings(newSettings);
        await saveSettings(newSettings);
        
        if (key === 'screenshotProtection') {
            Alert.alert("Security Update", "Screenshot protection settings will apply on next app restart.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.inner}>
                <Text style={styles.sectionTitle}>Anonymity</Text>
                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Anonymous Mode (TOR)</Text>
                        <Text style={styles.settingDesc}>Route traffic through OR network</Text>
                    </View>
                    <Switch 
                        value={settings.torEnabled} 
                        onValueChange={() => toggleSetting('torEnabled')}
                        trackColor={{ false: '#333', true: '#0f0' }}
                    />
                </View>

                <Text style={styles.sectionTitle}>Device Security</Text>
                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Screenshot Protection</Text>
                        <Text style={styles.settingDesc}>Block screenshots and recording</Text>
                    </View>
                    <Switch 
                        value={settings.screenshotProtection} 
                        onValueChange={() => toggleSetting('screenshotProtection')}
                        trackColor={{ false: '#333', true: '#0f0' }}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Background Blur</Text>
                        <Text style={styles.settingDesc}>Hide content in app switcher</Text>
                    </View>
                    <Switch 
                        value={settings.backgroundBlur} 
                        onValueChange={() => toggleSetting('backgroundBlur')}
                        trackColor={{ false: '#333', true: '#0f0' }}
                    />
                </View>

                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>Save & Exit</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    inner: { padding: 20 },
    sectionTitle: { color: '#0f0', fontSize: 18, fontWeight: 'bold', marginTop: 30, marginBottom: 15, textTransform: 'uppercase' },
    settingRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: '#111', 
        padding: 15, 
        borderRadius: 12, 
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222'
    },
    settingLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
    settingDesc: { color: '#666', fontSize: 12, marginTop: 2 },
    backButton: { backgroundColor: '#0f0', padding: 15, borderRadius: 10, marginTop: 40, alignItems: 'center' },
    backButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});

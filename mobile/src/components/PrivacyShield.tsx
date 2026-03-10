import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { getSettings } from '../storage/db';

export const PrivacyShield = ({ children }: { children: React.ReactNode }) => {
    const [isShieldActive, setIsShieldActive] = useState(false);
    const [blurEnabled, setBlurEnabled] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await getSettings();
            setBlurEnabled(settings.backgroundBlur);
        };
        loadSettings();

        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (blurEnabled && nextAppState.match(/inactive|background/)) {
                setIsShieldActive(true);
            } else {
                setIsShieldActive(false);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [blurEnabled]);

    if (isShieldActive) {
        return (
            <View style={styles.shield}>
                <Text style={styles.shieldText}>G-SEC SECURE SESSION</Text>
                <Text style={styles.shieldSub}>CONTENT PROTECTED</Text>
            </View>
        );
    }

    return <>{children}</>;
};

const styles = StyleSheet.create({
    shield: { 
        flex: 1, 
        backgroundColor: '#000', 
        justifyContent: 'center', 
        alignItems: 'center',
        zIndex: 9999
    },
    shieldText: { color: '#0f0', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
    shieldSub: { color: '#666', fontSize: 14, marginTop: 10 }
});

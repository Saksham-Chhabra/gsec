import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SystemMessageProps {
  text: string;
  isAnonymousMode?: boolean;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ text, isAnonymousMode = false }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.bubble, isAnonymousMode && styles.anonymousBubble]}>
        <Text style={[styles.text, isAnonymousMode && styles.anonymousText]}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  bubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  text: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  anonymousBubble: {
    backgroundColor: 'rgba(170, 0, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(170, 0, 255, 0.3)',
  },
  anonymousText: {
    color: '#d488ff',
    letterSpacing: 0.5,
  },
});

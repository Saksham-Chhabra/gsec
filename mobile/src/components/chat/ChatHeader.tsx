import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatHeaderProps {
  peerUsername: string;
  sessionActive: boolean;
  statusMessage: string;
  isAnonymousMode: boolean;
  onClear: () => void;
  onToggleAnonymous: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  peerUsername,
  sessionActive,
  statusMessage,
  isAnonymousMode,
  onClear,
  onToggleAnonymous,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 10) }, isAnonymousMode && styles.anonymousHeader]}>
      <View style={styles.leftContent}>
        {!isAnonymousMode && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{peerUsername.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isAnonymousMode && styles.anonymousTitle]}>
            {isAnonymousMode ? 'Anonymous Chat' : peerUsername}
          </Text>
          {sessionActive ? (
            <View style={styles.secureContainer}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.secureText}>
                {isAnonymousMode ? 'Private & Anonymous' : 'End-to-End Encrypted'}
              </Text>
            </View>
          ) : (
            <Text style={styles.statusText}>{statusMessage}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightContent}>
        <TouchableOpacity onPress={onToggleAnonymous} style={styles.actionButton}>
          <Text style={styles.emojiIcon}>{isAnonymousMode ? '🕶️' : '👤'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearText}>CLEAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  anonymousHeader: {
    backgroundColor: '#05020a',
    borderBottomColor: '#2b1044',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarText: {
    color: '#0f0',
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  anonymousTitle: {
    color: '#d488ff',
    textShadowColor: 'rgba(170, 0, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  secureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  secureText: {
    color: '#0f0',
    fontSize: 11,
    fontWeight: '600',
  },
  statusText: {
    color: '#888',
    fontSize: 12,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  emojiIcon: {
    fontSize: 20,
  },
  clearButton: {
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearText: {
    color: '#ff3333',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export interface Message {
  id: string;
  text: string;
  isSender: boolean;
  timestamp: Date;
  expiresAt?: string;
}

interface MessageBubbleProps {
  message: Message;
  isAnonymousMode: boolean;
  peerUsername?: string;
  senderName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isAnonymousMode, peerUsername, senderName }) => {
  const isExpired = message.expiresAt && new Date(message.expiresAt) <= new Date();
  
  if (isExpired) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const timeString = formatTime(message.timestamp);

  // Styling logic based on mode
  const bubbleStyle = [
    styles.bubble,
    message.isSender ? styles.senderBubble : styles.receiverBubble,
    isAnonymousMode && message.isSender && styles.anonymousSenderBubble,
    isAnonymousMode && !message.isSender && styles.anonymousReceiverBubble,
  ];

  const textStyle = [
    styles.messageText,
    message.isSender ? styles.senderText : styles.receiverText,
    isAnonymousMode && message.isSender && styles.anonymousSenderText,
    isAnonymousMode && !message.isSender && styles.anonymousReceiverText,
  ];

  const displayName = senderName || (isAnonymousMode ? 'Stranger' : peerUsername);

  return (
    <View style={[styles.container, message.isSender ? styles.senderContainer : styles.receiverContainer]}>
      {!message.isSender && !isAnonymousMode && peerUsername && (
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarTextSmall}>{peerUsername.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.messageContent}>
        {!message.isSender && (
          <Text style={[styles.senderName, isAnonymousMode && styles.anonymousName]}>
            {displayName}
          </Text>
        )}
        
        <View style={bubbleStyle}>
          <Text style={textStyle}>{message.text}</Text>
          
          <View style={styles.metaData}>
            <Text style={[styles.timestamp, message.isSender ? styles.senderTimestamp : styles.receiverTimestamp]}>
              {timeString}
            </Text>
            {message.isSender && (
              <Text style={styles.readReceipt}>✓✓</Text>
            )}
          </View>
        </View>

        {message.expiresAt && (
            <Text style={styles.destructText}>
                Destructs in {Math.max(0, Math.round((new Date(message.expiresAt).getTime() - Date.now()) / 1000))}s
            </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  senderContainer: {
    justifyContent: 'flex-end',
  },
  receiverContainer: {
    justifyContent: 'flex-start',
  },
  messageContent: {
    maxWidth: '75%',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  avatarTextSmall: {
    color: '#0f0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  senderName: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  anonymousName: {
    color: '#a35bdb',
    fontStyle: 'italic',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  senderBubble: {
    backgroundColor: '#005c2a',
    borderBottomRightRadius: 4,
  },
  receiverBubble: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#222',
  },
  anonymousSenderBubble: {
    backgroundColor: '#4a0088',
    borderBottomRightRadius: 4,
  },
  anonymousReceiverBubble: {
    backgroundColor: '#0a0a0a',
    borderColor: '#2b1044',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  senderText: {
    color: '#fff',
  },
  receiverText: {
    color: '#e0e0e0',
  },
  anonymousSenderText: {
    color: '#fff',
  },
  anonymousReceiverText: {
    color: '#d488ff',
  },
  metaData: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  senderTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  receiverTimestamp: {
    color: '#666',
  },
  readReceipt: {
    fontSize: 10,
    color: '#4dacff',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  destructText: {
    fontSize: 10,
    color: '#ff4444',
    marginTop: 4,
    textAlign: 'right',
  },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface TypingIndicatorProps {
  isAnonymousMode?: boolean;
  username?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isAnonymousMode = false, username }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, [dot1, dot2, dot3]);

  const translateY1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const translateY2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const translateY3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  const label = isAnonymousMode ? 'Someone is typing...' : `${username || 'Peer'} is typing...`;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, isAnonymousMode && styles.anonymousText]}>{label}</Text>
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, isAnonymousMode && styles.anonymousDot, { transform: [{ translateY: translateY1 }] }]} />
        <Animated.View style={[styles.dot, isAnonymousMode && styles.anonymousDot, { transform: [{ translateY: translateY2 }] }]} />
        <Animated.View style={[styles.dot, isAnonymousMode && styles.anonymousDot, { transform: [{ translateY: translateY3 }] }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#888',
    fontSize: 12,
    marginRight: 8,
    fontStyle: 'italic',
  },
  anonymousText: {
    color: '#a35bdb',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888',
    marginHorizontal: 2,
  },
  anonymousDot: {
    backgroundColor: '#a35bdb',
    shadowColor: '#d488ff',
    shadowOpacity: 0.8,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});

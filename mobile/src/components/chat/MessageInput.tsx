import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface MessageInputProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sessionActive?: boolean;
  isAnonymousMode: boolean;
  timer?: number;
  onCycleTimer?: () => void;
  heightOffset?: number;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  inputText,
  onChangeText,
  onSend,
  sessionActive = true,
  isAnonymousMode,
  timer = 0,
  onCycleTimer,
  heightOffset = 10,
}) => {
  return (
    <View style={[styles.container, { paddingBottom: heightOffset }, isAnonymousMode && styles.anonymousContainer]}>
      
      {!isAnonymousMode && onCycleTimer && (
        <TouchableOpacity onPress={onCycleTimer} style={[styles.timerButton, isAnonymousMode && styles.anonymousTimerButton]}>
          <Text style={[styles.timerText, isAnonymousMode && styles.anonymousTimerText]}>
            {timer === 0 ? "∞" : `${timer}s`}
          </Text>
        </TouchableOpacity>
      )}
      
      <View style={[styles.inputWrapper, isAnonymousMode && styles.anonymousInputWrapper]}>
        <TextInput
          style={[styles.input, isAnonymousMode && styles.anonymousInputText]}
          value={inputText}
          onChangeText={onChangeText}
          placeholder={isAnonymousMode ? "Send anonymous message..." : "G-SEC Secure message..."}
          placeholderTextColor={isAnonymousMode ? "#553a77" : "#666"}
          editable={sessionActive}
          multiline
          maxLength={2000}
        />
        
        <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>📎</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        onPress={onSend} 
        disabled={!sessionActive || !inputText.trim()} 
        style={[
          styles.sendBtn, 
          isAnonymousMode && styles.anonymousSendBtn,
          (!sessionActive || !inputText.trim()) && styles.disabledBtn
        ]}
      >
        <Text style={[styles.sendBtnText, isAnonymousMode && styles.anonymousSendBtnText]}>
            ➤
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  anonymousContainer: {
    backgroundColor: '#05020a',
    borderTopColor: '#2b1044',
  },
  timerButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  anonymousTimerButton: {
    backgroundColor: '#1a0a2e',
    borderColor: '#3a1b5c',
  },
  timerText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  anonymousTimerText: {
    color: '#ff44aa',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  anonymousInputWrapper: {
    backgroundColor: '#0d0714',
    borderColor: '#3a1b5c',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
  },
  anonymousInputText: {
    color: '#e6ccff',
  },
  iconButton: {
    padding: 8,
  },
  iconText: {
    fontSize: 18,
    color: '#888',
  },
  sendBtn: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#00cc44',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 4,
    shadowColor: '#00ff55',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  anonymousSendBtn: {
    backgroundColor: '#aa00ff',
    shadowColor: '#d488ff',
  },
  disabledBtn: {
    backgroundColor: '#333',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 2, 
  },
  anonymousSendBtnText: {
    color: '#fff',
  },
});

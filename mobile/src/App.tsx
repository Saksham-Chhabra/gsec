import React from 'react';
import { SafeAreaView, StatusBar, Text, View } from 'react-native';

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#0f0', fontSize: 24, fontWeight: 'bold' }}>
          G-SEC Core Init
        </Text>
        <Text style={{ color: '#fff', marginTop: 10 }}>Phase 1 Setup Complete</Text>
      </View>
    </SafeAreaView>
  );
};

export default App;

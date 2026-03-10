import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, SearchUsersScreen, ChatScreen } from './src/screens';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
            headerStyle: { backgroundColor: '#111' },
            headerTintColor: '#0f0',
            headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ title: 'G-SEC Authentication' }} 
        />
        <Stack.Screen 
            name="Search" 
            component={SearchUsersScreen} 
            options={{ title: 'G-SEC Discover' }} 
        />
        <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={({ route }: any) => ({ title: route.params?.peerUsername || 'Secure Chat' })} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;

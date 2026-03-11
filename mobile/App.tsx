import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, SearchUsersScreen, ChatScreen, SettingsScreen, FriendsListScreen, RequestsScreen, AnonymousGatewayScreen, AnonymousJoinScreen, AnonymousRoomCreatedScreen, AnonymousChatScreen } from './src/screens';
import { PrivacyShield } from './src/components/PrivacyShield';

import { messageService } from './src/services/MessageService';

const Stack = createNativeStackNavigator();

const App = () => {
  React.useEffect(() => {
    messageService.init();
  }, []);

  return (
    <PrivacyShield>
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
              name="Friends" 
              component={FriendsListScreen} 
              options={{ title: 'G-SEC', headerShown: false }} 
          />
          <Stack.Screen 
              name="Search" 
              component={SearchUsersScreen} 
              options={{ title: 'Find People', headerShown: false }} 
          />
          <Stack.Screen 
              name="Requests" 
              component={RequestsScreen} 
              options={{ title: 'Friend Requests', headerShown: false }} 
          />
          <Stack.Screen 
              name="Chat" 
              component={ChatScreen} 
              options={({ route }: any) => ({ title: route.params?.peerUsername || 'Secure Chat' })} 
          />
          <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{ title: 'G-SEC Settings' }} 
          />
          <Stack.Screen 
              name="AnonymousGateway" 
              component={AnonymousGatewayScreen} 
              options={{ headerShown: false }} 
          />
          <Stack.Screen 
              name="AnonymousJoin" 
              component={AnonymousJoinScreen} 
              options={{ headerShown: false }} 
          />
          <Stack.Screen 
              name="AnonymousRoomCreated" 
              component={AnonymousRoomCreatedScreen} 
              options={{ headerShown: false }} 
          />
          <Stack.Screen 
              name="AnonymousChat" 
              component={AnonymousChatScreen} 
              options={{ headerShown: false }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PrivacyShield>
  );
};

export default App;

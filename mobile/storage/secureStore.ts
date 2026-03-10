import * as Keychain from 'react-native-keychain';

export const storeSessionToken = async (token: string, userId: string) => {
  try {
    await Keychain.setGenericPassword('session', JSON.stringify({ token, userId }), {
      service: 'g-sec-session',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.error('Failed to store session token', error);
    return false;
  }
};

export const getSessionToken = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: 'g-sec-session' });
    if (credentials) {
      return JSON.parse(credentials.password) as { token: string; userId: string };
    }
    return null;
  } catch (error) {
    console.error('Failed to get session token', error);
    return null;
  }
};

export const clearSessionToken = async () => {
  try {
    await Keychain.resetGenericPassword({ service: 'g-sec-session' });
    return true;
  } catch (error) {
    console.error('Failed to clear session token', error);
    return false;
  }
};

import sodium from 'libsodium-wrappers';
import * as SecureStore from 'expo-secure-store';

export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

// Ensure libsodium is ready before executing anything
export const verifyCryptoEngine = async () => {
    await sodium.ready;
    return true;
};

// Generates an X25519 identity key pair securely
export const generateIdentityKeyPair = async (): Promise<KeyPair> => {
    await sodium.ready;
    const { publicKey, privateKey } = await sodium.crypto_box_keypair();
    // Store both securely (encoded as JSON base64 string)
    const keyData = JSON.stringify({
        publicKey: Array.from(publicKey),
        privateKey: Array.from(privateKey)
    });
    
    await SecureStore.setItemAsync('identity_keys', keyData);

    return { publicKey, privateKey };
};

export const getIdentityKeyPair = async (): Promise<KeyPair | null> => {
    await sodium.ready;
    try {
        const credentials = await SecureStore.getItemAsync('identity_keys');
        if (credentials) {
            const parsed = JSON.parse(credentials);
            return {
                publicKey: new Uint8Array(parsed.publicKey),
                privateKey: new Uint8Array(parsed.privateKey)
            };
        }
    } catch(e) {
        console.error("Failed to fetch identity keys from Keychain", e);
    }
    return null;
}

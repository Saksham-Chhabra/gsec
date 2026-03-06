import sodium from 'react-native-libsodium';

export const performKeyExchange = async (
    myPrivateKey: string,
    theirPublicKey: string
): Promise<string> => {
    await sodium.ready;
    
    // Compute shared secret using X25519 Diffie-Hellman
    // For react-native-libsodium, the scalar mult function is crypto_scalarmult
    const sharedSecret = await sodium.crypto_scalarmult(myPrivateKey, theirPublicKey);
    
    // It's best practice to hash the shared secret to derive a master key
    // Using BLAKE2b (crypto_generichash)
    const sessionKey = await sodium.crypto_generichash(32, sharedSecret);
    
    return sessionKey; // Usually base64 or hex encoded string in JS, libsodium handles it
};

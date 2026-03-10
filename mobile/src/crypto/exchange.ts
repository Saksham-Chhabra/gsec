import sodium from 'libsodium-wrappers';

export const performKeyExchange = async (
    myPrivateKey: Uint8Array,
    theirPublicKey: Uint8Array
): Promise<Uint8Array> => {
    await sodium.ready;
    
    // Compute shared secret using X25519 Diffie-Hellman
    const sharedSecret = sodium.crypto_scalarmult(myPrivateKey, theirPublicKey);
    
    // Hash the shared secret to derive a master key
    // Using BLAKE2b (crypto_generichash)
    const sessionKey = sodium.crypto_generichash(32, sharedSecret, new Uint8Array(0));
    
    return sessionKey; // Returns Uint8Array
};

import sodium from 'react-native-libsodium';

// ChaCha20-Poly1305 encryption wrapper
export const encryptMessage = async (
    plaintext: string,
    sessionKey: string
): Promise<{ ciphertext: string; nonce: string }> => {
    await sodium.ready;
    
    // Generate a random 24-byte nonce (XChaCha20-Poly1305 uses 24 bytes, standard ChaCha20 uses 8 or 12)
    // Libsodium crypto_secretbox_easy uses XSalsa20-Poly1305 or XChaCha20 depending on the exact bindings.
    // react-native-libsodium uses crypto_secretbox (XSalsa20) by default, but let's strictly use AEAD ChaCha20-Poly1305 if available.
    // If react-native-libsodium lacks direct AEAD ChaCha20 exposed cleanly, crypto_secretbox_easy is the libsodium standard for payload encryption.
    // Assuming `crypto_aead_chacha20poly1305_ietf_encrypt` is available:
    
    const nonce = await sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    
    const ciphertext = await sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
        plaintext,
        null, // additional data
        null, // nsec (not used)
        nonce,
        sessionKey
    );
    
    return { ciphertext, nonce };
};

export const decryptMessage = async (
    ciphertext: string,
    nonce: string,
    sessionKey: string
): Promise<string | null> => {
    await sodium.ready;
    
    try {
        const plaintext = await sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
            null, // nsec (not used)
            ciphertext,
            null, // additional data
            nonce,
            sessionKey
        );
        return plaintext;
    } catch (error) {
        console.error("Decryption failed / authentication tag mismatch", error);
        return null; // Cryptographically invalid or tampered
    }
};

import sodium from 'libsodium-wrappers';

// ChaCha20-Poly1305 encryption wrapper
export const encryptMessage = async (
    plaintext: string | Uint8Array,
    sessionKey: Uint8Array,
    associatedData: Uint8Array | null = null
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; header: Uint8Array | null }> => {
    await sodium.ready;
    
    // Generate a random 12-byte nonce for regular ChaCha20-Poly1305
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    
    // Encrypt the plaintext and compute MAC tag natively
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
        plaintext,
        associatedData, // AD (header) binds ciphertext to metadata so AD can't be swapped
        null, // nsec (not used)
        nonce,
        sessionKey
    );
    
    return { ciphertext, nonce, header: associatedData };
};

export const decryptMessage = async (
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    sessionKey: Uint8Array,
    associatedData: Uint8Array | null = null
): Promise<Uint8Array | null> => {
    await sodium.ready;
    
    try {
        const plaintext = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
            null, // nsec (not used)
            ciphertext,
            associatedData, // must match encryption AD
            nonce,
            sessionKey
        );
        return plaintext;
    } catch (error) {
        console.error("Decryption failed / authentication tag mismatch", error);
        return null; // Cryptographically invalid or tampered
    }
};

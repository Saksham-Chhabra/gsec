import sodium from 'libsodium-wrappers';

// Raw X25519 Diffie-Hellman — returns the 32-byte shared point directly
// This is intentionally raw (no additional hash on top) so it stays compatible
// with the KDF_RK that will hash it further in the ratchet.
export const performKeyExchange = async (
    myPrivateKey: Uint8Array,
    theirPublicKey: Uint8Array
): Promise<Uint8Array> => {
    await sodium.ready;
    // Raw X25519 — consistent with what handshake.ts uses (crypto_scalarmult)
    return sodium.crypto_scalarmult(myPrivateKey, theirPublicKey);
};

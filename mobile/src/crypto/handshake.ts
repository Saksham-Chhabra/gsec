import sodium from 'libsodium-wrappers';
import { KeyPair } from './keys';
import { initRatchetSender, initRatchetReceiver, RatchetState } from './ratchet';

export interface HandshakeMessage {
    type: 'key_exchange' | 'key_exchange_response';
    senderId: string;
    identityPublicKey: Array<number>;
    ratchetPublicKey: Array<number>;
}

export const createHandshakeInit = async (
    myId: string,
    myIdentityKeyPair: KeyPair,
    myRatchetKeyPair: KeyPair
): Promise<HandshakeMessage> => {
    await sodium.ready;
    return {
        type: 'key_exchange',
        senderId: myId,
        identityPublicKey: Array.from(myIdentityKeyPair.publicKey),
        ratchetPublicKey: Array.from(myRatchetKeyPair.publicKey),
    };
};

export const createHandshakeResponse = async (
    myId: string,
    myIdentityKeyPair: KeyPair,
    myRatchetKeyPair: KeyPair
): Promise<HandshakeMessage> => {
    await sodium.ready;
    return {
        type: 'key_exchange_response',
        senderId: myId,
        identityPublicKey: Array.from(myIdentityKeyPair.publicKey),
        ratchetPublicKey: Array.from(myRatchetKeyPair.publicKey),
    };
};

export const processHandshake = async (
    remoteHandshake: HandshakeMessage,
    myIdentityKeyPair: KeyPair,
    myRatchetKeyPair: KeyPair,
    isInitiator: boolean
): Promise<{ state: RatchetState; sharedSecret: Uint8Array }> => {
    await sodium.ready;
    
    const remoteIdentityPub = new Uint8Array(remoteHandshake.identityPublicKey);
    const remoteRatchetPub = new Uint8Array(remoteHandshake.ratchetPublicKey);

    // 1. Perform X25519 DH between identity keys and ratchet keys
    // For a real Signal Double Ratchet, we'd do a Triple Diffie-Hellman (3DH)
    // For this implementation, we'll do a 2DH: DH(Identity, Ratchet) ^ DH(Ratchet, Identity)
    
    const dh1 = sodium.crypto_scalarmult(myIdentityKeyPair.privateKey, remoteRatchetPub);
    const dh2 = sodium.crypto_scalarmult(myRatchetKeyPair.privateKey, remoteIdentityPub);
    
    // Combine DH outputs to form the root shared secret
    const combined = new Uint8Array(64);
    combined.set(dh1);
    combined.set(dh2, 32);
    
    const sharedSecret = sodium.crypto_generichash(32, combined, new Uint8Array(0));

    let state: RatchetState;
    if (isInitiator) {
        // We started it, so we follow sender initialization
        state = await initRatchetSender(sharedSecret, remoteRatchetPub);
    } else {
        // We are responding, follow receiver initialization
        state = await initRatchetReceiver(sharedSecret, myRatchetKeyPair);
        // Note: Bob (receiver) needs to know Alice's ratchet public key to step forward
        // In this simplified version, the first message from Alice will advance it.
    }

    return { state, sharedSecret };
};

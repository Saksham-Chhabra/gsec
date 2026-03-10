import sodium from 'libsodium-wrappers';
import { KeyPair } from './keys';
import { initRatchetSender, initRatchetReceiver, RatchetState } from './ratchet';

export interface HandshakeMessage {
    type: 'key_exchange' | 'key_exchange_response';
    senderId: string;
    recipientId: string; // Added to make it deterministic
    identityPublicKey: Array<number>;
    ratchetPublicKey: Array<number>;
}

export const createHandshakeInit = async (
    myId: string,
    peerId: string,
    myIdentityKeyPair: KeyPair,
    myRatchetKeyPair: KeyPair
): Promise<HandshakeMessage> => {
    await sodium.ready;
    return {
        type: 'key_exchange',
        senderId: myId,
        recipientId: peerId,
        identityPublicKey: Array.from(myIdentityKeyPair.publicKey),
        ratchetPublicKey: Array.from(myRatchetKeyPair.publicKey),
    };
};

export const createHandshakeResponse = async (
    myId: string,
    peerId: string,
    myIdentityKeyPair: KeyPair,
    myRatchetKeyPair: KeyPair
): Promise<HandshakeMessage> => {
    await sodium.ready;
    return {
        type: 'key_exchange_response',
        senderId: myId,
        recipientId: peerId,
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

    // 1. Perform 3DH: Triple Diffie-Hellman
    // dh1 = Identity_Self * Ratchet_Remote
    // dh2 = Ratchet_Self * Identity_Remote
    // dh3 = Ratchet_Self * Ratchet_Remote
    const dh1 = sodium.crypto_scalarmult(myIdentityKeyPair.privateKey, remoteRatchetPub);
    const dh2 = sodium.crypto_scalarmult(myRatchetKeyPair.privateKey, remoteIdentityPub);
    const dh3 = sodium.crypto_scalarmult(myRatchetKeyPair.privateKey, remoteRatchetPub);
    
    // 2. Combine DH outputs to form the root shared secret DETERMINISTICALLY
    // We order components based on ID comparison so both parties land on same buffer.
    // Alice (A) < Bob (B)
    // Alice view: dh1 = IA*RB, dh2 = RA*IB, dh3 = RA*RB
    // Bob view:   dh1 = IB*RA, dh2 = RB*IA, dh3 = RB*RA
    // Note: dh1_Alice == dh2_Bob, dh2_Alice == dh1_Bob, dh3_Alice == dh3_Bob
    
    const combined = new Uint8Array(96);
    const myId = remoteHandshake.recipientId;
    const peerId = remoteHandshake.senderId;

    if (myId < peerId) {
        combined.set(dh1);
        combined.set(dh2, 32);
        combined.set(dh3, 64);
    } else {
        combined.set(dh2); // dh2_Bob == dh1_Alice
        combined.set(dh1, 32); // dh1_Bob == dh2_Alice
        combined.set(dh3, 64); // dh3_Bob == dh3_Alice
    }
    
    const sharedSecret = sodium.crypto_generichash(32, combined, new Uint8Array(0));

    let state: RatchetState;
    if (isInitiator) {
        // Alice starts by providing Bob's Ratchet Pub from handshake
        state = await initRatchetSender(sharedSecret, remoteRatchetPub);
    } else {
        // Bob starts with his OWN Ratchet key pair that he sent in the handshake
        state = await initRatchetReceiver(sharedSecret, myRatchetKeyPair);
    }

    return { state, sharedSecret };
};

import sodium from 'libsodium-wrappers';
import { KeyPair } from './keys';
import { initRatchetSender, initRatchetReceiver, RatchetState } from './ratchet';

export interface HandshakeMessage {
    type: 'key_exchange' | 'key_exchange_response';
    senderId: string;
    recipientId: string;
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
    _isInitiator: boolean // kept for API compatibility but not used
): Promise<{ state: RatchetState; sharedSecret: Uint8Array }> => {
    await sodium.ready;

    const remoteIdentityPub = new Uint8Array(remoteHandshake.identityPublicKey);
    
    console.log(`[Handshake] processHandshake raw ratchetPublicKey type: ${typeof remoteHandshake.ratchetPublicKey}, isArray: ${Array.isArray(remoteHandshake.ratchetPublicKey)}`);
    if (Array.isArray(remoteHandshake.ratchetPublicKey)) {
        console.log(`[Handshake] processHandshake raw ratchetPublicKey length: ${remoteHandshake.ratchetPublicKey.length}`);
    }
    
    const remoteRatchetPub = new Uint8Array(remoteHandshake.ratchetPublicKey);
    console.log(`[Handshake] processHandshake new Uint8Array(remoteRatchetPub) length: ${remoteRatchetPub.length}`);

    // Derive myId and peerId deterministically from the handshake message
    // recipientId = the person this message was SENT TO (me)
    // senderId    = the person who sent this message (peer)
    const myId: string = remoteHandshake.recipientId;
    const peerId: string = remoteHandshake.senderId;

    // Compute 3DH shared secret components
    // dh1 = Identity_Self * Ratchet_Remote
    // dh2 = Ratchet_Self  * Identity_Remote
    // dh3 = Ratchet_Self  * Ratchet_Remote
    const dh1 = sodium.crypto_scalarmult(myIdentityKeyPair.privateKey, remoteRatchetPub);
    const dh2 = sodium.crypto_scalarmult(myRatchetKeyPair.privateKey,  remoteIdentityPub);
    const dh3 = sodium.crypto_scalarmult(myRatchetKeyPair.privateKey,  remoteRatchetPub);

    // Combine DH outputs deterministically — ALWAYS order as (smaller_id, larger_id)
    // Alice (smaller ID):  [dh1_A=IA*RB, dh2_A=RA*IB, dh3_A=RA*RB]
    // Bob   (larger  ID):  [dh2_B=IB*RA, dh1_B=RB*IA, dh3_B=RB*RA]  (swapped to match Alice)
    // dh1_A == dh2_B,  dh2_A == dh1_B,  dh3_A == dh3_B  (DH symmetry)
    const combined = new Uint8Array(96);
    if (myId < peerId) {
        // I am Alice (smaller ID) — natural order
        combined.set(dh1,     0);
        combined.set(dh2,    32);
        combined.set(dh3,    64);
    } else {
        // I am Bob (larger ID) — swap dh1/dh2 so both sides produce same buffer
        combined.set(dh2,     0); // dh2_Bob == dh1_Alice
        combined.set(dh1,    32); // dh1_Bob == dh2_Alice
        combined.set(dh3,    64); // dh3 is symmetric
    }

    const sharedSecret = sodium.crypto_generichash(32, combined, new Uint8Array(0));
    console.log(`[Handshake] Shared secret derived: ${sodium.to_hex(sharedSecret).substring(0, 8)}... myId=${myId.slice(-4)} peerId=${peerId.slice(-4)}`);

    // DETERMINISTIC ROLE ASSIGNMENT — based purely on userId ordering
    // This guarantees that no matter who sends the first message or how
    // many handshakes fly back and forth, both parties always agree on:
    //   smaller ID => Alice (sender/initiator) => initRatchetSender
    //   larger  ID => Bob   (receiver)         => initRatchetReceiver
    let state: RatchetState;
    if (myId < peerId) {
        // I am Alice — I know Bob's ratchet public key from the handshake
        console.log(`[Handshake] I am SENDER (Alice). DHr = remote ratchet key`);
        state = await initRatchetSender(sharedSecret, remoteRatchetPub);
    } else {
        // I am Bob — I use my OWN identity key as the initial ratchet key
        // Pass Alice's initial ratchet key (remoteRatchetPub) so Bob can also send immediately!
        console.log(`[Handshake] I am RECEIVER (Bob). DHs = my identity key`);
        state = await initRatchetReceiver(sharedSecret, myRatchetKeyPair, remoteRatchetPub);
    }

    return { state, sharedSecret };
};

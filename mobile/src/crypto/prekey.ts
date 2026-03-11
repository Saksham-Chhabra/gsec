import sodium from 'libsodium-wrappers';
import { KeyPair } from './keys';
import { initRatchetBidirectional, RatchetState } from './ratchet';

export interface PeerKeyBundle {
    identityKeyPublic: Uint8Array;
    preKeyPublic: Uint8Array;
}

/**
 * Asynchronous 3DH (Triple Diffie-Hellman) Exchange.
 * 
 * Both sides compute the SAME shared secret from their identity + pre keys.
 * No WebSocket handshake needed — keys are fetched from the server via HTTP.
 * 
 * Roles are assigned deterministically by user ID:
 *   smaller ID → Alice (sends first in Signal terms)
 *   larger  ID → Bob
 * 
 * Both sides can send AND receive immediately after session creation.
 */
export const computeAsynchronous3DH = async (
    myId: string,
    peerId: string,
    myIdentityKeyPair: KeyPair,
    myPreKeyPair: KeyPair,
    peerBundle: PeerKeyBundle
): Promise<{ state: RatchetState; sharedSecret: Uint8Array }> => {
    await sodium.ready;

    const remoteIdentityPub = peerBundle.identityKeyPublic;
    const remotePreKeyPub = peerBundle.preKeyPublic;

    // 3DH components
    const dh1 = sodium.crypto_scalarmult(myIdentityKeyPair.privateKey, remotePreKeyPub);
    const dh2 = sodium.crypto_scalarmult(myPreKeyPair.privateKey, remoteIdentityPub);
    const dh3 = sodium.crypto_scalarmult(myPreKeyPair.privateKey, remotePreKeyPub);

    // Deterministic ordering: always (smaller_id, larger_id)
    const combined = new Uint8Array(96);
    if (myId < peerId) {
        combined.set(dh1, 0);
        combined.set(dh2, 32);
        combined.set(dh3, 64);
    } else {
        combined.set(dh2, 0);
        combined.set(dh1, 32);
        combined.set(dh3, 64);
    }

    const sharedSecret = sodium.crypto_generichash(32, combined, new Uint8Array(0));
    const isAlice = myId < peerId;

    console.log(`[PreKey] 3DH shared secret: ${sodium.to_hex(sharedSecret).substring(0, 8)}... role=${isAlice ? 'ALICE' : 'BOB'}`);

    // Both sides use their prekey pair as initial DHs.
    // This ensures header.DHs matches the peer's DHr on first message (no premature ratchet step).
    const state = await initRatchetBidirectional(
        sharedSecret,
        myPreKeyPair,        // DHs = my prekey pair
        remotePreKeyPub,     // DHr = peer's prekey public
        isAlice
    );

    return { state, sharedSecret };
};

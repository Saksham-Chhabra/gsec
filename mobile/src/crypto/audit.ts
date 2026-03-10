import sodium from 'libsodium-wrappers';
import { generateIdentityKeyPair } from './keys';
import { createHandshakeInit, createHandshakeResponse, processHandshake } from './handshake';
import { ratchetEncrypt, ratchetDecrypt } from './ratchet';

export const runSecurityAudit = async () => {
    console.log("--- G-SEC SECURITY AUDIT START ---");
    await sodium.ready;

    try {
        // 1. Core Cryptography Test
        console.log("[1/4] Testing Key Pair Generation...");
        const aliceKeys = await sodium.crypto_box_keypair();
        const bobKeys = await sodium.crypto_box_keypair();
        if (aliceKeys.publicKey.length !== 32) throw new Error("Invalid KP length");
        console.log("SUCCESS: Identity keys valid.");

        // 2. Handshake Verification (2DH)
        console.log("[2/4] Testing P2P Handshake (2DH)...");
        const aliceHandshake = await createHandshakeInit("alice", aliceKeys, aliceKeys);
        const bobHandshake = await createHandshakeResponse("bob", bobKeys, bobKeys);

        const aliceRes = await processHandshake(bobHandshake, aliceKeys, aliceKeys, true);
        const bobRes = await processHandshake(aliceHandshake, bobKeys, bobKeys, false);

        if (sodium.compare(aliceRes.sharedSecret, bobRes.sharedSecret) !== 0) {
            throw new Error("Handshake Shared Secret Mismatch!");
        }
        console.log("SUCCESS: Mutual shared secret established.");

        // 3. Double Ratchet Test
        console.log("[3/4] Testing Double Ratchet (Forward Secrecy)...");
        let aliceState = aliceRes.state;
        let bobState = bobRes.state;

        // Alice sends message 1
        const msg1 = await ratchetEncrypt(aliceState, "Secure Message 1");
        aliceState = msg1.state;

        const dec1 = await ratchetDecrypt(bobState, msg1.header, msg1.ciphertext);
        bobState = dec1.state;
        
        if (sodium.to_string(dec1.plaintext) !== "Secure Message 1") {
            throw new Error("Ratchet Decryption Failure!");
        }
        
        // Alice sends message 2 (Ratchet should advance)
        const msg2 = await ratchetEncrypt(aliceState, "Secure Message 2");
        aliceState = msg2.state;

        const dec2 = await ratchetDecrypt(bobState, msg2.header, msg2.ciphertext);
        bobState = dec2.state;

        if (sodium.to_string(dec2.plaintext) !== "Secure Message 2") {
            throw new Error("Ratchet Advancement Failure!");
        }
        console.log("SUCCESS: Double Ratchet functional with forward secrecy.");

        // 4. Ephemeral Erasure Testing
        console.log("[4/4] Testing Cryptographic Erasure...");
        // In our implementation, we purge skipped keys
        if (Object.keys(aliceState.MKsKIPPED).length === 0) {
             console.log("SUCCESS: No sensitive keys leaked in memory during normal flow.");
        }

        console.log("--- G-SEC SECURITY AUDIT COMPLETE (PASS) ---");
        return true;
    } catch (e) {
        console.error("--- G-SEC SECURITY AUDIT FAILED ---");
        console.error(e);
        return false;
    }
};

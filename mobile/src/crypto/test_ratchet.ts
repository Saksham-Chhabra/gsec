import * as sodium from 'libsodium-wrappers';
import { performKeyExchange } from './exchange';
import { initRatchetSender, initRatchetReceiver, ratchetEncrypt, ratchetDecrypt } from './ratchet';

const runTest = async () => {
  await sodium.ready;
  console.log("=== Double Ratchet Integration Test ===");

  // 1. Initial Identity Key Exchange (X3DH or static out of band step)
  await sodium.ready;

  // 1. Initial Identity Key Exchange (X3DH or static out of band step)
  // For the test, we mock Alice and Bob already having an initial shared master secret.
  const aliceIdNode = sodium.crypto_box_keypair();
  const bobIdNode = sodium.crypto_box_keypair();
  
  // They compute their shared secret
  const masterSecretAlice = await performKeyExchange(aliceIdNode.privateKey, bobIdNode.publicKey);
  const masterSecretBob = await performKeyExchange(bobIdNode.privateKey, aliceIdNode.publicKey);
  
  console.assert(sodium.compare(masterSecretAlice, masterSecretBob) === 0, "Master secrets must match");
  console.log("1. Master secret established.");

  // Bob generates a signed pre-key/ratchet key that Alice fetched
  const bobRatchetKeyPair = sodium.crypto_box_keypair();
  
  // 2. Initialize Ratchets
  let aliceState = await initRatchetSender(masterSecretAlice, bobRatchetKeyPair.publicKey);
  let bobState = await initRatchetReceiver(masterSecretBob, bobRatchetKeyPair);
  
  console.log("2. Ratchet states initialized.");
  
  // 3. Alice sends to Bob
  const msg1 = "Hello Bob! This is message 1.";
  const ad1 = sodium.from_string("metadata-v1");
  const enc1 = await ratchetEncrypt(aliceState, sodium.from_string(msg1), ad1);
  aliceState = enc1.state; // Apply state update

  console.log("Alice sent Msg 1, length:", enc1.ciphertext.length);
  
  const dec1 = await ratchetDecrypt(bobState, enc1.header, enc1.ciphertext, ad1);
  bobState = dec1.state; // Apply state update
  console.log("Bob decrypted Msg 1:", sodium.to_string(dec1.plaintext));

  // 4. Alice sends another to Bob without Bob responding (same sending chain)
  const msg2 = "Are you there Bob? Message 2.";
  const enc2 = await ratchetEncrypt(aliceState, sodium.from_string(msg2), ad1);
  aliceState = enc2.state;

  console.log("Alice sent Msg 2, length:", enc2.ciphertext.length);
  
  const dec2 = await ratchetDecrypt(bobState, enc2.header, enc2.ciphertext, ad1);
  bobState = dec2.state;
  console.log("Bob decrypted Msg 2:", sodium.to_string(dec2.plaintext));

  // 5. Bob responds to Alice (flips the DH ratchet)
  const msg3 = "Hi Alice, I got both messages. Message 3.";
  const enc3 = await ratchetEncrypt(bobState, sodium.from_string(msg3), ad1);
  bobState = enc3.state;

  console.log("Bob sent Msg 3, length:", enc3.ciphertext.length);

  const dec3 = await ratchetDecrypt(aliceState, enc3.header, enc3.ciphertext, ad1);
  aliceState = dec3.state;
  console.log("Alice decrypted Msg 3:", sodium.to_string(dec3.plaintext));

  console.log("=== Test Completed Successfully ===");
};

runTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});

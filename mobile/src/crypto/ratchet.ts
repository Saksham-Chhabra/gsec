import sodium from 'libsodium-wrappers';
import { performKeyExchange } from './exchange';
import { encryptMessage, decryptMessage } from './encryption';
import { KeyPair } from './keys';

export interface RatchetState {
  // Diffie-Hellman Ratchet state
  DHs: KeyPair;      // DH Ratchet key pair (the "sending" or "self" ratchet key)
  DHr: Uint8Array | null;   // DH Ratchet public key (the "receiving" or "remote" ratchet key)

  // Symmetric Ratchet state
  RK: Uint8Array;           // 32-byte Root Key
  CKs: Uint8Array | null;   // 32-byte Chain Key for sending
  CKr: Uint8Array | null;   // 32-byte Chain Key for receiving

  // Message numbering
  Ns: number;               // Message number for sending
  Nr: number;               // Message number for receiving
  PN: number;               // Number of messages in previous sending chain

  // Skipped keys for out-of-order messages (simplification: store MKs by pubkey+msgNum)
  MKsKIPPED: Record<string, Uint8Array>;
}

// Key Derivation Function for Root Key (KDF_RK)
// KDF_RK(rk, dh_out) returns a pair (32-byte Root Key, 32-byte Chain Key)
export const KDF_RK = async (rk: Uint8Array, dhOut: Uint8Array): Promise<[Uint8Array, Uint8Array]> => {
  await sodium.ready;
  // According to Signal specification, HKDF is used. For simplicity and equal security, 
  // we can use BLAKE2b (crypto_generichash) with different contexts/keys.
  // We'll use HMAC-SHA256 equivalent via libsodium (auth/hmac or generic hash with key)
  
  // Create a 64-byte pseudorandom key (PRK) from the DH output using RK as the key
  const state = sodium.crypto_generichash_init(rk, 64);
  sodium.crypto_generichash_update(state, dhOut);
  const prk = sodium.crypto_generichash_final(state, 64);

  // Split PRK into new RK and new CK
  const newRK = prk.slice(0, 32);
  const newCK = prk.slice(32, 64);

  return [newRK, newCK];
};

// Key Derivation Function for Chain Keys (KDF_CK)
// KDF_CK(ck) returns a pair (32-byte Chain Key, 32-byte Message Key)
export const KDF_CK = async (ck: Uint8Array): Promise<[Uint8Array, Uint8Array]> => {
  await sodium.ready;
  // Message Key (HMAC with 0x01)
  const mkInput = new Uint8Array([0x01]);
  const mkState = sodium.crypto_generichash_init(ck, 32);
  sodium.crypto_generichash_update(mkState, mkInput);
  const mk = sodium.crypto_generichash_final(mkState, 32);

  // New Chain Key (HMAC with 0x02)
  const ckInput = new Uint8Array([0x02]);
  const ckState = sodium.crypto_generichash_init(ck, 32);
  sodium.crypto_generichash_update(ckState, ckInput);
  const nextCK = sodium.crypto_generichash_final(ckState, 32);

  return [nextCK, mk];
};

export const initRatchetSender = async (sharedSecret: Uint8Array, bobPublicKey: Uint8Array): Promise<RatchetState> => {
  await sodium.ready;
  // Alice starts with a fresh ratchet key pair
  const DHs = sodium.crypto_box_keypair();
  const DHr = bobPublicKey;

  console.log(`[Ratchet] initRatchetSender: DHr length is ${DHr ? DHr.length : 'undefined'}`);

  // Alice starts at RK0 with NO sending chain yet.
  // She will derive CKs when she sends her first message, which will trigger a DH ratchet step.
  console.log(`[Ratchet] Sender Init - RK: ${sodium.to_hex(sharedSecret).substring(0, 8)}..., DHs: ${sodium.to_hex(DHs.publicKey).substring(0, 8)}...`);
  return {
    DHs,
    DHr,
    RK: sharedSecret,
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKsKIPPED: {},
  };
};

// Initializes the state for the entity that responds to the session (Bob)
export const initRatchetReceiver = async (sharedSecret: Uint8Array, bobRatchetKeyPair: KeyPair): Promise<RatchetState> => {
  await sodium.ready;
  console.log(`[Ratchet] Receiver Init - RK: ${sodium.to_hex(sharedSecret).substring(0, 8)}..., DHs: ${sodium.to_hex(bobRatchetKeyPair.publicKey).substring(0, 8)}...`);
  return {
    DHs: bobRatchetKeyPair,
    DHr: null,
    RK: sharedSecret, // Bob's initial RK is just the shared secret
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKsKIPPED: {},
  };
};

// Perform a DH Ratchet step (called when receiving a message with a new DH key)
export const ratchetStep = async (state: RatchetState, remotePublicKey: Uint8Array): Promise<RatchetState> => {
  await sodium.ready;
  const newState: RatchetState = { 
    ...state,
    MKsKIPPED: { ...state.MKsKIPPED } 
  };
  newState.PN = state.Ns;
  newState.Ns = 0;
  newState.Nr = 0;
  newState.DHr = remotePublicKey;

  // 1. Advance Root Chain to derive new receiving chain (CKr)
  // Logic: RK, CKr = KDF_RK(RK, DH(DHs, DHr))
  const dhReceiving = await performKeyExchange(state.DHs.privateKey, newState.DHr!);
  const [rk1, ckr] = await KDF_RK(state.RK, dhReceiving);
  newState.RK = rk1;
  newState.CKr = ckr;

  // 2. Generate NEW local DH key and advance Root Chain to derive new sending chain (CKs)
  // Logic: DHs = GENERATE_DH(), RK, CKs = KDF_RK(RK, DH(DHs, DHr))
  newState.DHs = sodium.crypto_box_keypair();
  const dhSending = await performKeyExchange(newState.DHs.privateKey, newState.DHr!);
  const [rk2, cks] = await KDF_RK(newState.RK, dhSending);
  newState.RK = rk2;
  newState.CKs = cks;

  console.log(`[Ratchet] STEP - New RK: ${sodium.to_hex(newState.RK).substring(0, 8)}..., Ns: ${newState.Ns}, Nr: ${newState.Nr}`);
  return newState;
};

export interface RatchetMessageHeader {
  DHs: Uint8Array;
  pn: number;
  n: number;
}

export const ratchetEncrypt = async (
  state: RatchetState,
  plaintext: string | Uint8Array,
  associatedData: Uint8Array | null = null
): Promise<{ state: RatchetState; header: RatchetMessageHeader; ciphertext: Uint8Array }> => {
  await sodium.ready;
  let newState: RatchetState = { 
    ...state,
    MKsKIPPED: { ...state.MKsKIPPED } 
  };
  
  // If we don't have a sending chain key (e.g. Alice just initialized, or Bob just received),
  // we must advance the DH ratchet to get a sending chain.
  if (!newState.CKs) {
      console.log(`[Ratchet] ratchetEncrypt: DHr is ${newState.DHr ? 'present (len:' + newState.DHr.length + ')' : 'null/undefined'}`);
      if (!newState.DHr || newState.DHr.length === 0) {
          throw new Error("Cannot encrypt: remote ratchet key (DHr) unknown or empty");
      }
      // Advance sending chain using our CURRENT keys
      const dhSending = await performKeyExchange(newState.DHs.privateKey, newState.DHr);
      const [rk, cks] = await KDF_RK(newState.RK, dhSending);
      newState.RK = rk;
      newState.CKs = cks;
  }
  
  // Evolve sending chain
  const [nextCKs, mk] = await KDF_CK(newState.CKs);
  newState.CKs = nextCKs;
  
  const header: RatchetMessageHeader = {
      DHs: newState.DHs.publicKey,
      pn: newState.PN,
      n: newState.Ns
  };
  
  newState.Ns++;
  
  const encrypted = await encryptMessage(plaintext, mk, associatedData);
  
  // Since we encrypt purely the AD and plaintext payloads, the output ciphertext
  // binds cryptographically to the MK.
  // The nonce is prepended or passed. For Signal, we usually append/prepend the header
  // Let's bundle the ciphertext and nonce together
  const combinedCiphertext = new Uint8Array(encrypted.nonce.length + encrypted.ciphertext.length);
  combinedCiphertext.set(encrypted.nonce);
  combinedCiphertext.set(encrypted.ciphertext, encrypted.nonce.length);
  
  return { state: newState, header, ciphertext: combinedCiphertext };
};

export const ratchetDecrypt = async (
  state: RatchetState,
  header: RatchetMessageHeader,
  combinedCiphertext: Uint8Array,
  associatedData: Uint8Array | null = null
): Promise<{ state: RatchetState; plaintext: Uint8Array }> => {
  await sodium.ready;
  let newState: RatchetState = { 
    ...state,
    MKsKIPPED: { ...state.MKsKIPPED } 
  };
  
  // 1. Check if the message key has already been skipped and stored
  const keyIdentifier = sodium.to_hex(header.DHs) + ':' + header.n;
  if (newState.MKsKIPPED[keyIdentifier]) {
      const mk = newState.MKsKIPPED[keyIdentifier];
      const nonce = combinedCiphertext.slice(0, sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
      const rawCiphertext = combinedCiphertext.slice(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
      
      const decrypted = await decryptMessage(rawCiphertext, nonce, mk, associatedData);
      if (!decrypted) {
          throw new Error("MAC failure with skipped key");
      }
      
      // Remove the used key
      delete newState.MKsKIPPED[keyIdentifier];
      return { state: newState, plaintext: decrypted };
  }

  // 2. Handle DH Ratchet step if the header's DH key is new
  if (!newState.DHr || sodium.compare(header.DHs, newState.DHr) !== 0) {
      // Before stepping the DH ratchet, we must skip all remaining messages in the OLD receiving chain
      // and store their message keys (if any skipped/future messages were expected)
      // This is simplified: in a full implementation we'd handle max skip limits.
      
      newState = await ratchetStep(newState, header.DHs);
  }
  
  if (!newState.CKr) {
      throw new Error("Double Ratchet receiving chain key not initialized");
  }
  
  // 3. Step the receiving chain until we hit the requested message number
  while (newState.Nr < header.n) {
      const [nextCKr, skippedMk] = await KDF_CK(newState.CKr);
      newState.CKr = nextCKr;
      const skippedId = sodium.to_hex(header.DHs) + ':' + newState.Nr;
      newState.MKsKIPPED[skippedId] = skippedMk;
      newState.Nr++;

      // Safety: dont skip too many keys (DoS protection)
      if (Object.keys(newState.MKsKIPPED).length > 100) {
          throw new Error("Too many skipped keys. Security policy violation.");
      }
  }
  
  // 4. Evolve the chain for the current message
  const [nextCKr, mk] = await KDF_CK(newState.CKr);
  newState.CKr = nextCKr;
  newState.Nr++;
  
  // Setup nonce/ciphertext unpacking
  const nonce = combinedCiphertext.slice(0, sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
  const rawCiphertext = combinedCiphertext.slice(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
  
  const decrypted = await decryptMessage(rawCiphertext, nonce, mk, associatedData);
  if (!decrypted) {
      throw new Error("MAC failure or tampered ciphertext");
  }
  
  return { state: newState, plaintext: decrypted };
};

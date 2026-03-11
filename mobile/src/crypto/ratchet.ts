import sodium from 'libsodium-wrappers';
import { performKeyExchange } from './exchange';
import { encryptMessage, decryptMessage } from './encryption';
import { KeyPair } from './keys';

export interface RatchetState {
  DHs: KeyPair;               // DH Ratchet key pair (self)
  DHr: Uint8Array | null;     // DH Ratchet public key (remote)
  RK: Uint8Array;             // 32-byte Root Key
  CKs: Uint8Array | null;     // 32-byte Chain Key for sending
  CKr: Uint8Array | null;     // 32-byte Chain Key for receiving
  Ns: number;                 // Message number for sending
  Nr: number;                 // Message number for receiving
  PN: number;                 // Previous sending chain length
  MKsKIPPED: Record<string, Uint8Array>;
}

// ─────────────────────────────────────────────
//  KDF Functions
// ─────────────────────────────────────────────

export const KDF_RK = async (rk: Uint8Array, dhOut: Uint8Array): Promise<[Uint8Array, Uint8Array]> => {
  await sodium.ready;
  const state = sodium.crypto_generichash_init(rk, 64);
  sodium.crypto_generichash_update(state, dhOut);
  const prk = sodium.crypto_generichash_final(state, 64);
  return [prk.slice(0, 32), prk.slice(32, 64)];
};

export const KDF_CK = async (ck: Uint8Array): Promise<[Uint8Array, Uint8Array]> => {
  await sodium.ready;
  const mkState = sodium.crypto_generichash_init(ck, 32);
  sodium.crypto_generichash_update(mkState, new Uint8Array([0x01]));
  const mk = sodium.crypto_generichash_final(mkState, 32);

  const ckState = sodium.crypto_generichash_init(ck, 32);
  sodium.crypto_generichash_update(ckState, new Uint8Array([0x02]));
  const nextCK = sodium.crypto_generichash_final(ckState, 32);

  return [nextCK, mk];
};

// ─────────────────────────────────────────────
//  Bidirectional Session Initialization
//  Both sides can send AND receive immediately.
// ─────────────────────────────────────────────

export const initRatchetBidirectional = async (
  sharedSecret: Uint8Array,
  myKeyPair: KeyPair,
  peerPublicKey: Uint8Array,
  isAlice: boolean
): Promise<RatchetState> => {
  await sodium.ready;

  // Derive RK + two directional chain keys from the shared secret.
  // alice_chain = Alice→Bob direction, bob_chain = Bob→Alice direction.
  const a2bSeed = sodium.crypto_generichash(32, sharedSecret, sodium.from_string("g-sec-a2b"));
  const b2aSeed = sodium.crypto_generichash(32, sharedSecret, sodium.from_string("g-sec-b2a"));
  const rk     = sodium.crypto_generichash(32, sharedSecret, sodium.from_string("g-sec-rk0"));

  const CKs = isAlice ? a2bSeed : b2aSeed;
  const CKr = isAlice ? b2aSeed : a2bSeed;

  console.log(`[Ratchet] initBidirectional role=${isAlice ? 'ALICE' : 'BOB'} RK=${sodium.to_hex(rk).substring(0,8)}... CKs=${sodium.to_hex(CKs).substring(0,8)}... CKr=${sodium.to_hex(CKr).substring(0,8)}...`);

  return {
    DHs: myKeyPair,
    DHr: peerPublicKey,
    RK: rk,
    CKs,
    CKr,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKsKIPPED: {},
  };
};

// ─────────────────────────────────────────────
//  DH Ratchet Step (on receiving a new DH key)
// ─────────────────────────────────────────────

export const ratchetStep = async (state: RatchetState, remotePublicKey: Uint8Array): Promise<RatchetState> => {
  await sodium.ready;
  const newState: RatchetState = { ...state, MKsKIPPED: { ...state.MKsKIPPED } };

  newState.PN = state.Ns;
  newState.Ns = 0;
  newState.Nr = 0;
  newState.DHr = remotePublicKey;

  // Derive new receiving chain
  const dhRecv = await performKeyExchange(state.DHs.privateKey, newState.DHr);
  const [rk1, ckr] = await KDF_RK(state.RK, dhRecv);
  newState.RK = rk1;
  newState.CKr = ckr;

  // Generate new DH pair and derive new sending chain
  newState.DHs = sodium.crypto_box_keypair();
  const dhSend = await performKeyExchange(newState.DHs.privateKey, newState.DHr);
  const [rk2, cks] = await KDF_RK(newState.RK, dhSend);
  newState.RK = rk2;
  newState.CKs = cks;

  console.log(`[Ratchet] STEP - New RK: ${sodium.to_hex(newState.RK).substring(0, 8)}..., Ns: ${newState.Ns}, Nr: ${newState.Nr}`);
  return newState;
};

// ─────────────────────────────────────────────
//  Encrypt
// ─────────────────────────────────────────────

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
  let newState: RatchetState = { ...state, MKsKIPPED: { ...state.MKsKIPPED } };

  if (!newState.CKs) {
    throw new Error("Cannot encrypt: sending chain not initialized");
  }

  const [nextCKs, mk] = await KDF_CK(newState.CKs);
  newState.CKs = nextCKs;

  const header: RatchetMessageHeader = {
    DHs: newState.DHs.publicKey,
    pn: newState.PN,
    n: newState.Ns
  };
  newState.Ns++;

  console.log(`[Ratchet] encrypt n=${header.n} DHs=${sodium.to_hex(header.DHs).substring(0,8)}...`);

  const encrypted = await encryptMessage(plaintext, mk, associatedData);
  const combined = new Uint8Array(encrypted.nonce.length + encrypted.ciphertext.length);
  combined.set(encrypted.nonce);
  combined.set(encrypted.ciphertext, encrypted.nonce.length);

  return { state: newState, header, ciphertext: combined };
};

// ─────────────────────────────────────────────
//  Decrypt
// ─────────────────────────────────────────────

const MAX_SKIP = 100;

export const ratchetDecrypt = async (
  state: RatchetState,
  header: RatchetMessageHeader,
  combinedCiphertext: Uint8Array,
  associatedData: Uint8Array | null = null
): Promise<{ state: RatchetState; plaintext: Uint8Array }> => {
  await sodium.ready;
  let newState: RatchetState = { ...state, MKsKIPPED: { ...state.MKsKIPPED } };

  console.log(`[Ratchet] decrypt attempt n=${header.n} pn=${header.pn} DHs=${sodium.to_hex(header.DHs).substring(0,8)}...`);

  // 1. Try skipped message keys first
  const keyId = sodium.to_hex(header.DHs) + ':' + header.n;
  if (newState.MKsKIPPED[keyId]) {
    const mk = newState.MKsKIPPED[keyId];
    const nonce = combinedCiphertext.slice(0, sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    const raw   = combinedCiphertext.slice(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    const dec = await decryptMessage(raw, nonce, mk, associatedData);
    if (!dec) throw new Error("MAC failure with skipped key");
    delete newState.MKsKIPPED[keyId];
    return { state: newState, plaintext: dec };
  }

  // 2. DH ratchet step if the header carries a new DH key
  const needsStep = !newState.DHr || !arraysEqual(header.DHs, newState.DHr);
  if (needsStep) {
    // Skip remaining messages in the old receiving chain
    if (newState.CKr && newState.DHr) {
      newState = await skipMessageKeys(newState, header.pn);
    }
    console.log(`[Ratchet] New DH key detected, performing ratchet step`);
    newState = await ratchetStep(newState, header.DHs);
  }

  if (!newState.CKr) {
    throw new Error("Receiving chain key not initialized after ratchet step");
  }

  // 3. Skip to the correct message number
  newState = await skipMessageKeys(newState, header.n);

  // 4. Derive message key for this message
  const [nextCKr, mk] = await KDF_CK(newState.CKr);
  newState.CKr = nextCKr;
  newState.Nr++;

  const nonce = combinedCiphertext.slice(0, sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
  const raw   = combinedCiphertext.slice(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);

  const decrypted = await decryptMessage(raw, nonce, mk, associatedData);
  if (!decrypted) {
    throw new Error("MAC failure or tampered ciphertext");
  }

  return { state: newState, plaintext: decrypted };
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

async function skipMessageKeys(state: RatchetState, until: number): Promise<RatchetState> {
  const newState = { ...state, MKsKIPPED: { ...state.MKsKIPPED } };
  if (!newState.CKr) return newState;

  while (newState.Nr < until) {
    const [nextCKr, skippedMk] = await KDF_CK(newState.CKr);
    newState.CKr = nextCKr;
    const skippedId = (newState.DHr ? sodium.to_hex(newState.DHr) : 'init') + ':' + newState.Nr;
    newState.MKsKIPPED[skippedId] = skippedMk;
    newState.Nr++;

    if (Object.keys(newState.MKsKIPPED).length > MAX_SKIP) {
      throw new Error("Too many skipped keys — security policy violation");
    }
  }
  return newState;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

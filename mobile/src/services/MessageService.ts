import sodium from 'libsodium-wrappers';
import { socketService } from './socket';
import { getRatchetState, saveRatchetState, saveChatMessage, getUserId } from '../storage/db';
import { ratchetDecrypt, ratchetEncrypt, RatchetMessageHeader } from '../crypto/ratchet';
import { computeAsynchronous3DH, PeerKeyBundle } from '../crypto/prekey';
import { getIdentityKeyPair, getPreKeyPair } from '../crypto/keys';
import { getPeerKeys } from './api';

class MessageService {
    private isInitialized = false;
    private uiListeners: Set<() => void> = new Set();
    private processingQueue: Promise<void> = Promise.resolve();
    private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

    // Expose the underlying WebSocket for AnonymousChatScreen direct sends
    get socket(): WebSocket | null {
        return (socketService as any).ws || null;
    }

    // Event emitter compatibility (used by AnonymousChatScreen for anon_message)
    on(event: string, handler: (payload: any) => void) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
        this.eventListeners.get(event)!.add(handler);
    }

    off(event: string, handler: (payload: any) => void) {
        this.eventListeners.get(event)?.delete(handler);
    }

    private emitEvent(event: string, payload: any) {
        this.eventListeners.get(event)?.forEach(h => h(payload));
    }

    async init() {
        if (this.isInitialized) return;
        await sodium.ready;
        socketService.addListener(this.handleIncomingMessage.bind(this));
        socketService.connect();
        this.isInitialized = true;
        console.log("[MessageService] Global listener and socket initialized");
    }

    addUIListener(callback: () => void) { this.uiListeners.add(callback); }
    removeUIListener(callback: () => void) { this.uiListeners.delete(callback); }
    private notifyUI() { this.uiListeners.forEach(l => l()); }

    // ─────────────────────────────────────────────
    //  ENSURE SESSION (async PreKey-based)
    // ─────────────────────────────────────────────
    async ensureSession(peerId: string): Promise<boolean> {
        const existing = await getRatchetState(peerId);
        if (existing) {
            console.log(`[MessageService] Session exists for ${peerId.slice(-4)}`);
            return true;
        }

        const myId = await getUserId();
        const myIdentityKeys = await getIdentityKeyPair();
        const myPreKeys = await getPreKeyPair();
        if (!myId || !myIdentityKeys || !myPreKeys) {
            console.error("[MessageService] Cannot ensureSession: no userId or keys");
            return false;
        }

        console.log(`[MessageService] No session for ${peerId.slice(-4)}. Fetching PreKey bundle...`);

        const peerKeysRaw = await getPeerKeys(peerId);
        if (!peerKeysRaw || !peerKeysRaw.identityKeyPublic || !peerKeysRaw.preKeyPublic) {
            console.error(`[MessageService] Could not fetch keys for ${peerId.slice(-4)}`);
            return false;
        }

        const INVALID = ['PLACEHOLDER', 'PENDING', 'null', 'undefined', ''];
        let peerBundle: PeerKeyBundle;
        try {
            const parseKey = (raw: string): Uint8Array => {
                if (!raw || INVALID.includes(raw)) throw new Error(`Key not uploaded: "${raw}"`);
                if (raw.startsWith('[')) return new Uint8Array(JSON.parse(raw));
                return sodium.from_base64(raw);
            };
            peerBundle = {
                identityKeyPublic: parseKey(peerKeysRaw.identityKeyPublic),
                preKeyPublic: parseKey(peerKeysRaw.preKeyPublic)
            };
            console.log(`[MessageService] Parsed peer bundle: identity=${peerBundle.identityKeyPublic.length}B, prekey=${peerBundle.preKeyPublic.length}B`);
        } catch (e) {
            console.error(`[MessageService] Failed to parse peer key bundle:`, e);
            return false;
        }

        try {
            const { state } = await computeAsynchronous3DH(myId, peerId, myIdentityKeys, myPreKeys, peerBundle);
            await saveRatchetState(peerId, state);
            console.log(`[MessageService] ✅ Session established with ${peerId.slice(-4)}`);
            return true;
        } catch (e) {
            console.error(`[MessageService] Failed to compute 3DH:`, e);
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  SEND
    // ─────────────────────────────────────────────
    async encryptAndSendMessage(peerId: string, plaintext: string, timer: number = 0) {
        const sessionReady = await this.ensureSession(peerId);
        if (!sessionReady) throw new Error("Could not establish secure session.");

        return new Promise<void>((resolve, reject) => {
            this.processingQueue = this.processingQueue.then(async () => {
                try {
                    const ratchetState = await getRatchetState(peerId);
                    if (!ratchetState) throw new Error("Session lost after ensureSession");

                    const ad = sodium.from_string("g-sec-chat");
                    const ptBytes = sodium.from_string(plaintext);
                    console.log(`[MessageService/Tx] Plaintext "${plaintext}" len=${ptBytes.length}`);

                    const enc = await ratchetEncrypt(ratchetState, ptBytes, ad);
                    await saveRatchetState(peerId, enc.state);

                    const flatHeader = {
                        DHs: Array.from(enc.header.DHs),
                        pn: enc.header.pn,
                        n: enc.header.n
                    };

                    console.log(`[MessageService/Tx] Ciphertext len=${enc.ciphertext.length} n=${enc.header.n}`);
                    const sent = socketService.sendChatMessage(peerId, enc.ciphertext, flatHeader, timer);
                    if (!sent) {
                        console.warn(`[MessageService] WebSocket not open. Message queued by socket service.`);
                    }
                    console.log(`[MessageService] ENCRYPTED & SENT to ${peerId.slice(-4)}`);
                    resolve();
                } catch (e) {
                    console.error("[MessageService] Encryption failed:", e);
                    reject(e);
                }
            });
        });
    }

    // ─────────────────────────────────────────────
    //  INCOMING MESSAGE HANDLER
    // ─────────────────────────────────────────────
    private async handleIncomingMessage(payload: any) {
        this.processingQueue = this.processingQueue.then(async () => {
            try {
                await this.processMessageInternal(payload);
            } catch (e) {
                console.error("[MessageService] Queue processing error:", e);
            }
        });
    }

    private async processMessageInternal(payload: any) {
        try {
            const myId = await getUserId();
            if (!myId) return;

            if (payload.type === 'chat_message') {
                const peerId = payload.senderId;
                console.log(`[MessageService/Rx] chat_message from ${peerId.slice(-4)} ciphertext len=${payload.ciphertext?.length || 0}`);

                // Ensure session exists
                let ratchetState = await getRatchetState(peerId);
                if (!ratchetState) {
                    console.log(`[MessageService] No session for ${peerId.slice(-4)}, establishing...`);
                    const ok = await this.ensureSession(peerId);
                    if (!ok) {
                        console.warn(`[MessageService] Cannot establish session. Message discarded.`);
                        return;
                    }
                    ratchetState = await getRatchetState(peerId);
                    if (!ratchetState) return;
                }

                const ciphertext = new Uint8Array(payload.ciphertext);
                const header: RatchetMessageHeader = {
                    DHs: new Uint8Array(payload.header.DHs),
                    pn: payload.header.pn,
                    n: payload.header.n
                };

                try {
                    const dec = await ratchetDecrypt(ratchetState, header, ciphertext, sodium.from_string("g-sec-chat"));
                    await saveRatchetState(peerId, dec.state);

                    const messageText = sodium.to_string(dec.plaintext);
                    console.log(`[MessageService] ✅ DECRYPTED from ${peerId.slice(-4)}: "${messageText.substring(0, 20)}"`);

                    let expiresAt: string | undefined;
                    if (payload.timer && payload.timer > 0) {
                        expiresAt = new Date(Date.now() + payload.timer * 1000).toISOString();
                    }

                    await saveChatMessage(peerId, {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        text: messageText,
                        isSender: false,
                        timestamp: new Date().toISOString(),
                        expiresAt
                    });

                    this.notifyUI();
                } catch (decErr) {
                    // DO NOT auto-reset — that causes session thrashing.
                    // Just log and discard the unreadable message.
                    console.error(`[MessageService] Decrypt FAILED for ${peerId.slice(-4)}:`, decErr);
                    console.warn(`[MessageService] Message discarded. Session preserved to avoid thrashing.`);
                }
            }

            // Anonymous room messages — forward to event listeners (AnonymousChatScreen)
            if (payload.type === 'anon_message') {
                this.emitEvent('anon_message', payload);
            }
        } catch (error) {
            console.error("[MessageService] CRITICAL ERROR:", error);
        }
    }
}

export const messageService = new MessageService();

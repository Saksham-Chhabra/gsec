import sodium from 'libsodium-wrappers';
import { socketService } from './socket';
import { getRatchetState, saveRatchetState, saveChatMessage, getUserId, resetRatchetState } from '../storage/db';
import { ratchetDecrypt, ratchetEncrypt, RatchetMessageHeader } from '../crypto/ratchet';
import { processHandshake, createHandshakeResponse, createHandshakeInit } from '../crypto/handshake';
import { getIdentityKeyPair } from '../crypto/keys';

const HANDSHAKE_TIMEOUT_MS = 10_000; // 10 seconds to wait for handshake response

interface PendingMessage {
    payload: any;
    retries: number;
}

class MessageService {
    private isInitialized = false;
    private uiListeners: Set<() => void> = new Set();
    private processingQueue: Promise<void> = Promise.resolve();
    private pendingMessages: Map<string, PendingMessage[]> = new Map();

    // Handshake tracking: resolves when key_exchange_response arrives for a given peerId
    private handshakeResolvers: Map<string, () => void> = new Map();

    async init() {
        if (this.isInitialized) return;
        await sodium.ready;
        socketService.addListener(this.handleIncomingMessage.bind(this));
        socketService.connect();
        this.isInitialized = true;
        console.log("[MessageService] Global listener and socket initialized");
    }

    addUIListener(callback: () => void) {
        this.uiListeners.add(callback);
    }

    removeUIListener(callback: () => void) {
        this.uiListeners.delete(callback);
    }

    private notifyUI() {
        this.uiListeners.forEach(l => l());
    }

    // ─────────────────────────────────────────────────────────
    //  ENSURE SESSION — the core guarantee
    // ─────────────────────────────────────────────────────────
    async ensureSession(peerId: string): Promise<boolean> {
        const existing = await getRatchetState(peerId);
        if (existing) return true; // session already good

        const myId = await getUserId();
        const myKeys = await getIdentityKeyPair();
        if (!myId || !myKeys) {
            console.error("[MessageService] Cannot ensureSession: no userId or keys");
            return false;
        }

        console.log(`[MessageService] ensureSession: No session for ${peerId.slice(-4)}. Sending key_exchange...`);

        // Send key_exchange
        const handshake = await createHandshakeInit(myId, peerId, myKeys, myKeys);
        const sent = socketService.sendHandshake(peerId, handshake);
        if (!sent) {
            console.error("[MessageService] ensureSession: WebSocket not connected, cannot send handshake");
            return false;
        }

        // Wait for processHandshake to resolve (it will be triggered by incoming key_exchange_response)
        const sessionEstablished = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                this.handshakeResolvers.delete(peerId);
                console.warn(`[MessageService] ensureSession: Handshake timeout for ${peerId.slice(-4)}`);
                resolve(false);
            }, HANDSHAKE_TIMEOUT_MS);

            this.handshakeResolvers.set(peerId, () => {
                clearTimeout(timeout);
                this.handshakeResolvers.delete(peerId);
                resolve(true);
            });
        });

        if (sessionEstablished) {
            console.log(`[MessageService] ensureSession: Session established with ${peerId.slice(-4)} ✅`);
        }
        return sessionEstablished;
    }

    // ─────────────────────────────────────────────────────────
    //  SEND — guarantees session before encrypting
    // ─────────────────────────────────────────────────────────
    async encryptAndSendMessage(peerId: string, plaintext: string, timer: number = 0) {
        // ensureSession runs OUTSIDE the queue so the handshake listener can still process
        const sessionReady = await this.ensureSession(peerId);
        if (!sessionReady) {
            throw new Error("Could not establish secure session. Is the peer online?");
        }

        return new Promise<void>((resolve, reject) => {
            this.processingQueue = this.processingQueue.then(async () => {
                try {
                    const ratchetState = await getRatchetState(peerId);
                    if (!ratchetState) throw new Error("Session lost after ensureSession");

                    const ad = sodium.from_string("g-sec-chat");
                    const enc = await ratchetEncrypt(ratchetState, sodium.from_string(plaintext), ad);
                    await saveRatchetState(peerId, enc.state);

                    const flatHeader = {
                        DHs: Array.from(enc.header.DHs),
                        pn: enc.header.pn,
                        n: enc.header.n
                    };

                    socketService.sendChatMessage(peerId, enc.ciphertext, flatHeader, timer);
                    console.log(`[MessageService] ENCRYPTED & SENT to ${peerId.slice(-4)}`);
                    resolve();
                } catch (e) {
                    console.error("[MessageService] Encryption failed:", e);
                    reject(e);
                }
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    //  INCOMING MESSAGE HANDLER
    // ─────────────────────────────────────────────────────────
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

            // ── 1. HANDSHAKES ──────────────────────────────────
            if (payload.type === 'key_exchange' || payload.type === 'key_exchange_response') {
                const myKeys = await getIdentityKeyPair();
                if (!myKeys) return;

                const peerId = payload.senderId;
                const isInitiator = payload.type === 'key_exchange_response';
                const { state } = await processHandshake(payload, myKeys, myKeys, isInitiator);

                await saveRatchetState(peerId, state);
                console.log(`[MessageService] ✅ Handshake complete with ${peerId.slice(-4)} (isInitiator=${isInitiator})`);

                // If we received a key_exchange (init), respond with key_exchange_response
                if (payload.type === 'key_exchange') {
                    const response = await createHandshakeResponse(myId, peerId, myKeys, myKeys);
                    socketService.sendHandshake(peerId, response);
                    console.log(`[MessageService] Sent key_exchange_response to ${peerId.slice(-4)}`);
                }

                // Resolve any pending ensureSession promise for this peer
                const resolver = this.handshakeResolvers.get(peerId);
                if (resolver) {
                    resolver();
                }

                // Replay any queued messages for this peer
                const pending = this.pendingMessages.get(peerId) || [];
                if (pending.length > 0) {
                    console.log(`[MessageService] Replaying ${pending.length} queued messages for ${peerId.slice(-4)}`);
                    this.pendingMessages.delete(peerId);
                    for (const pm of pending) {
                        await this.processMessageInternal(pm.payload);
                    }
                }

                this.notifyUI();
                return;
            }

            // ── 2. CHAT MESSAGES ───────────────────────────────
            if (payload.type === 'chat_message') {
                const peerId = payload.senderId;
                console.log(`[MessageService] Processing chat_message from ${peerId.slice(-4)}`);

                let ratchetState = await getRatchetState(peerId);
                if (!ratchetState) {
                    // Queue this message; session will be created when handshake arrives
                    console.warn(`[MessageService] No session for ${peerId.slice(-4)}. Queuing message.`);
                    const existing = this.pendingMessages.get(peerId) || [];
                    if (existing.length < 20) {
                        existing.push({ payload, retries: 0 });
                        this.pendingMessages.set(peerId, existing);
                    }
                    return;
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
                    console.log(`[MessageService] ✅ DECRYPTED from ${peerId.slice(-4)}: "${messageText.substring(0, 20)}..."`);

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

                    console.log(`[MessageService] PERSISTED to DB for ${peerId.slice(-4)}`);
                    this.notifyUI();
                } catch (decryptError) {
                    console.error(`[MessageService] Decryption FAILED for ${peerId.slice(-4)}. Resetting and re-establishing...`, decryptError);

                    // Reset corrupted state
                    await resetRatchetState(peerId);

                    // Immediately re-establish session
                    console.log(`[MessageService] Auto re-establishing session with ${peerId.slice(-4)}...`);
                    const myKeys = await getIdentityKeyPair();
                    if (myKeys) {
                        const handshake = await createHandshakeInit(myId, peerId, myKeys, myKeys);
                        socketService.sendHandshake(peerId, handshake);
                        console.log(`[MessageService] Sent key_exchange to ${peerId.slice(-4)} for session recovery`);
                    }

                    this.notifyUI();
                }
            }
        } catch (error) {
            console.error("[MessageService] CRITICAL ERROR:", error);
        }
    }
}

export const messageService = new MessageService();

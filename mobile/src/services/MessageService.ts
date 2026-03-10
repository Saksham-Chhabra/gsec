import sodium from 'libsodium-wrappers';
import { socketService } from './socket';
import { getRatchetState, saveRatchetState, saveChatMessage, getUserId, resetRatchetState } from '../storage/db';
import { ratchetDecrypt, ratchetEncrypt, RatchetMessageHeader } from '../crypto/ratchet';
import { processHandshake, createHandshakeResponse } from '../crypto/handshake';
import { getIdentityKeyPair } from '../crypto/keys';

class MessageService {
    private isInitialized = false;
    private uiListeners: Set<() => void> = new Set();
    private processingQueue: Promise<void> = Promise.resolve();

    async init() {
        if (this.isInitialized) return;
        await sodium.ready;
        socketService.addListener(this.handleIncomingMessage.bind(this));
        
        // Attempt immediate connection if token exists
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

    async encryptAndSendMessage(peerId: string, plaintext: string, timer: number = 0) {
        return new Promise<void>((resolve, reject) => {
            this.processingQueue = this.processingQueue.then(async () => {
                try {
                    const ratchetState = await getRatchetState(peerId);
                    if (!ratchetState) throw new Error("No session active for this user");

                    const ad = sodium.from_string("g-sec-chat");
                    const enc = await ratchetEncrypt(ratchetState, sodium.from_string(plaintext), ad);
                    
                    await saveRatchetState(peerId, enc.state);

                    const flatHeader = {
                        DHs: Array.from(enc.header.DHs),
                        pn: enc.header.pn,
                        n: enc.header.n
                    };

                    socketService.sendChatMessage(peerId, enc.ciphertext, flatHeader, timer);
                    console.log(`[MessageService] ENCRYPTED & SENT to ${peerId}`);
                    resolve();
                } catch (e) {
                    console.error("[MessageService] Encryption failed:", e);
                    reject(e);
                }
            });
        });
    }

    private async handleIncomingMessage(payload: any) {
        // Enforce sequential processing to avoid state race conditions
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

            // 1. Handle Handshakes
            if (payload.type === 'key_exchange' || payload.type === 'key_exchange_response') {
                const myKeys = await getIdentityKeyPair();
                if (!myKeys) return;

                const peerId = payload.senderId;
                const isInitiator = payload.type === 'key_exchange_response';
                const { state } = await processHandshake(payload, myKeys, myKeys, isInitiator);
                
                await saveRatchetState(peerId, state);
                
                if (payload.type === 'key_exchange') {
                    // Generate fresh ephemeral ratchet key for response
                    const ratchetKeys = sodium.crypto_box_keypair();
                    const response = await createHandshakeResponse(myId, peerId, myKeys, ratchetKeys);
                    socketService.sendHandshake(peerId, response);
                }
                console.log(`[MessageService] Handshake handled with ${peerId}`);
                this.uiListeners.forEach(l => l());
                return;
            }

            // 2. Handle Chat Messages
            if (payload.type === 'chat_message') {
                const peerId = payload.senderId;
                console.log(`[MessageService] Processing chat_message from ${peerId}`);
                
                const ratchetState = await getRatchetState(peerId);
                if (!ratchetState) {
                    console.error(`[MessageService] DROP: No E2EE session for ${peerId}`);
                    return;
                }

                const ciphertext = new Uint8Array(payload.ciphertext);
                const header: RatchetMessageHeader = {
                    DHs: new Uint8Array(payload.header.DHs),
                    pn: payload.header.pn,
                    n: payload.header.n
                };

                console.log(`[MessageService] Decrypting ciphertext (len: ${ciphertext.length})...`);
                
                try {
                    const dec = await ratchetDecrypt(ratchetState, header, ciphertext, sodium.from_string("g-sec-chat"));
                    
                    await saveRatchetState(peerId, dec.state);
                    const messageText = sodium.to_string(dec.plaintext);
                    console.log(`[MessageService] DECRYPTED: "${messageText.substring(0, 10)}..."`);
                    
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

                    console.log(`[MessageService] PERSISTED to DB for ${peerId}`);
                    this.uiListeners.forEach(l => l());
                } catch (decryptError) {
                    console.error("[MessageService] Decryption failed! Triggering security reset...", decryptError);
                    // Critical MAC Failure: Reset the session to allow a fresh handshake
                    await resetRatchetState(peerId);
                    this.uiListeners.forEach(l => l()); // Notify UI to show "Securing Channel" again
                }
            }
        } catch (error) {
            console.error("[MessageService] CRITICAL ERROR during processing:", error);
        }
    }
}

export const messageService = new MessageService();

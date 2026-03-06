import { Schema, model, Document } from 'mongoose';

export interface IOfflineMessage extends Document {
    recipientId: Schema.Types.ObjectId;
    senderId: Schema.Types.ObjectId;
    encryptedPayload: string; // Base64 encoded ChaCha20-Poly1305 ciphertext
    createdAt: Date;
}

const OfflineMessageSchema = new Schema<IOfflineMessage>({
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    encryptedPayload: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export const OfflineMessage = model<IOfflineMessage>('OfflineMessage', OfflineMessageSchema);

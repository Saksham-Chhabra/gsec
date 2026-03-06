import { Schema, model, Document } from 'mongoose';

export interface ISession extends Document {
    userId: Schema.Types.ObjectId;
    sessionToken: string;
    deviceId: string;
    expiresAt: Date;
}

const SessionSchema = new Schema<ISession>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionToken: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

export const Session = model<ISession>('Session', SessionSchema);

import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    username: string;
    passwordHash: string;
    identityKeyPublic: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    identityKeyPublic: { type: String, required: true }, // Stored for key exchange
    createdAt: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', UserSchema);

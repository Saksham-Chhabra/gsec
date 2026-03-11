import { Schema, model, Document, Types } from 'mongoose';

export interface RoomMember {
    userId: Types.ObjectId;
    anonymousId: string;
}

export interface IRoom extends Document {
    roomId: string; // The short '7XK9A2' code
    passwordHash: string; // The hashed '4TLMQ' code
    createdBy: Types.ObjectId;
    createdAt: Date;
    lastActivityAt: Date;
    status: 'active' | 'idle' | 'expired';
    members: RoomMember[];
    maxMembers: number;
}

const RoomSchema = new Schema<IRoom>({
    roomId: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'idle', 'expired'], default: 'active' },
    members: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        anonymousId: { type: String }
    }],
    maxMembers: { type: Number, default: 10 }
});

// Auto-update lastActivityAt when members are modified
RoomSchema.pre('save', function(this: any) {
    if (this.isModified('members')) {
        this.lastActivityAt = new Date();
    }
});

export const Room = model<IRoom>('Room', RoomSchema);

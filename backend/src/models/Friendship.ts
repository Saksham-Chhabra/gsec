import { Schema, model, Document, Types } from 'mongoose';

export interface IFriendship extends Document {
    userA: Types.ObjectId;
    userB: Types.ObjectId;
    createdAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>({
    userA: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userB: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: Date.now }
});

// Create a compound index to ensure pairs are unique, regardless of order.
// We'll enforce that userA is always the lexicographically smaller ID to simplify queries.
FriendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });

export const Friendship = model<IFriendship>('Friendship', FriendshipSchema);

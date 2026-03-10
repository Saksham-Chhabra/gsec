const mongoose = require('mongoose');
const argon2 = require('argon2');
const sodium = require('libsodium-wrappers');

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect('mongodb://127.0.0.1:27017/g-sec');
        console.log('Connected.');

        await sodium.ready;
        console.log('Libsodium ready.');

        const UserSchema = new mongoose.Schema({
            username: { type: String, required: true, unique: true },
            passwordHash: { type: String, required: true },
            identityKeyPublic: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        });
        const User = mongoose.models.User || mongoose.model('User', UserSchema);

        const password = 'password123';
        const hash = await argon2.hash(password);

        for (const username of ['Alice', 'Bob']) {
            console.log(`Seeding ${username}...`);
            const keys = sodium.crypto_box_keypair();
            await User.findOneAndUpdate(
                { username },
                { 
                    username, 
                    passwordHash: hash, 
                    identityKeyPublic: sodium.to_base64(keys.publicKey) 
                },
                { upsert: true }
            );
            console.log(`${username} seeded.`);
        }

        console.log('Seed complete! Password: password123');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

seed();

import mongoose from 'mongoose';
import argon2 from 'argon2';
import sodium from 'libsodium-wrappers';
import { User } from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/g-sec';

const seedUsers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        
        await sodium.ready;

        console.log('Seeding Alice...');
        const aliceKeys = sodium.crypto_box_keypair();
        const aliceHash = await argon2.hash('password123');
        
        const alicePreKeys = sodium.crypto_box_keypair();

        await User.findOneAndUpdate(
            { username: 'Alice' },
            { 
                username: 'Alice', 
                passwordHash: aliceHash, 
                identityKeyPublic: sodium.to_base64(aliceKeys.publicKey),
                preKeyPublic: sodium.to_base64(alicePreKeys.publicKey)
            },
            { upsert: true }
        );
        console.log('Created User: Alice');
        console.log(`Alice Private Key (Base64): ${sodium.to_base64(aliceKeys.privateKey)}`);

        // Create Bob
        console.log('Seeding Bob...');
        const bobKeys = sodium.crypto_box_keypair();
        const bobHash = await argon2.hash('password123');
        
        const bobPreKeys = sodium.crypto_box_keypair();

        await User.findOneAndUpdate(
            { username: 'Bob' },
            { 
                username: 'Bob', 
                passwordHash: bobHash, 
                identityKeyPublic: sodium.to_base64(bobKeys.publicKey),
                preKeyPublic: sodium.to_base64(bobPreKeys.publicKey)
            },
            { upsert: true }
        );
        console.log('Created User: Bob');
        console.log(`Bob Private Key (Base64): ${sodium.to_base64(bobKeys.privateKey)}`);
        
        console.log('\nSeed complete! You can log in as Alice or Bob with password: password123');
        
    } catch (e) {
        console.error('Seeding error:', e);
    } finally {
        await mongoose.disconnect();
    }
};

seedUsers();

import mongoose from 'mongoose';
import argon2 from 'argon2';
import sodium from 'libsodium-wrappers';
import { User } from './src/models/User';
import dotenv from 'dotenv';

dotenv.config();

const usersToSeed = [
    {
        email: 'dhimansabhya@gmail.com',
        password: 'sabhya1024@',
        username: 'Sabhya_' + Math.floor(Math.random() * 1000)
    },
    {
        email: 'dhimansbhya1@gmail.com',
        password: 'sabhya1024@',
        username: 'Sabhya1_' + Math.floor(Math.random() * 1000)
    }
];

const seed = async () => {
    await sodium.ready;
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/g-sec';
    
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for seeding...');

        for (const u of usersToSeed) {
            const existing = await User.findOne({ email: u.email });
            if (existing) {
                console.log(`User ${u.email} already exists, skipping.`);
                continue;
            }

            const passwordHash = await argon2.hash(u.password);
            
            // Generate identity key pair for E2EE
            const keyPair = sodium.crypto_box_keypair();
            const identityKeyPublic = sodium.to_base64(keyPair.publicKey);

            const newUser = new User({
                username: u.username,
                email: u.email,
                passwordHash,
                identityKeyPublic
            });

            await newUser.save();
            console.log(`Seeded user: ${u.username} (${u.email})`);
        }

        console.log('Seeding complete!');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

seed();

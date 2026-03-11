import { Request, Response } from 'express';
import argon2 from 'argon2';
import crypto from 'crypto';
import { User } from '../models/User';
import { Session } from '../models/Session';

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { username, email, password, identityKeyPublic, preKeyPublic } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // 1. Email Regex Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // 2. Password Strength Validation (Min 8 characters, at least 1 number)
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        if (!/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one number' });
        }

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(409).json({ error: 'Username or Email already exists' });
        }

        const passwordHash = await argon2.hash(password);

        // identityKeyPublic might be sent later, but we allow it on registration if ready
        const user = new User({
            username,
            email,
            passwordHash,
            identityKeyPublic: identityKeyPublic || 'PENDING',
            preKeyPublic: preKeyPublic || 'PENDING'
        });

        await user.save();

        const sessionToken = crypto.randomBytes(32).toString('base64');
        const deviceId = req.headers['x-device-id'] as string || 'unknown';

        const session = new Session({
            userId: user._id,
            sessionToken,
            deviceId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        await session.save();

        res.status(201).json({ token: sessionToken, userId: user._id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { username, password, identityKeyPublic, preKeyPublic } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        console.log(`Login attempt for identifier: ${username}`);
        const user = await User.findOne({ 
            $or: [{ username }, { email: username }] 
        });
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.status(401).json({ error: `User identifier ${username} not found in database` });
        }

        const validPassword = await argon2.verify(user.passwordHash, password);
        if (!validPassword) {
            console.log(`Invalid password for user: ${username}`);
            return res.status(401).json({ error: 'Wrong password provided' });
        }
        console.log(`Login successful for user: ${username}`);

        // Update keys if provided during login (e.g. app reinstall or periodic rotation)
        if (identityKeyPublic || preKeyPublic) {
            // Frontend sends keys as number[] arrays or pre-serialized JSON strings
            if (identityKeyPublic) {
                user.identityKeyPublic = Array.isArray(identityKeyPublic) 
                    ? JSON.stringify(identityKeyPublic) 
                    : identityKeyPublic;
            }
            if (preKeyPublic) {
                user.preKeyPublic = Array.isArray(preKeyPublic) 
                    ? JSON.stringify(preKeyPublic) 
                    : preKeyPublic;
            }
            await user.save();
            console.log(`Updated cryptographic keys for ${username}`);

            // Purge stale offline messages — they were encrypted with old keys
            const { OfflineMessage } = require('../models/OfflineMessage');
            const purged = await OfflineMessage.deleteMany({ recipientId: user._id });
            if (purged.deletedCount > 0) {
                console.log(`Purged ${purged.deletedCount} stale offline messages for ${username}`);
            }
        }

        const sessionToken = crypto.randomBytes(32).toString('base64');
        const deviceId = req.headers['x-device-id'] as string || 'unknown';

        const session = new Session({
            userId: user._id,
            sessionToken,
            deviceId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await session.save();

        res.status(200).json({ token: sessionToken, userId: user._id });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

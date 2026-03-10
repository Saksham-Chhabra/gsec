import { Request, Response } from 'express';
import argon2 from 'argon2';
import crypto from 'crypto';
import { User } from '../models/User';
import { Session } from '../models/Session';

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { username, password, identityKeyPublic } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const passwordHash = await argon2.hash(password);

        // identityKeyPublic might be sent later, but we allow it on registration if ready
        const user = new User({
            username,
            passwordHash,
            identityKeyPublic: identityKeyPublic || 'PENDING'
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
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        console.log(`Login attempt for username: ${username}`);
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.status(401).json({ error: `User ${username} not found in database` });
        }

        const validPassword = await argon2.verify(user.passwordHash, password);
        if (!validPassword) {
            console.log(`Invalid password for user: ${username}`);
            return res.status(401).json({ error: 'Wrong password provided' });
        }
        console.log(`Login successful for user: ${username}`);

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

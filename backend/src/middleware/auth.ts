import { Request, Response, NextFunction } from 'express';
import { Session } from '../models/Session';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        deviceId: string;
    };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const session = await Session.findOne({ sessionToken: token, expiresAt: { $gt: new Date() } });
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        req.user = {
            id: session.userId.toString(),
            deviceId: session.deviceId
        };
        
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
    }
};

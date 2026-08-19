import {Request, Response, NextFunction} from 'express';
import {verifyToken, TokenPayload} from '../utils/auth.js';

export interface AuthRequest extends Request {
    user?: TokenPayload;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized: Missing token' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({ message: 'Unauthorized: Invalid token' });
        return;
    }

    req.user = payload;
    next();
};
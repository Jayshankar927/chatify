import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

export interface TokenPayload{
    userId: string;
    username: string;
}

export const signToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

export const verifyToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
};
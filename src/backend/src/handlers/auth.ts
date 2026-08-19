import {Request, Response} from 'express';
import bcrypt from 'bcryptjs';
import {pool} from '../config/db.js';
import {signToken} from '../utils/auth.js';
import {AuthRequest} from '../middleware/auth.js';

export const registerHandler = async (req: Request, res: Response): Promise<void> => {
    // Implementation for register handler
    const {username, email, password} = req.body;

    if (!username || !email || !password) {
        res.status(400).json({ message: 'Missing required fields' });
        return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        res.status(400).json({
            error: 'Password must be at least 8 characters long, contain an uppercase letter, lowercase letter, number, and special character.'
        });
        return;
    }

    try {
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [email.toLowerCase(), username.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'Username or email already exists' });
            return;
        }

        const salt  = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username.toLowerCase(), email.toLowerCase(), passwordHash]
        );

        const user = result.rows[0];
        const token = signToken({userId: user.id, username: user.username});

        res.status(201).json({user, token});

    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const loginHandler = async (req: Request, res: Response): Promise<void> => {
    const {identifier, password} = req.body;

    if (!identifier || !password) {
        res.status(400).json({ message: 'Missing credentials' });
        return;
    }

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [identifier.toLowerCase()]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const token = signToken({userId: user.id, username: user.username});
        res.status(200).json({
            user:{id: user.id, username: user.username, email: user.email},
            token
        });

    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};

export const meHandler = async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const result = await pool.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.status(200).json({ user: result.rows[0] });

    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve user information' });
    }
};
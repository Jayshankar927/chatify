import { Response } from 'express';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';

export const searchUsersHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const query = req.query.q as string;
  const currentUserId = req.user?.userId;

  if (!query || query.trim().length === 0) {
    res.status(200).json([]);
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email FROM users 
       WHERE username ILIKE $1 AND id != $2 
       LIMIT 10`,
      [`%${query}%`, currentUserId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
};

export const getRecentConversationsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const currentUserId = req.user?.userId;

  try {
    const result = await pool.query(
      `WITH conversation_partners AS (
         SELECT 
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
           text,
           created_at,
           ROW_NUMBER() OVER (
             PARTITION BY CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END 
             ORDER BY created_at DESC
           ) as rn
         FROM messages
         WHERE sender_id = $1 OR recipient_id = $1
       )
       SELECT u.id, u.username, u.email, cp.text as last_message, cp.created_at as last_message_time
       FROM conversation_partners cp
       JOIN users u ON u.id = cp.partner_id
       WHERE cp.rn = 1
       ORDER BY cp.created_at DESC`,
      [currentUserId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load conversations' });
  }
};

export const getDirectMessagesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const currentUserId = req.user?.userId;
  const targetUserId = req.params.userId;

  try {
    const result = await pool.query(
      `SELECT id, sender_id, recipient_id, text, created_at AS timestamp 
       FROM messages 
       WHERE (sender_id = $1 AND recipient_id = $2) 
          OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC 
       LIMIT 200`,
      [currentUserId, targetUserId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
};
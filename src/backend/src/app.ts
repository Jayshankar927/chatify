import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import {pool} from './config/db.js';
import {redisPublisher, redisSubscriber} from './config/redis.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken } from './utils/auth.js';
import { requireAuth } from './middleware/auth.js';
import { registerHandler, loginHandler, meHandler } from './handlers/auth.js';
import { searchUsersHandler, getRecentConversationsHandler, getDirectMessagesHandler } from './handlers/users.js';
import { register, connectedClientsGauge, messagesSentCounter, httpRequestDurationHistogram } from './config/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const CHAT_CHANNEL = "direct_chat_messages";

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    httpRequestDurationHistogram
      .labels(req.method, req.route ? req.route.path : req.path, res.statusCode.toString())
      .observe(durationInSeconds);
  });
  next();
});

app.use('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err instanceof Error ? err.message : 'Metrics error');
  }
});

app.get('/healthz', async (req, res) => {
  try{
    await pool.query('SELECT 1'); // Check database connection
    await redisPublisher.ping(); // Check Redis connection

    res.status(200).json({
      status: 'OK',
      postgres: 'Connected',
      redis: 'Connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
  catch (error) {
    res.status(503).json({
      status : 'DEGRADED',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
});

app.post('/api/auth/register', registerHandler);
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', requireAuth, meHandler);
app.get('/api/users/search', requireAuth, searchUsersHandler);
app.get('/api/users/conversations', requireAuth, getRecentConversationsHandler);
app.get('/api/messages/:userId', requireAuth, getDirectMessagesHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
}

const activeClients = new Map<string, AuthenticatedWebSocket>();

redisSubscriber.subscribe(CHAT_CHANNEL, (err) => {
  if (err) {
    console.error('Failed to subscribe to Redis channel:', err);
  }
});

redisSubscriber.on('message', (channel, message) => {
  if (channel === CHAT_CHANNEL) {
    const payload = JSON.parse(message);
    const targetSocket = activeClients.get(payload.recipient_id);
    const senderSocket = activeClients.get(payload.sender_id);

    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.send(message);
    }

    if (senderSocket && senderSocket.readyState === WebSocket.OPEN && senderSocket !== targetSocket) {
      senderSocket.send(message);
    }
  }
});

wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  connectedClientsGauge.inc();

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    ws.close(4001, 'Unauthorized: No token provided');
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4001, 'Unauthorized: Invalid token');
    return;
  }

  ws.userId = payload.userId;
  ws.username = payload.username;
  activeClients.set(payload.userId, ws);

  ws.on('message', async (data: Buffer) => {
    try{
      const parsed = JSON.parse(data.toString());
      const { recipientId, text } = parsed;

      if (!recipientId || !text || typeof text !== 'string') return;

      const dbResult = await pool.query(
        `INSERT INTO messages (sender_id, recipient_id, text) 
         VALUES ($1, $2, $3) 
         RETURNING id, sender_id, recipient_id, text, created_at AS timestamp`,
        [ws.userId, recipientId, text]
      );

      const messagePayload = JSON.stringify(dbResult.rows[0]);
      await redisPublisher.publish(CHAT_CHANNEL, messagePayload);
      messagesSentCounter.inc();
    } catch (error) {
      console.error('Error handling Websocket message:', error);
      ws.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      activeClients.delete(ws.userId);
    }
    connectedClientsGauge.dec();
  });

  ws.on('error', () => {
    if (ws.userId) {
      activeClients.delete(ws.userId);
    }
    connectedClientsGauge.dec();
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
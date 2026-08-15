import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import {pool} from './config/db.js';
import {redisPublisher, redisSubscriber} from './config/redis.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const CHAT_CHANNEL = "chat_messages";

app.use(cors());
app.use(express.json());

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

app.get('/api/messages', async (req, res) => {
  try{
    const result = await pool.query(
      'SELECT id, text, created_at AS timestamp FROM messages ORDER BY created_at ASC LIMIT 100'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({error : 'Failed to retrieve messages' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

redisSubscriber.subscribe(CHAT_CHANNEL, (err) => {
  if (err) {
    console.error('Failed to subscribe to Redis channel:', err);
  }
});

redisSubscriber.on('message', (channel, message) => {
  if (channel === CHAT_CHANNEL) {
    wss.clients.forEach((client) => { 
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
});

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', async (data: Buffer) => {
    try{
      const parsedData = JSON.parse(data.toString());
      const text = parsedData.text;

      if (!text || typeof text !== 'string') {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
        return;
      }

      const dbResult = await pool.query(
        'INSERT INTO messages (text) VALUES ($1) RETURNING id, text, created_at AS timestamp',
        [text]
      );

      const messagePayload = JSON.stringify(dbResult.rows[0]);
      await redisPublisher.publish(CHAT_CHANNEL, messagePayload);
    } catch (error) {
      console.error('Error handling Websocket message:', error);
      ws.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
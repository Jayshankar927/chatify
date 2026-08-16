import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions = {
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
};

export const redisPublisher = new Redis(redisUrl, redisOptions);
export const redisSubscriber = new Redis(redisUrl, redisOptions);

redisPublisher.on('error', (err) => {
  console.error('Redis Publisher Error:', err.message);
});

redisSubscriber.on('error', (err) => {
  console.error('Redis Subscriber Error:', err.message);
});
import {Redis} from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisPublisher = new Redis(redisUrl);
export const redisSubscriber = new Redis(redisUrl);
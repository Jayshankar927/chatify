import {Redis} from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisPublisher = new Redis(redisUrl);
const redisSubscriber = new Redis(redisUrl);
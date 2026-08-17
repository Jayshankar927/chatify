import client from 'prom-client';

export const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const connectedClientsGauge = new client.Gauge({
  name: 'chat_connected_clients_total',
  help: 'Total number of active WebSocket client connections',
  registers: [register]
});

export const messagesSentCounter = new client.Counter({
  name: 'chat_messages_processed_total',
  help: 'Total count of chat messages received and broadcasted',
  registers: [register]
});

export const httpRequestDurationHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register]
});
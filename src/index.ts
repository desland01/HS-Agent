import 'dotenv/config';
import express from 'express';
import { createWebhookRoutes } from './routes/webhooks.js';
import type { FacebookConfig } from './adapters/platforms/index.js';
import { initializeStorage, isUsingRedis } from './storage/redis.js';

// Import business configs
import orangeBlossomConfig from './config/businesses/orange-blossom.js';
import groveStreetConfig from './config/businesses/grove-street-painting.js';

/**
 * Home Service Agent - Multi-Business AI Agent System
 *
 * This server can handle multiple businesses. Each business gets its own
 * set of endpoints under /api/{business-slug}/
 *
 * Example:
 *   /api/orange-blossom/chat/message
 *   /api/grove-street/facebook/webhook
 */

const app = express();

// Request body limits (100kb default)
app.use(express.json({ limit: '100kb' }));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use((_req, res, next) => {
  const origin = _req.headers.origin;

  // In development, allow all origins
  if (isDevelopment) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    // In production, only allow configured origins
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Handle preflight
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Facebook config (shared or per-business)
const facebookConfig: FacebookConfig | undefined = process.env.FB_PAGE_ACCESS_TOKEN
  ? {
      pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
      appSecret: process.env.FB_APP_SECRET || '',
      verifyToken: process.env.FB_VERIFY_TOKEN || 'home-service-agent',
      pageId: process.env.FB_PAGE_ID || '',
    }
  : undefined;

// Mount routes for each business
app.use('/api/orange-blossom', createWebhookRoutes(orangeBlossomConfig, facebookConfig));
app.use('/api/grove-street', createWebhookRoutes(groveStreetConfig, facebookConfig));

// Default route
app.get('/', (_req, res) => {
  res.json({
    name: 'Home Service Agent',
    version: '1.0.0',
    description: 'Multi-platform AI agent for home service businesses',
    businesses: [
      { slug: 'orange-blossom', name: 'Orange Blossom Cabinets' },
      { slug: 'grove-street', name: 'Grove Street Painting' },
    ],
    endpoints: {
      chatStart: '/api/{business}/chat/start',
      chatMessage: '/api/{business}/chat/message',
      leadSubmit: '/api/{business}/lead',
      facebookWebhook: '/api/{business}/facebook/webhook',
      eventTrigger: '/api/{business}/event',
      healthCheck: '/api/{business}/health',
    },
  });
});

// Start server with async initialization
const PORT = process.env.PORT || 3001;

async function startServer() {
  // Initialize Redis storage
  await initializeStorage();
  const storageType = isUsingRedis() ? 'Redis (persistent)' : 'In-Memory (volatile)';

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           HOME SERVICE AGENT - RUNNING                      ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                ║
║  Storage: ${storageType.padEnd(36)}║
║                                                            ║
║  Businesses configured:                                    ║
║    • Orange Blossom Cabinets → /api/orange-blossom         ║
║    • Grove Street Painting   → /api/grove-street           ║
║                                                            ║
║  Endpoints per business:                                   ║
║    POST /chat/start     - Start new conversation           ║
║    POST /chat/message   - Send message                     ║
║    POST /lead           - Submit lead form                 ║
║    POST /event          - Trigger event (reminders, etc)   ║
║    GET  /facebook/webhook - FB verification                ║
║    POST /facebook/webhook - FB messages & leads            ║
║    GET  /health         - Health check                     ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);

export default app;

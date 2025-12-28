import 'dotenv/config';
import express from 'express';
import { createWebhookRoutes } from './routes/webhooks.js';
import type { FacebookConfig } from './adapters/platforms/index.js';

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
app.use(express.json());

// CORS for local development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           HOME SERVICE AGENT - RUNNING                      ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                ║
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

export default app;

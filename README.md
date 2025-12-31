# Home Service Agent

Multi-platform AI agent system for home service businesses. One codebase, any business.

## Features

- **3 Specialized Agents**
  - SDR Agent: Lead qualification & appointment booking
  - Reminder Agent: Appointment confirmations & rescheduling
  - Follow-up Agent: Post-estimate nurturing & closing

- **Multi-Platform Support**
  - Website chat widget
  - Facebook Messenger
  - Facebook Lead Ads
  - iMessage/SMS via Cloud Mac

- **CRM Integrations**
  - GoHighLevel
  - PaintScout
  - Pipedrive (planned)
  - HubSpot (planned)

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and add your API key
cp .env.example .env

# Run in development
npm run dev

# Build for production
npm run build
npm start
```

## Adding a New Business

1. Create a new config file in `src/config/businesses/`:

```typescript
// src/config/businesses/my-business.ts
import type { BusinessConfig } from '../business.schema.js';

export const myBusinessConfig: BusinessConfig = {
  businessName: 'My Business',
  ownerName: 'Owner Name',
  businessType: 'painting', // or 'cabinets', 'roofing', etc.
  phone: '(555) 123-4567',
  email: 'info@mybusiness.com',
  website: 'https://mybusiness.com',
  serviceArea: {
    primary: 'City, State',
    cities: ['City1', 'City2'],
  },
  services: [
    { name: 'Service 1', description: 'Description' },
  ],
  // ... see full schema in business.schema.ts
};
```

2. Register in `src/index.ts`:

```typescript
import myBusinessConfig from './config/businesses/my-business.js';

app.use('/api/my-business', createWebhookRoutes(myBusinessConfig));
```

3. Deploy and update your webhook URLs.

## API Endpoints

All endpoints are prefixed with `/api/{business-slug}/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat/start` | POST | Start new chat conversation |
| `/chat/message` | POST | Send message in conversation |
| `/lead` | POST | Submit lead form |
| `/event` | POST | Trigger event (reminders, etc.) |
| `/facebook/webhook` | GET | FB webhook verification |
| `/facebook/webhook` | POST | FB messages & leads |
| `/imessage/inbound` | POST | Receive iMessage replies |
| `/imessage/status` | POST | Receive delivery status |
| `/health` | GET | Health check |

## Facebook Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Messenger product
3. Generate Page Access Token
4. Set webhook URL to `https://your-domain.com/api/{business}/facebook/webhook`
5. Subscribe to `messages`, `messaging_postbacks`, `leadgen` events
6. Add environment variables

## iMessage/SMS Setup (Cloud Mac)

This system integrates with Cloud Mac to send iMessages from a dedicated Mac.

### Requirements
- A Mac running macOS with Messages app configured
- Cloud Mac API server running on that Mac
- Public endpoint for the API (or tunnel via ngrok/Cloudflare)

### Configuration

1. Add environment variables:
```bash
OB_IMESSAGE_ENDPOINT=https://mac-ob.yourdomain.com/api/send-imessage
OB_IMESSAGE_API_KEY=your-secret-api-key
IMESSAGE_WEBHOOK_SECRET=your-webhook-secret
```

2. Enable in business config:
```typescript
texting: {
  enabled: true,
  channel: 'imessage',
  imessageEndpoint: process.env.OB_IMESSAGE_ENDPOINT,
  imessageApiKey: process.env.OB_IMESSAGE_API_KEY,
  timezone: 'America/New_York',
  quietHours: { enabled: true, start: 20, end: 8 },
  rateLimits: { maxPerLeadPerDay: 3, maxFollowupsPerWeek: 3 },
}
```

3. Configure Cloud Mac webhooks (for inbound messages):
   - Inbound: `POST https://your-domain.com/api/{business}/imessage/inbound`
   - Status: `POST https://your-domain.com/api/{business}/imessage/status`
   - Both require `x-api-key` header matching `IMESSAGE_WEBHOOK_SECRET`

### Features
- **Quiet Hours**: Messages queued outside business hours (8am-8pm by default)
- **Rate Limiting**: Max 3 texts per lead per day (in-memory, resets on restart)
- **TCPA Compliance**: Requires explicit `textingConsent` on lead record
- **Phone Masking**: Only last 4 digits logged for privacy

## Deployment

### Railway / Render / Fly.io

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## License

Private - All rights reserved

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
  - SMS (coming soon)

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
| `/health` | GET | Health check |

## Facebook Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Messenger product
3. Generate Page Access Token
4. Set webhook URL to `https://your-domain.com/api/{business}/facebook/webhook`
5. Subscribe to `messages`, `messaging_postbacks`, `leadgen` events
6. Add environment variables

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

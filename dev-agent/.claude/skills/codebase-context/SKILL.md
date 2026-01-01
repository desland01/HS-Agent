---
name: codebase-context
description: Project structure, key files, architecture patterns, and conventions
triggers: []
priority: 1
alwaysLoad: true
---

# Home Service Agent - Codebase Context

## Project Overview

Multi-agent AI system for home service businesses. Single codebase serves any business through configuration.

## Architecture

```
Lead Source -> Webhook -> Orchestrator -> Agent -> CRM/Messaging
                              |
                    Conversation State (Redis)
```

## Directory Structure

```
src/
  agents/           # AI agents (SDR, Reminder, Follow-up)
    base.ts         # BaseAgent class all agents extend
    sdr.ts          # Sales development rep - lead qualification
    reminder.ts     # Appointment reminders and confirmations
    followup.ts     # Post-estimate nurturing
    index.ts        # Agent selection logic (selectAgent)

  adapters/         # External service integrations
    crm/            # CRM adapters (GoHighLevel, PaintScout)
      base.ts       # BaseCrmAdapter interface
    platforms/      # Channel adapters (Facebook, SMS)
    channels/       # Messaging channels (iMessage)

  config/           # Business configuration
    business.schema.ts   # Zod schema for BusinessConfig
    businesses/          # Per-business config files

  lib/              # Core utilities
    orchestrator.ts # Routes messages to agents, handles actions
    conversation.ts # Conversation state management (Redis)

  routes/           # API endpoints
    webhook.ts      # Webhook handlers for all channels
```

## Key Files

### Agent System

- `src/agents/base.ts` - BaseAgent class with Claude API integration
- `src/agents/index.ts` - `selectAgent()` function maps LeadStatus to agent
- `src/lib/orchestrator.ts` - Central message routing, action processing

### Configuration

- `src/config/business.schema.ts` - BusinessConfig type definition
- `src/config/businesses/*.ts` - Individual business configurations

### State Management

- `src/lib/conversation.ts` - Redis-backed conversation state with 30-day TTL

## Core Types

```typescript
// Lead lifecycle
type LeadStatus =
  | 'new'                   // Just received
  | 'contacted'             // First response sent
  | 'qualified'             // BANT complete
  | 'appointment_scheduled' // Consultation booked
  | 'estimate_sent'         // Quote delivered
  | 'follow_up'             // Nurturing
  | 'won'                   // Closed
  | 'lost';                 // Lost

// Lead urgency
type LeadTemperature =
  | 'hot'   // Ready in 0-3 months
  | 'warm'  // Ready in 3-6 months
  | 'cool'; // 6+ months out

// Agent types
type AgentType = 'sdr' | 'reminder' | 'followup';

// Message channels
type Platform = 'web' | 'facebook' | 'sms' | 'email';
```

## Agent Selection Logic

Agents are selected automatically based on lead status:

```typescript
// From src/agents/index.ts
function selectAgent(status: LeadStatus): AgentType {
  switch (status) {
    case 'new':
    case 'contacted':
    case 'qualified':
      return 'sdr';

    case 'appointment_scheduled':
      return 'reminder';

    case 'estimate_sent':
    case 'follow_up':
      return 'followup';

    default:
      return 'sdr';
  }
}
```

## Adapter Pattern

All external integrations use the adapter pattern:

```typescript
// CRM Adapter interface
interface CrmAdapter {
  createLead(data: LeadData): Promise<Lead>;
  updateLead(id: string, data: Partial<LeadData>): Promise<Lead>;
  getLead(id: string): Promise<Lead | null>;
  searchLeads(query: LeadQuery): Promise<Lead[]>;
}

// Platform adapter interface
interface PlatformAdapter {
  parseWebhook(request: Request): Promise<InboundMessage>;
  sendMessage(to: string, message: OutboundMessage): Promise<void>;
  verifyWebhook(request: Request): Promise<boolean>;
}
```

## Adding New Business

1. Create config file: `src/config/businesses/my-business.ts`
2. Export BusinessConfig matching schema
3. Register in `src/index.ts` with `createWebhookRoutes()`

## API Routes

All endpoints prefixed with `/api/{business-slug}/`:

- `POST /chat/start` - Initialize web chat session
- `POST /chat/message` - Send/receive chat messages
- `POST /lead` - Form submission webhook
- `POST /event` - Event triggers (reminders, follow-ups)
- `GET/POST /facebook/webhook` - Facebook Messenger integration
- `POST /imessage/inbound` - iMessage webhook

## Orchestrator Actions

Agents return actions for the orchestrator to execute:

```typescript
type AgentAction =
  | { type: 'update_crm'; data: Partial<LeadData> }
  | { type: 'send_sms'; to: string; message: string }
  | { type: 'schedule_followup'; delay: number }
  | { type: 'escalate'; reason: string };
```

## TCPA Compliance

Texting requires explicit consent. Check before sending:

```typescript
if (!lead.textingConsent) {
  // Cannot send SMS - use email or wait for consent
  return;
}

// Rate limits: 3 texts per lead per day
// Quiet hours: 8pm - 8am local time
```

## Development Commands

```bash
npm run dev        # Run with hot reload
npm run build      # Compile TypeScript
npm run typecheck  # Type check only
npm start          # Run production build
```

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Claude API key

Optional:
- `REDIS_URL` - Redis connection (falls back to in-memory)
- `PORT` - Server port (default: 3001)
- `FB_*` - Facebook integration credentials
- `OB_IMESSAGE_*` - iMessage integration credentials

## Git Workflow

- Never commit to `main` directly
- Branch naming: `feature/{issue-id}-{description}`
- Run `npm run typecheck && npm run build` before committing
- Create PRs for all changes

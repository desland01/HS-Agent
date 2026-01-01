---
name: project-context
description: PRD, architecture, business rules, and implementation patterns
triggers: [architecture, prd, requirements, business, rules, overview]
priority: 1
alwaysLoad: true
---

# Project Context

Comprehensive context for building the home-service-agent system.

## Product Vision

**One-liner:** AI-powered platform that helps home service businesses never miss a lead and close more jobs.

**Problem:** Home service business owners lose 40-60% of leads due to slow response times.

**Solution:** Autonomous AI that responds instantly, qualifies via BANT, books appointments, and follows up on estimates.

## Architecture

### Core Flow

```
Lead Source -> Webhook -> Orchestrator -> Agent -> CRM/Messaging
                              |
                    Conversation State (Redis)
```

### Three Specialized Agents (src/agents/)

| Agent | Purpose | Triggers When |
|-------|---------|---------------|
| **SDR** | Lead qualification via BANT, booking consultations | status: new, contacted, qualified |
| **Reminder** | Appointment confirmations, reminders, rescheduling | status: appointment_scheduled |
| **Follow-up** | Post-estimate nurturing, objection handling, closing | status: estimate_sent, follow_up |

All agents extend `BaseAgent` which handles Claude API calls, context building, and response parsing.

### Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| Orchestrator | `lib/orchestrator.ts` | Routes messages to agents, manages handoffs |
| Conversation State | `lib/conversation.ts` | Lead info, message history, current agent (Redis, 30-day TTL) |
| Business Config | `config/business.schema.ts` | Zod schema for all business settings |

### Adapter Pattern (src/adapters/)

- **CRM Adapters**: GoHighLevel, PaintScout (implement `BaseCrmAdapter`)
- **Platform Adapters**: Facebook Messenger, Lead Ads
- **Channel Adapters**: iMessage via Cloud Mac

### API Routes (src/routes/)

All prefixed with `/api/{business-slug}/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat/start` | POST | Start web chat |
| `/chat/message` | POST | Send/receive messages |
| `/lead` | POST | Form submission |
| `/event` | POST | Trigger reminders/follow-ups |
| `/facebook/webhook` | GET/POST | Facebook integration |
| `/imessage/inbound` | POST | Receive iMessage replies |

## Key Types

```typescript
type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'won'
  | 'lost';

type LeadTemperature = 'hot' | 'warm' | 'cool';
// hot: 0-3 months, warm: 3-6 months, cool: 6+ months

type AgentType = 'sdr' | 'reminder' | 'followup';
type Platform = 'web' | 'facebook' | 'sms' | 'email';
```

## Business Rules

1. **TCPA Compliance**: Texting requires explicit `textingConsent: true`
2. **Rate Limiting**: 3 texts/lead/day, quiet hours 8pm-8am
3. **Agent Selection**: Automatic based on LeadStatus (see `selectAgent()`)
4. **ES Modules**: Use `.js` extensions in imports

## Frontend Architecture (web/)

### Directory Structure

```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, signup
│   │   ├── (dashboard)/
│   │   │   ├── leads/        # Lead pipeline (kanban)
│   │   │   ├── conversations/
│   │   │   ├── activity/
│   │   │   └── settings/
│   │   ├── onboarding/       # Conversational setup
│   │   └── api/              # Proxy routes
│   ├── components/
│   │   ├── ui/               # Primitives
│   │   ├── leads/            # Lead cards, kanban
│   │   └── conversations/    # Chat viewer
│   └── lib/
│       └── api-client.ts
└── widget/                   # Embeddable chat (<50KB)
```

### Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS + Design Tokens
- Zustand + React Query
- Framer Motion

## Dashboard API Endpoints

All prefixed with `/api/{business-slug}/`:

### Lead Management
- `GET /leads` - List with pagination/filters
- `GET /leads/:id` - Single lead with history
- `PATCH /leads/:id` - Update status, temperature
- `POST /leads/:id/assign` - Assign to agent/owner

### Conversations
- `GET /conversations` - List by lead
- `GET /conversations/:id` - Full conversation
- `POST /conversations/:id/correct` - Owner correction
- `POST /conversations/:id/takeover` - Owner takes over

### Activity
- `GET /activity` - Activity feed
- `GET /analytics/overview` - KPIs

## Owner Correction System

Owners can mark AI responses as incorrect:

1. Click "Wrong" on message
2. Enter correct response
3. Select correction type: `tone`, `accuracy`, `action`, `boundary`
4. System stores for agent learning

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Claude API

Optional:
- `REDIS_URL` - Falls back to in-memory
- `PORT` - Default 3001
- `FB_*` - Facebook integration
- `OB_IMESSAGE_*` - iMessage

## Success Metrics

| Metric | Target |
|--------|--------|
| Lead Response Time | < 5 min |
| Qualification Rate | > 40% |
| Appointment Show Rate | > 80% |
| Estimate Close Rate | > 30% |

## Reference Documents

- `docs/PRD.md` - Full product requirements
- `docs/SECURITY.md` - Security checklist
- `AGENTS.md` - Workflow instructions
- `CLAUDE.md` - Development context

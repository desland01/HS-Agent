---
name: Project Context
description: Access PRD, architecture overview, and business rules for the home service agent project
---

# Project Context

This skill provides comprehensive context about the home-service-agent project.

## Overview

This is a multi-agent AI system for home service businesses. One codebase serves any business through configuration.

## Architecture

### Core Flow

```
Lead Source -> Webhook -> Orchestrator -> Agent -> CRM/Messaging
                              |
                    Conversation State (Redis)
```

### Three Specialized Agents

| Agent | Purpose | Triggers When |
|-------|---------|---------------|
| **SDR** | Lead qualification via BANT, booking consultations | status: new, contacted, qualified |
| **Reminder** | Appointment confirmations, reminders, rescheduling | status: appointment_scheduled |
| **Follow-up** | Post-estimate nurturing, objection handling, closing | status: estimate_sent, follow_up |

### Key Components

- **Orchestrator** (`lib/orchestrator.ts`): Routes messages to agents, manages handoffs
- **Conversation State** (`lib/conversation.ts`): Tracks lead info, message history, current agent
- **Business Config** (`config/business.schema.ts`): Zod schema for business settings

### Adapter Pattern

- **CRM Adapters**: GoHighLevel, PaintScout
- **Platform Adapters**: Facebook Messenger, Lead Ads
- **Channel Adapters**: iMessage via Cloud Mac

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
// hot: 0-3 months
// warm: 3-6 months
// cool: 6+ months

type AgentType = 'sdr' | 'reminder' | 'followup';
type Platform = 'web' | 'facebook' | 'sms' | 'email';
```

## Business Rules

1. **TCPA Compliance**: Texting requires explicit `textingConsent: true`
2. **Rate Limiting**: 3 texts/lead/day, quiet hours 8pm-8am
3. **Agent Selection**: Automatic based on LeadStatus (see `selectAgent()`)

## Adding a New Business

1. Create config in `src/config/businesses/my-business.ts`
2. Register in `src/index.ts`
3. Configure webhooks for the business slug

## Reference Files

- docs/PRD.md
- docs/SECURITY.md
- AGENTS.md

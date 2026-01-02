---
name: Project Context
description: Access PRD, architecture overview, and business rules for the home service agent project
---

# Project Context

## Product Vision

**One-liner:** AI-powered platform that helps home service businesses never miss a lead and close more jobs.

**Problem:** Home service business owners (painters, HVAC, plumbers, roofers) lose 40-60% of leads due to slow response times. They're on job sites, can't answer phones, and leads go cold within minutes.

**Solution:** An autonomous AI system that:
- Responds to leads instantly (< 5 min)
- Qualifies prospects using BANT methodology
- Books appointments without owner involvement
- Follows up on estimates automatically
- Provides daily briefings to owners via text

## Target Users

**Primary:** Home Service Business Owner (35-55 years old, 1-20 employees)
- Industries: Painting, HVAC, Plumbing, Roofing, Electrical, Landscaping
- Pain Points: Missing leads while on job sites, no time for follow-ups, losing jobs to faster competitors

**Secondary:** Office Manager / Dispatcher

---

## Current Status

### ✅ Phase 1: Foundation (Complete)
- Dev agent with Linear integration
- Circuit breaker for cost control
- PRD and security documentation

### ✅ Phase 2: Core Agents (Complete)
- SDR Agent with BANT qualification
- Reminder Agent for appointments
- Follow-up Agent for post-estimate nurturing
- Facebook Lead Ads integration
- iMessage adapter via Cloud Mac
- GoHighLevel CRM integration
- PaintScout estimating integration

### 🔄 Phase 2 Remaining
- [ ] Twilio SMS adapter (iMessage works, Twilio for broader reach)
- [ ] Calendar integration (Google Calendar sync)
- [ ] Email sending (for follow-up sequences)

### 📋 Phase 3: Owner Experience (Next)
- [ ] Owner Assistant (text-based daily briefings)
- [ ] Web Dashboard (Next.js, distinctive UI)
- [ ] Daily Digest

### 🔮 Phase 4: Scale (Future)
- [ ] Multi-CRM adapters (HubSpot, Jobber, ServiceTitan)
- [ ] CMO Agent with RAG for marketing intelligence
- [ ] Sales Coach for real-time guidance

---

## Architecture

### Core Flow

```
Lead Source → Webhook → Orchestrator → Agent → CRM/Messaging
                              ↓
                    Conversation State (Redis)
```

### Three Specialized Agents

| Agent | Purpose | Triggers When |
|-------|---------|---------------|
| **SDR** (`sdr.ts`) | Lead qualification via BANT, booking consultations | status: new, contacted, qualified |
| **Reminder** (`reminder.ts`) | Appointment confirmations, reminders, rescheduling | status: appointment_scheduled |
| **Follow-up** (`followup.ts`) | Post-estimate nurturing, objection handling, closing | status: estimate_sent, follow_up |

### Key Components

- **Orchestrator** (`lib/orchestrator.ts`): Routes messages to agents, manages handoffs
- **Conversation State** (`lib/conversation.ts`): Tracks lead info, message history, current agent
- **Business Config** (`config/business.schema.ts`): Zod schema for business settings

### Adapter Pattern

- **CRM Adapters**: GoHighLevel, PaintScout
- **Platform Adapters**: Facebook Messenger, Lead Ads
- **Channel Adapters**: iMessage via Cloud Mac

---

## MVP Features (P0 - Must Have)

| Feature | Description | Status |
|---------|-------------|--------|
| SDR Agent | Qualify leads via SMS/Messenger | ✅ Done |
| Reminder Agent | Appointment confirmations | ✅ Done |
| Follow-up Agent | Post-estimate nurturing | ✅ Done |
| Lead Ingestion | Facebook Lead Ads webhook | ✅ Done |
| CRM Integration | GoHighLevel sync | ✅ Done |

---

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

---

## Business Rules

1. **TCPA Compliance**: Texting requires explicit `textingConsent: true`
2. **Rate Limiting**: 3 texts/lead/day, quiet hours 8pm-8am
3. **Agent Selection**: Automatic based on LeadStatus

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Lead Response Time | < 5 min |
| Qualification Rate | > 40% |
| Appointment Show Rate | > 80% |
| Estimate Close Rate | > 30% |
| Owner Time Saved | 10+ hrs/week |

---

## Open Questions

| Question | Status |
|----------|--------|
| SaaS vs white-label? | Open |
| Pricing model? | Open |

---

## Tech Stack

- **AI**: Claude API (claude-sonnet-4-5), Claude Agent SDK
- **Work Tracking**: Linear
- **Dashboard (P1)**: Next.js, Tailwind CSS, Framer Motion
- **Messaging**: iMessage (done), Twilio (planned)
- **CRM**: GoHighLevel (done), multi-CRM adapters (P2)

---

## Linear Configuration

> **Note:** The PM Agent already has the Linear MCP plugin installed and configured.
> You can use Linear tools directly without additional setup.

### Environment

```bash
export LINEAR_API_KEY="LINEAR_API_KEY_REDACTED"
```

### Workspace

- **URL**: https://linear.app/grovestreetpainting
- **Team**: Grove Street Painting

### Issue Status Workflow

| Status | Description |
|--------|-------------|
| `Todo` | Ready to be worked on |
| `In Progress` | Currently being worked on |
| `Done` | Completed |

### Label Categories

| Label | Purpose |
|-------|---------|
| `functional` | Feature functionality |
| `style` | UI/styling changes |
| `infrastructure` | DevOps, tooling, setup |

### Priority Levels

| Priority | Value | Description |
|----------|-------|-------------|
| Urgent | 1 | Drop everything |
| High | 2 | This sprint |
| Medium | 3 | Next sprint |
| Low | 4 | Backlog |
| None | 0 | No priority set |

### Project Tracking

- **Marker File**: `.linear_project.json` - Tracks project initialization
- **Meta Issue**: `[META] Project Progress Tracker` - Session handoff and progress monitoring

### Available Linear Tools

The agent can use these tools directly via MCP:
- `linear_list_issues` - List/filter issues
- `linear_create_issue` - Create new issue
- `linear_update_issue` - Update issue status
- `linear_get_issue` - Get issue details
- `linear_search_issues` - Search issues
- `linear_list_teams` - List teams
- `linear_list_projects` - List projects
- `linear_get_view_issues` - Get issues from a view

---

## Reference Documents

- `docs/PRD.md` - Full product requirements
- `docs/SECURITY.md` - Security checklist
- `AGENTS.md` - Agent workflow instructions

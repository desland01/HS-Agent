# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Work Tracking

This project uses **Linear** for work tracking. The autonomous agent (`agent/`) processes tasks from Linear.

**Linear Workspace:** https://linear.app/grovestreetpainting

**Views:**
- "Up Next" - Prioritized tasks in Todo state
- "Active Work" - In Progress / In Review
- "Blocked" - Items needing human input

## Autonomous Agent

The project includes a Python-based autonomous coding agent in `agent/`:

```bash
# First run: Creates 50 Linear issues from app_spec.txt
cd agent
pip install -r requirements.txt
python autonomous_agent.py --project-dir ../

# Subsequent runs: Implements issues one by one
python autonomous_agent.py --project-dir ../
```

### Agent Architecture

| File | Purpose |
|------|---------|
| `autonomous_agent.py` | Entry point, CLI arguments |
| `agent.py` | Session loop, auto-continue logic |
| `client.py` | Claude SDK + Linear MCP configuration |
| `security.py` | Bash command allowlist |
| `prompts/app_spec.txt` | Application specification (50 issues) |
| `prompts/initializer_prompt.md` | Creates Linear project & issues |
| `prompts/coding_prompt.md` | Implements issues one by one |

### Key Patterns

- **Fresh context per session**: New client instance each session prevents context pollution
- **Two-prompt pattern**: Initializer (once) → Coding (repeated)
- **Session handoff via Linear**: META issue tracks progress across sessions
- **Security hooks**: PreToolUse validation for bash commands

## Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/PRD.md` | Product requirements, MVP definition, acceptance criteria |
| `docs/SECURITY.md` | Security checklist (mandatory for every PR) |
| `AGENTS.md` | Agent workflow instructions |

## Build & Development Commands

```bash
npm run dev        # Run with hot reload (tsx watch)
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type check without emitting
npm start          # Run production build (node dist/index.js)
```

## Architecture Overview

This is a multi-agent AI system for home service businesses. One codebase serves any business through configuration.

### Core Flow

```
Lead Source → Webhook → Orchestrator → Agent → CRM/Messaging
                              ↓
                    Conversation State (Redis)
```

### Three Specialized Agents (`src/agents/`)

| Agent | Purpose | Triggers When |
|-------|---------|---------------|
| **SDR** (`sdr.ts`) | Lead qualification via BANT, booking consultations | status: new, contacted, qualified |
| **Reminder** (`reminder.ts`) | Appointment confirmations, reminders, rescheduling | status: appointment_scheduled |
| **Follow-up** (`followup.ts`) | Post-estimate nurturing, objection handling, closing | status: estimate_sent, follow_up |

All agents extend `BaseAgent` which handles Claude API calls, context building, and response parsing. Agent selection is automatic based on `LeadStatus` (see `selectAgent()` in `agents/index.ts`).

### Key Components

- **Orchestrator** (`lib/orchestrator.ts`): Routes messages to agents, manages handoffs, processes actions (CRM updates, SMS)
- **Conversation State** (`lib/conversation.ts`): Tracks lead info, message history, current agent, TCPA consent. Stored in Redis with 30-day TTL.
- **Business Config** (`config/business.schema.ts`): Zod schema defining all business-specific settings. New businesses = new config file only.

### Adapter Pattern (`src/adapters/`)

- **CRM Adapters** (`crm/`): GoHighLevel, PaintScout. Implement `BaseCrmAdapter` interface.
- **Platform Adapters** (`platforms/`): Facebook Messenger, Lead Ads. Parse webhooks, send messages.
- **Channel Adapters** (`channels/`): iMessage via Cloud Mac. Handles rate limiting, quiet hours.

### API Routes (`src/routes/`)

All endpoints prefixed with `/api/{business-slug}/`:
- `POST /chat/start` - Start web chat
- `POST /chat/message` - Send/receive messages
- `POST /lead` - Form submission
- `POST /event` - Trigger reminders/follow-ups
- `GET/POST /facebook/webhook` - Facebook integration
- `POST /imessage/inbound` - Receive iMessage replies

## Adding a New Business

1. Create config in `src/config/businesses/my-business.ts`:
```typescript
import type { BusinessConfig } from '../business.schema.js';
export const myBusinessConfig: BusinessConfig = { /* see schema */ };
```

2. Register in `src/index.ts`:
```typescript
import { myBusinessConfig } from './config/businesses/my-business.js';
app.use('/api/my-business', createWebhookRoutes(myBusinessConfig));
```

## Key Types

- `LeadStatus`: new → contacted → qualified → appointment_scheduled → estimate_sent → follow_up → won/lost
- `LeadTemperature`: hot (0-3 months), warm (3-6 months), cool (6+ months)
- `AgentType`: 'sdr' | 'reminder' | 'followup'
- `Platform`: 'web' | 'facebook' | 'sms' | 'email'

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Claude API

Optional:
- `REDIS_URL` - Falls back to in-memory if not set
- `PORT` - Default 3001
- `FB_PAGE_ACCESS_TOKEN`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `FB_PAGE_ID` - Facebook
- `OB_IMESSAGE_ENDPOINT`, `OB_IMESSAGE_API_KEY`, `IMESSAGE_WEBHOOK_SECRET` - iMessage

## Code Patterns

- ES Modules with `.js` extensions in imports (TypeScript compiles to ESM)
- Path alias `@/*` maps to `./src/*`
- Agent responses include `actions[]` for side effects (CRM updates, SMS)
- Texting requires explicit `textingConsent: true` on lead record (TCPA compliance)
- Rate limiting: 3 texts/lead/day, quiet hours 8pm-8am

## Recommended Plugins

When working on this project with Claude Code, these plugins enhance development:

| Plugin | Purpose | When to Use |
|--------|---------|-------------|
| **feature-dev** | Structured feature development | Complex multi-file features |
| **frontend-design** | Distinctive UI design | Dashboard, web components |
| **pr-review-toolkit** | Code review, security analysis | Before PRs |
| **context7** | Library documentation lookup | Unfamiliar APIs |
| **commit-commands** | Streamlined git workflow | /commit, /commit-push-pr |

### UI Development Standards

When building frontend interfaces (dashboard, web chat, etc.):

- **Typography**: Use distinctive fonts (avoid Inter, Roboto, Arial, system fonts)
- **Colors**: Commit to bold aesthetic, avoid purple gradients on white (cliched)
- **Motion**: Staggered reveals, scroll-triggered animations, meaningful hover states
- **Layout**: Asymmetry over grids, generous negative space or controlled density
- **Backgrounds**: Gradient meshes, noise textures, layered transparencies

**NEVER produce generic AI aesthetics.** Each UI should be distinctive and memorable.

### Security Checklist

Before committing, verify:
- [ ] No command injection (user input in shell commands)
- [ ] No XSS (user input in HTML/JS output)
- [ ] No SQL injection (use parameterized queries)
- [ ] No hardcoded secrets (use environment variables)
- [ ] Input validation at system boundaries
- [ ] Proper error handling (no sensitive data in error messages)
- [ ] Rate limiting on public endpoints
- [ ] TCPA compliance for messaging (explicit opt-in, quiet hours)

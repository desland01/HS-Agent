# Home Service Agent SaaS - Full Architecture Plan

> **Version:** 1.0
> **Created:** 2026-01-01
> **Status:** Approved

## Executive Summary

Transform the existing backend-only home service agent into a **complete SaaS platform** with:
1. **Local PM Agent** - Claude Agent SDK mediator between you (PM) and Railway dev-agent
2. **Railway Dev-Agent Migration** - Enhanced with skills and progressive disclosure
3. **SaaS Frontend** - Owner Dashboard → Conversational Onboarding → Web Chat Widget

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOU (Product Manager)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    LOCAL PM AGENT (Claude Agent SDK)                 │
│                                                                      │
│  Skills: project-context/ | planning/ | design-system/ | linear/     │
│  Sub-agents: Planning | Design Review | QA | Linear Coordinator      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ (via Linear API)
┌────────────────────────────────▼────────────────────────────────────┐
│                              LINEAR                                  │
│  Views: "Up Next" | "Active Work" | "Blocked" | "Done"              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ (polls for work)
┌────────────────────────────────▼────────────────────────────────────┐
│                 RAILWAY DEV-AGENT (Claude Agent SDK)                 │
│                                                                      │
│  Skills: coding/ | codebase-context/ | integrations/ | escalation/   │
│  Tools: git, npm, bash, Linear status updates, human escalation      │
│  Feedback: Pattern storage + Correction learning                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                      HOME SERVICE AGENT CODEBASE                     │
│                                                                      │
│  Backend: Express API + 3 Agents (SDR, Reminder, Follow-up)          │
│  Frontend: Next.js Dashboard + Onboarding + Chat Widget              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Local PM Agent

### Objective
Create an intelligent local agent that mediates between you and the Railway dev-agent, with full project context via progressive disclosure skills.

### Directory Structure
```
pm-agent/
├── package.json
├── src/
│   ├── index.ts              # Entry point
│   ├── agent.ts              # Main PM agent with sub-agents
│   └── tools/
│       ├── linear.ts         # Linear MCP (reuse from dev-agent)
│       └── dev-agent-comms.ts # Communication tools
├── skills/
│   ├── project-context/
│   │   └── SKILL.md          # PRD, architecture, business rules
│   ├── planning/
│   │   └── SKILL.md          # Feature breakdown, estimation
│   ├── design-system/
│   │   └── SKILL.md          # UI/UX standards, Figma rules
│   ├── linear-workflow/
│   │   └── SKILL.md          # Issue templates, priorities
│   └── agent-patterns/
│       └── SKILL.md          # SDK patterns, skill authoring
├── agents/
│   ├── planning-agent.md     # Feature → Linear issues
│   ├── design-review-agent.md
│   ├── qa-agent.md
│   └── linear-coordinator.md
└── CLAUDE.md
```

### Sub-Agents
| Agent | Purpose | Model | Trigger |
|-------|---------|-------|---------|
| **Planning** | Break down features → Linear issues | opus | "plan", "create issues" |
| **Design Review** | UI/UX feedback, accessibility | sonnet | "design review", "UI" |
| **QA** | Security, test coverage | sonnet | "QA review", "security" |
| **Linear Coordinator** | Track progress, escalations | haiku | "status", "blocked" |

### Critical Files to Create
- `pm-agent/package.json` - Dependencies: @anthropic-ai/claude-agent-sdk, @linear/sdk
- `pm-agent/src/agent.ts` - Main agent loop with skill loading
- `pm-agent/skills/*/SKILL.md` - Progressive disclosure skills
- `pm-agent/agents/*.md` - Sub-agent system prompts

---

## Phase 2: Railway Dev-Agent Migration

### Objective
Migrate the existing dev-agent to use skills with progressive disclosure, add feedback loops for learning from corrections.

### Changes to dev-agent/
```
dev-agent/
├── src/
│   ├── agent.ts              # MODIFY: Add skill loading
│   ├── skills/               # NEW: Skills directory
│   │   ├── loader.ts         # Skill parser
│   │   ├── coding/
│   │   │   └── SKILL.md
│   │   ├── codebase-context/
│   │   │   └── SKILL.md
│   │   ├── integrations/
│   │   │   └── SKILL.md
│   │   └── escalation/
│   │       └── SKILL.md
│   ├── feedback/             # NEW: Learning system
│   │   ├── patterns.ts       # Successful pattern storage
│   │   └── corrections.ts    # Learning from reviews
│   └── tools/
│       └── linear.ts         # MODIFY: Add structured_escalation
├── data/                     # NEW: Persistent storage
│   ├── patterns/
│   └── corrections/
└── Dockerfile                # MODIFY: Add data volume
```

### New Features
1. **Skills Loading** - Dynamic context based on task type
2. **Pattern Storage** - Save successful implementations for reference
3. **Correction Tracking** - Learn from human review feedback
4. **Structured Escalation** - Detailed blocker reports when stuck

### Critical Files to Modify
- `dev-agent/src/agent.ts:processTask()` - Add skill context building
- `dev-agent/src/tools/linear.ts` - Add `structured_escalation` tool
- `dev-agent/Dockerfile` - Add volume for `/app/data`
- `dev-agent/railway.toml` - Configure persistent volume

---

## Phase 3: SaaS Frontend

### Objective
Build the user-facing frontend for home service business owners - must be EXTREMELY intuitive for non-technical users.

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS custom properties
- **Animation**: Framer Motion
- **State**: Zustand + React Query
- **Build**: Widget uses Vite for single-file output

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
│   │   ├── leads/            # Lead pipeline, cards
│   │   ├── conversations/    # Chat viewer, correction modal
│   │   └── onboarding/       # AI chat UI
│   ├── lib/
│   │   └── api-client.ts     # Backend API client
│   └── styles/
│       └── design-tokens.css
└── widget/                   # Embeddable chat
    ├── src/
    │   └── widget.tsx
    └── dist/
        └── widget.js         # Single bundled file
```

### Frontend Priority Order
1. **Owner Dashboard**
   - Lead pipeline (kanban with drag-drop)
   - Conversation viewer with agent indicators
   - **Owner Correction UI** - Mark agent responses as wrong, provide correct answer
   - Activity feed

2. **Conversational Onboarding**
   - Scrape website/social media
   - AI-guided Q&A to build BusinessConfig
   - Preview and activate

3. **Web Chat Widget**
   - Embeddable via script tag
   - < 50KB gzipped
   - Shadow DOM isolation

### Backend API Extensions Required
New endpoints in `src/routes/dashboard.ts`:
```typescript
GET  /api/{business}/leads
GET  /api/{business}/leads/:leadId
PATCH /api/{business}/leads/:leadId
GET  /api/{business}/conversations
GET  /api/{business}/conversations/:id
POST /api/{business}/conversations/:id/correct  // Owner correction
GET  /api/{business}/activity
POST /api/onboarding/scrape
POST /api/onboarding/chat
POST /api/onboarding/activate
```

### Design Principles (NEVER Generic AI Aesthetics)
- **Typography**: Outfit/DM Sans for headings, Satoshi for body (NOT Inter, Roboto, Arial)
- **Colors**: Deep navy primary (#0F172A), warm orange accent (#F97316), NOT purple gradients
- **Motion**: Staggered reveals, spring physics, meaningful hover states
- **Layout**: Intentional asymmetry, generous negative space

---

## Phase 4: Documentation Updates (Throughout)

### Files to Update
| File | Changes |
|------|---------|
| `docs/PRD.md` | Add PM Agent, frontend specs, owner correction system |
| `CLAUDE.md` | Add frontend patterns, design system rules, agent SDK usage |
| `AGENTS.md` | Document two-tier agent architecture (local PM + Railway dev) |
| Linear Project | Update views, create new labels, reset priorities |

---

## Implementation Sequence

### Phase 1: Foundation
- [ ] Create `pm-agent/` directory with SDK setup
- [ ] Build skill infrastructure (loader, SKILL.md files)
- [ ] Create 4 sub-agent definitions
- [ ] Test PM Agent locally with Linear integration

### Phase 2: Dev-Agent Enhancement
- [ ] Add skills directory to `dev-agent/`
- [ ] Implement skill loading in `agent.ts`
- [ ] Create feedback system (patterns.ts, corrections.ts)
- [ ] Add `structured_escalation` tool
- [ ] Deploy to Railway with data volume

### Phase 3: Dashboard
- [ ] Set up Next.js project in `web/`
- [ ] Build UI primitives with design tokens
- [ ] Implement lead pipeline (kanban)
- [ ] Build conversation viewer
- [ ] **Add owner correction modal**

### Phase 4: Onboarding
- [ ] Integrate Firecrawl for website scraping
- [ ] Build conversational onboarding UI
- [ ] Connect to existing `src/onboarding/` generators
- [ ] Preview and activation flow

### Phase 5: Widget
- [ ] Set up Vite build for widget
- [ ] Build embeddable chat component
- [ ] Create embed script generator
- [ ] Test cross-browser

### Phase 6: Integration & Polish
- [ ] End-to-end testing
- [ ] Motion/animations
- [ ] Accessibility audit
- [ ] Update all documentation

---

## Critical Files Reference

### Existing Files to Modify
- `dev-agent/src/agent.ts` - Add skill loading, context building
- `dev-agent/src/tools/linear.ts` - Add structured_escalation
- `dev-agent/Dockerfile` - Data volume
- `dev-agent/railway.toml` - Persistent storage config
- `src/routes/webhooks.ts` - New dashboard endpoints
- `src/onboarding/scraper/*.ts` - Implement scrapers (currently stubbed)
- `docs/PRD.md` - Add new architecture
- `CLAUDE.md` - Add frontend/agent patterns

### New Files to Create
- `pm-agent/` - Entire local PM agent
- `web/` - Entire frontend application
- `pm-agent/skills/*.md` - Progressive disclosure skills
- `dev-agent/src/skills/*.md` - Dev-agent skills
- `dev-agent/src/feedback/*.ts` - Learning system

### Key Patterns to Follow
- `dev-agent/src/agent.ts:AGENTS` - Sub-agent definition pattern
- `src/config/business.schema.ts` - Zod schema pattern for frontend types
- `src/agents/base.ts` - BaseAgent pattern for system prompts
- Anthropic blog progressive disclosure: Level 1 (name+desc) → Level 2 (SKILL.md) → Level 3 (references/)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Dev-agent first-attempt success | ~40% | 70% |
| Escalations per week | 8 | 3 |
| Time from issue to PR | 45 min | 25 min |
| Human review rejections | 30% | 15% |
| User onboarding completion | N/A | 90% |
| Dashboard engagement | N/A | Daily active |

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Local PM Agent vs Skills-only? | **Local PM Agent** with full SDK |
| Dev-agent SDK migration? | **Yes**, migrate to SDK with skills |
| Frontend priority? | **Dashboard → Onboarding → Widget** |
| Feedback mechanism? | **Owner correction UI** with learning |

---

*This document is the source of truth for the SaaS transformation. Reference PRD.md for product requirements.*

# Home Service Agent - Product Requirements Document

> **Version:** 1.0
> **Last Updated:** 2026-01-01
> **Status:** Draft

---

## 1. Product Vision

**One-liner:** AI-powered platform that helps home service businesses never miss a lead and close more jobs.

**Problem:** Home service business owners (painters, HVAC, plumbers, roofers) lose 40-60% of leads due to slow response times. They're on job sites, can't answer phones, and leads go cold within minutes.

**Solution:** An autonomous AI system that:
- Responds to leads instantly (< 5 min)
- Qualifies prospects using BANT methodology
- Books appointments without owner involvement
- Follows up on estimates automatically
- Provides daily briefings to owners via text

---

## 2. Target Users

### Primary: Home Service Business Owner
- **Demographics:** 35-55 years old, owns small business (1-20 employees)
- **Industries:** Painting, HVAC, Plumbing, Roofing, Electrical, Landscaping
- **Pain Points:**
  - Missing leads while on job sites
  - No time for marketing or follow-ups
  - Losing jobs to faster competitors
  - Overwhelmed by multiple communication channels
- **Goals:**
  - Close more jobs with same effort
  - Never miss a lead
  - Spend time on jobs, not admin

### Secondary: Office Manager / Dispatcher
- Needs visibility into lead pipeline
- Manages calendar and scheduling
- Wants automated reminders

---

## 3. MVP Definition (v1.0)

### Must Have (P0)
| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| SDR Agent | Qualify leads via SMS/Messenger | Responds within 5 min, uses BANT, books appointments |
| Reminder Agent | Appointment confirmations | Sends 24hr and 2hr reminders, handles rescheduling |
| Follow-up Agent | Post-estimate nurturing | 3-touch sequence, handles objections |
| Lead Ingestion | Facebook Lead Ads webhook | Creates lead record, triggers SDR agent |
| CRM Integration | GoHighLevel sync | Bi-directional lead/status sync |

### Should Have (P1)
| Feature | Description |
|---------|-------------|
| Owner Dashboard | Web UI to view leads, conversations |
| Owner Assistant | Text-based daily briefing |
| Calendar Integration | Google Calendar sync |

### Nice to Have (P2)
| Feature | Description |
|---------|-------------|
| CMO Agent | Marketing intelligence with RAG |
| Sales Coach | Real-time guidance for owners |
| Multi-CRM | HubSpot, Jobber, ServiceTitan adapters |

---

## 4. User Stories

### SDR Agent
```
AS A business owner
I WANT leads to be qualified automatically
SO THAT I only spend time on serious prospects
```

**Acceptance Criteria:**
- [x] Agent responds to new lead within 5 minutes
- [x] Uses BANT (Budget, Authority, Need, Timeline) questions
- [x] Marks lead as hot/warm/cool based on responses
- [x] Books consultation if lead is qualified
- [x] Updates CRM with all conversation data

### Reminder Agent
```
AS A business owner
I WANT appointment reminders sent automatically
SO THAT customers show up and I don't waste trips
```

**Acceptance Criteria:**
- [x] Sends confirmation 24 hours before appointment
- [x] Sends reminder 2 hours before
- [x] Allows customer to confirm, reschedule, or cancel
- [ ] Updates calendar if rescheduled (pending calendar integration)
- [x] Alerts owner if canceled

### Follow-up Agent
```
AS A business owner
I WANT automatic follow-up on estimates
SO THAT I close more jobs without chasing people
```

**Acceptance Criteria:**
- [x] Sends first follow-up 2 days after estimate
- [x] Handles common objections (price, timing, comparison)
- [x] Escalates hot leads to owner
- [x] Stops after 3 touches or explicit "no"

---

## 5. Technical Requirements

### Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Response Time | < 5 minutes | Industry standard for lead response |
| Uptime | 99.9% | Can't miss leads overnight/weekends |
| Message Delivery | 99% | Critical for customer communication |
| Data Retention | 2 years | Business records requirement |

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| TCPA Compliance | Explicit opt-in, quiet hours, opt-out |
| API Key Protection | Environment variables, never in code |
| PII Handling | No PII in logs, encrypted at rest |
| Rate Limiting | 3 texts/lead/day, 100 API calls/min |

### Integration Requirements

| System | Type | Priority | Status |
|--------|------|----------|--------|
| iMessage | SMS via Cloud Mac | P0 | Done |
| Twilio | SMS/MMS | P0 | Planned |
| Facebook Messenger | Chat | P0 | Done |
| GoHighLevel | CRM | P0 | Done |
| PaintScout | Estimating | P0 | Done |
| Google Calendar | Calendar | P1 | Planned |

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Lead Sources                         │
│  Facebook Ads │ Web Forms │ Phone │ Messenger │ iMessage │
└───────────────────────────┬─────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────┐
│                    Orchestrator                        │
│         Routes messages to appropriate agent           │
└───────────────────────────┬───────────────────────────┘
                            ↓
┌─────────────┬─────────────┬─────────────┐
│  SDR Agent  │ Reminder    │ Follow-up   │
│  (Qualify)  │ (Confirm)   │ (Nurture)   │
└──────┬──────┴──────┬──────┴──────┬──────┘
       ↓             ↓             ↓
┌───────────────────────────────────────────────────────┐
│                   Adapters Layer                       │
│   CRM │ Calendar │ Messaging │ Payments │ Photos     │
└───────────────────────────────────────────────────────┘
```

---

## 6.5 Tech Stack & Tools

### AI & Agents
| Component | Tool | Purpose |
|-----------|------|---------|
| Primary AI | Claude API (claude-sonnet-4-5) | Agent reasoning and generation |
| Agent Framework | Claude Agent SDK | Multi-agent orchestration |
| Dev Automation | dev-agent | Autonomous feature development |

### Work Tracking
| Component | Tool | Purpose |
|-----------|------|---------|
| Issue Management | Linear | Task tracking, sprints, priorities |
| Linear Integration | Linear MCP Server | Programmatic issue management |

### Development Plugins
| Plugin | Purpose | Priority |
|--------|---------|----------|
| feature-dev | Structured 7-phase feature development | HIGH |
| frontend-design | Distinctive UI design patterns | HIGH |
| pr-review-toolkit | Code review, security, type analysis | HIGH |
| context7 | Up-to-date library documentation | HIGH |
| commit-commands | Streamlined git workflow | MEDIUM |

### MCP Servers
| Server | Purpose |
|--------|---------|
| Linear | Issue/project management API |
| Git | Version control operations |
| Bash | Command execution |
| DataForSEO | SEO/keyword data (P2 CMO Agent) |
| Firecrawl | Web scraping (P2 competitor analysis) |
| Perplexity | Market research (P2 CMO Agent) |

### Owner Dashboard (P1)
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Next.js 14 (App Router) | SSR, API routes, React Server Components |
| Styling | Tailwind CSS + Design Tokens | Utility-first with consistent theming |
| State | Zustand + React Query | Simple global state + server state caching |
| Animation | Framer Motion | High-impact transitions, spring physics |
| Design Pattern | frontend-design plugin | Distinctive aesthetics, never generic AI |

---

## 6.6 Frontend Architecture (web/)

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
│   │   ├── ui/               # Primitives (Button, Card, Modal)
│   │   ├── leads/            # Lead cards, kanban columns
│   │   ├── conversations/    # Chat viewer, correction modal
│   │   └── onboarding/       # AI chat UI
│   ├── lib/
│   │   └── api-client.ts     # Backend API client
│   └── styles/
│       └── design-tokens.css # Custom properties
└── widget/                   # Embeddable chat
    ├── src/
    │   └── widget.tsx
    └── dist/
        └── widget.js         # Single bundled file (<50KB)
```

### Design Principles

**Typography:**
- Headings: Outfit or DM Sans (distinctive, modern)
- Body: Satoshi (readable, character)
- NEVER use: Inter, Roboto, Arial, system fonts

**Colors:**
- Primary: Deep navy (#0F172A)
- Accent: Warm orange (#F97316)
- NEVER use: Purple gradients on white (cliché AI aesthetic)

**Motion:**
- Staggered reveals on page load
- Spring physics for interactions
- Meaningful hover states
- Scroll-triggered animations

**Layout:**
- Intentional asymmetry over rigid grids
- Generous negative space
- Layered depth with subtle shadows
- Unexpected element placement

---

## 6.7 Dashboard API Endpoints

Backend extensions for the owner dashboard. All endpoints prefixed with `/api/{business-slug}/`.

### Lead Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/leads` | GET | List leads with pagination/filters |
| `/leads/:leadId` | GET | Single lead with full history |
| `/leads/:leadId` | PATCH | Update lead status, temperature |
| `/leads/:leadId/assign` | POST | Assign to agent or owner |

### Conversations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/conversations` | GET | List conversations by lead |
| `/conversations/:id` | GET | Full conversation with messages |
| `/conversations/:id/correct` | POST | Owner correction (see below) |
| `/conversations/:id/takeover` | POST | Owner takes over from agent |

### Activity & Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/activity` | GET | Activity feed (new leads, messages, etc) |
| `/analytics/overview` | GET | KPIs: response time, conversion, etc |
| `/analytics/agents` | GET | Per-agent performance metrics |

### Onboarding

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/scrape` | POST | Scrape website/social for business info |
| `/api/onboarding/chat` | POST | AI-guided Q&A to build config |
| `/api/onboarding/activate` | POST | Generate config, activate agents |

---

## 6.8 Owner Correction System

Owners can mark AI responses as incorrect, teaching the system to improve.

### Correction Flow

1. Owner sees agent message in conversation viewer
2. Clicks "Wrong" button on specific message
3. Modal appears with:
   - Original agent response (read-only)
   - Text field for correct response
   - Dropdown for correction type (tone, accuracy, action)
4. Submits correction
5. System stores correction for agent learning

### Correction Types

| Type | Description | Example |
|------|-------------|---------|
| `tone` | Response was too formal/informal | "Be more casual with residential customers" |
| `accuracy` | Factual error about business | "We don't do commercial work" |
| `action` | Wrong next step | "Should have offered to call, not text" |
| `boundary` | Agent overstepped | "Don't discuss pricing without estimate" |

### Learning Integration

Corrections are stored in `data/corrections/` and loaded by dev-agent's feedback system:
- Corrections become "avoid this" context for similar tasks
- Patterns emerge over time (e.g., "always offer phone call for estimates over $5k")
- Review checklist includes correction-based items

---

## 6.9 Web Chat Widget

Embeddable chat widget for business websites.

### Requirements

| Requirement | Target |
|-------------|--------|
| Bundle size | < 50KB gzipped |
| Load time | < 500ms |
| Browser support | Chrome, Firefox, Safari, Edge (last 2 versions) |
| Mobile | Full responsive support |

### Implementation

```html
<!-- Embed on any website -->
<script src="https://widget.hsa.ai/embed.js"
        data-business="orange-blossom-cabinets"
        data-theme="auto"
        data-position="bottom-right">
</script>
```

### Features

- Shadow DOM isolation (no style conflicts)
- Configurable via data attributes
- Theme support (light/dark/auto)
- Mobile-optimized touch interactions
- Persistent session across page navigations
- File/photo upload support
- Typing indicators
- Read receipts

---

## 6.10 Onboarding Flow

AI-guided setup that makes configuration feel like a conversation, not a form.

### Flow Steps

1. **Welcome** - Brief intro, set expectations
2. **Website Scan** - Firecrawl scrapes business site/Facebook
3. **Review Extracted** - AI shows what it learned, asks clarifying questions
4. **Service Details** - Conversational Q&A about services, pricing, availability
5. **Communication Preferences** - Response tone, quiet hours, escalation rules
6. **Agent Preview** - Shows sample agent responses for approval
7. **Activation** - Generates config, enables agents, provides embed code

### AI Extraction Targets

From website/social media:
- Business name, logo, colors
- Service areas and offerings
- Contact information
- Operating hours
- Customer reviews/testimonials
- Team member info

### Generated Artifacts

- `BusinessConfig` JSON in `src/config/businesses/`
- Agent system prompts customized to business
- Widget embed code with business-specific styling

---

## 7. Success Metrics

### Primary KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Lead Response Time | < 5 min | Time from lead to first message |
| Qualification Rate | > 40% | Leads that complete BANT |
| Appointment Show Rate | > 80% | Appointments attended |
| Estimate Close Rate | > 30% | Estimates that convert |

### Secondary KPIs
| Metric | Target |
|--------|--------|
| Owner Time Saved | 10+ hrs/week |
| Customer Satisfaction | > 4.5/5 |
| Message Opt-out Rate | < 5% |

---

## 8. Release Plan

### Phase 1: Foundation (Complete)
- [x] Dev agent with Linear integration
- [x] Circuit breaker for cost control
- [x] PRD and security documentation

### Phase 2: Core Agents (Complete)
- [x] SDR Agent with BANT
- [x] Reminder Agent
- [x] Follow-up Agent
- [x] Facebook Lead Ads integration
- [ ] Twilio SMS adapter (iMessage working, Twilio planned)
- [ ] Calendar integration (Google Calendar sync)
- [ ] Email sending (for follow-up sequences)

### Phase 3: Owner Experience
- [ ] Owner Assistant (SMS)
- [ ] Web Dashboard (Next.js)
- [ ] Daily Digest

### Phase 4: Scale
- [ ] Multi-CRM adapters
- [ ] CMO Agent with RAG
- [ ] Sales Coach

---

## 9. Open Questions

| Question | Status | Decision |
|----------|--------|----------|
| SaaS vs white-label? | Open | Affects auth, billing, multi-tenant |
| Pricing model? | Open | Per lead, per message, flat fee? |
| Which CRM to prioritize? | Decided | GoHighLevel first (owner uses it) |
| iMessage vs SMS? | Decided | Both - iMessage for iOS, SMS fallback |

---

## 10. Appendix

### Competitive Analysis
- **Smith.ai** - Human + AI answering service ($140-$700/mo)
- **Broadly** - Review management + messaging ($299/mo)
- **Podium** - Text marketing + payments ($249-$449/mo)

### Differentiators
- Fully autonomous (no human in loop for routine tasks)
- Built specifically for home services (not generic)
- Integrates with industry-specific tools (PaintScout, CompanyCam)

---

*This PRD is the source of truth for product decisions. Update it as requirements evolve.*

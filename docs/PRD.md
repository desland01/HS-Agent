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

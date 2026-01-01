/**
 * Sync roadmap to Linear
 *
 * Creates issues for each phase and task in the plan
 */

import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

interface Task {
  title: string;
  description: string;
  phase: string;
}

const ROADMAP: Task[] = [
  // Phase 1: Foundation & Agent Architecture
  { phase: 'Phase 1', title: '1.1 Agent Skills Framework', description: `Create src/skills/ directory structure following agentskills.io spec:
- Implement SKILL.md format with YAML frontmatter
- Build skill loader with progressive disclosure
- Create skill registry for dynamic discovery

Files: src/skills/SKILL.md, src/lib/skill-loader.ts, src/lib/skill-registry.ts` },

  { phase: 'Phase 1', title: '1.2 Tool Calling Infrastructure', description: `Define tool schemas and refactor to Claude tool_use:
- Define tool schemas for all agent actions (CRM, messaging, calendar)
- Refactor BaseAgent to use Claude tool_use instead of metadata parsing
- Implement tool execution layer with adapter integration
- Add tool authorization (TCPA compliance, rate limits)

Files: src/agents/base.ts, src/lib/orchestrator.ts, src/lib/tools/` },

  { phase: 'Phase 1', title: '1.3 Context Engineering', description: `Implement Anthropic context best practices:
- Implement compaction with tool result clearing first
- Add structured note-taking (NOTES.md pattern)
- Limit sub-agent responses to 2,000 tokens max
- Just-in-time context loading
- Token counting with proactive summarization

Files: src/lib/context-manager.ts, src/lib/summarizer.ts, src/lib/notes.ts` },

  { phase: 'Phase 1', title: '1.4 Unified Agent Response Schema', description: `Standardize agent outputs:
- Define TypeScript interfaces for all agent outputs
- Create response validators (Zod schemas)
- Implement structured output parsing (replace regex)

Files: src/types/agent-response.schema.ts, src/lib/response-parser.ts` },

  // Phase 2: Lead Automation Agents Enhancement
  { phase: 'Phase 2', title: '2.1 SDR Agent Skills', description: `Migrate SDR to skills framework:
- Migrate system prompt to src/skills/sdr/SKILL.md
- Create qualification skill
- Create objection handling skill
- Add source-aware greeting skills per platform
- Implement tool-based CRM updates` },

  { phase: 'Phase 2', title: '2.2 Reminder Agent Skills', description: `Migrate Reminder agent to skills:
- Migrate to skills format
- Add calendar lookup tool
- Create rescheduling skill with availability checking
- Add confirmation tracking skill` },

  { phase: 'Phase 2', title: '2.3 Follow-up Agent Skills', description: `Migrate Follow-up agent to skills:
- Migrate to skills format
- Create objection response library
- Add estimate status tool
- Implement nurture sequence skill` },

  { phase: 'Phase 2', title: '2.4 Agent Handoff Protocol', description: `Define agent-to-agent handoffs:
- Define handoff interface between agents
- Implement context transfer on handoff
- Add handoff logging for analytics` },

  // Phase 3: Owner Assistant Agent
  { phase: 'Phase 3', title: '3.1 Core Owner Assistant', description: `Build owner assistant infrastructure:
- Create OwnerAssistantAgent class
- Define owner-facing conversation state
- Implement owner authentication
- Add owner SMS channel adapter

Files: src/agents/owner-assistant.ts, src/lib/owner-state.ts, src/adapters/channels/owner-sms.ts` },

  { phase: 'Phase 3', title: '3.2 Calendar Integration', description: `Add calendar tools:
- Tool: getCalendarToday
- Tool: getCalendarWeek
- Tool: findNextAvailable
- Integrate with Google Calendar / Calendly API

Files: src/adapters/calendar/google-calendar.ts, src/adapters/calendar/calendly.ts` },

  { phase: 'Phase 3', title: '3.3 Project Status System', description: `Build project tracking:
- Tool: getActiveProjects
- Tool: getProjectDetails
- Tool: getRecentUpdates
- Define project status data model

Files: src/lib/project-tracker.ts, src/skills/owner-assistant/projects/SKILL.md` },

  { phase: 'Phase 3', title: '3.4 CompanyCam Integration', description: `Integrate CompanyCam for job photos:
- Research CompanyCam API
- Tool: getRecentPhotos
- Tool: getProjectPhotos
- Tool: notifyNewPhotos

Files: src/adapters/companycam/index.ts` },

  { phase: 'Phase 3', title: '3.5 Daily Digest', description: `Implement morning briefing:
- Scheduled summary message
- Key metrics: leads, appointments, follow-ups due
- Proactive alerts: hot leads, overdue follow-ups` },

  // Phase 4: Marketing CMO Agent
  { phase: 'Phase 4', title: '4.1 Vector Database Setup', description: `Set up RAG with Contextual Retrieval:
- Set up Supabase pgvector
- Implement Contextual Embeddings (prepend 50-100 token context)
- Add Contextual BM25 for hybrid search
- Add reranking layer

Files: src/lib/vector-store/index.ts, contextual-embeddings.ts, hybrid-search.ts, reranker.ts` },

  { phase: 'Phase 4', title: '4.2 Facebook Marketing Knowledge Base', description: `Curate FB ads knowledge:
- FB ads best practices for home services
- Audience targeting strategies
- Creative examples and templates
- Campaign structure playbooks

Files: src/skills/cmo/facebook/SKILL.md, src/skills/cmo/facebook/references/` },

  { phase: 'Phase 4', title: '4.3 Google Ads Knowledge Base', description: `Curate Google ads knowledge:
- Local Services Ads (LSA) best practices
- Search campaign strategies for contractors
- Landing page optimization guides
- Keyword research for home services

Files: src/skills/cmo/google-ads/SKILL.md` },

  { phase: 'Phase 4', title: '4.4 YouTube Production Knowledge', description: `Curate YouTube knowledge:
- Video content strategy for contractors
- Script templates (testimonials, how-to, behind-scenes)
- Thumbnail and title optimization
- Equipment recommendations

Files: src/skills/cmo/youtube/SKILL.md` },

  { phase: 'Phase 4', title: '4.5 Creative Script Writing Skill', description: `Build creative writing capabilities:
- Ad copy generation (FB, Google)
- Video script templates
- Email sequence writing
- Landing page copy

Files: src/skills/cmo/creative/SKILL.md` },

  { phase: 'Phase 4', title: '4.6 CMO Agent Implementation', description: `Build the CMO agent:
- Create CMOAgent class with RAG integration
- Define marketing-specific tools
- Implement campaign planning workflow
- Add budget optimization logic

Files: src/agents/cmo.ts, src/lib/tools/marketing-tools.ts` },

  // Phase 5: CRM Platform
  { phase: 'Phase 5', title: '5.1 Lead Ingestion Layer', description: `Enhance lead intake:
- Facebook Lead Ads webhook (enhance existing)
- Google Ads conversion tracking
- Web form universal handler
- Chat widget integration

Files: src/routes/leads/facebook.ts, google.ts, webform.ts, chat-widget.ts` },

  { phase: 'Phase 5', title: '5.2 Lead Database & Pipeline', description: `Build lead storage:
- Set up PostgreSQL (Supabase)
- Define lead schema with full history
- Implement customizable pipeline stages
- Add lead scoring model
- Create activity timeline

Files: src/db/schema/leads.ts, activities.ts, pipelines.ts, src/lib/lead-service.ts` },

  { phase: 'Phase 5', title: '5.3 CRM API', description: `Build CRM REST API:
- Lead CRUD endpoints
- Pipeline management endpoints
- Activity logging endpoints
- Search and filtering
- Bulk operations

Files: src/routes/api/leads.ts, pipelines.ts, activities.ts` },

  { phase: 'Phase 5', title: '5.4 External CRM Sync', description: `Add CRM adapters:
- Enhance GoHighLevel adapter
- Enhance PaintScout adapter
- Add HubSpot adapter
- Add Jobber adapter
- Add ServiceTitan adapter
- Add Housecall Pro adapter
- Bi-directional sync engine

Files: src/adapters/crm/*.ts, src/lib/crm-sync.ts` },

  // Phase 6: Sales Coach System
  { phase: 'Phase 6', title: '6.1 Coaching Engine', description: `Build sales coach:
- Create SalesCoachAgent class
- Implement lead analysis (who needs attention)
- Build response suggestions
- Add timing recommendations

Files: src/agents/sales-coach.ts, src/skills/sales-coach/SKILL.md` },

  { phase: 'Phase 6', title: '6.2 Proactive Notifications', description: `Add owner alerts:
- Hot lead alerts (text to owner)
- Follow-up reminders
- Stale lead warnings
- Win/loss pattern insights` },

  { phase: 'Phase 6', title: '6.3 Response Templates', description: `Build suggestion system:
- Suggest responses based on lead stage
- Objection handling recommendations
- Personalized message suggestions
- A/B test tracking` },

  { phase: 'Phase 6', title: '6.4 Performance Analytics', description: `Add analytics:
- Response time tracking
- Conversion rate by source
- Win/loss analysis
- Owner improvement suggestions` },

  // Phase 7: UI/UX Dashboard
  { phase: 'Phase 7', title: '7.1 Frontend Setup', description: `Initialize dashboard:
- Next.js 14+ with App Router
- shadcn/ui + Tailwind
- React Query + Zustand
- Clerk or Auth.js` },

  { phase: 'Phase 7', title: '7.2 Authentication & Onboarding', description: `Build auth flows:
- Business owner signup flow
- Business configuration wizard
- Integration connections (FB, Google, CRM)
- Team member invites` },

  { phase: 'Phase 7', title: '7.3 Dashboard Views', description: `Build core views:
- Home: Daily metrics, hot leads, calendar
- Leads: Pipeline view, lead details, activity timeline
- Conversations: Chat interface, agent handoff visibility
- Calendar: Appointments, availability settings
- Marketing: CMO insights, campaign suggestions
- Settings: Business config, integrations, team` },

  { phase: 'Phase 7', title: '7.4 Mobile Responsiveness', description: `Mobile optimization:
- Mobile-first dashboard design
- PWA support for app-like experience
- Push notifications` },

  { phase: 'Phase 7', title: '7.5 Real-time Features', description: `Add live updates:
- WebSocket for live lead updates
- Typing indicators for chat
- Live agent activity feed` },

  // Phase 8: Launch Preparation
  { phase: 'Phase 8', title: '8.1 Infrastructure', description: `Production setup:
- Production deployment (Vercel/Railway)
- Database hosting (Supabase)
- Redis hosting (Upstash)
- Monitoring (Sentry, LogRocket)
- Analytics (PostHog/Mixpanel)` },

  { phase: 'Phase 8', title: '8.2 Security & Compliance', description: `Security audit:
- TCPA compliance audit
- Data encryption review
- Rate limiting
- API authentication
- SOC 2 readiness checklist` },

  { phase: 'Phase 8', title: '8.3 Documentation', description: `Create docs:
- API documentation
- User onboarding guides
- Integration setup guides
- Video tutorials` },

  { phase: 'Phase 8', title: '8.4 Beta Testing', description: `Launch prep:
- Internal testing
- Beta user recruitment (3-5 home service businesses)
- Feedback collection
- Bug fixes and polish` }
];

async function main() {
  const me = await client.viewer;
  console.log(`Logged in as: ${me.name} (${me.email})`);

  // Get the team
  const teams = await client.teams();
  const team = teams.nodes[0];
  console.log(`Team: ${team.name} (${team.key})`);

  // Get existing issues
  const existingIssues = await client.issues({
    filter: { team: { id: { eq: team.id } } },
    first: 100
  });
  const existingTitles = new Set(existingIssues.nodes.map(i => i.title));
  console.log(`Existing issues: ${existingIssues.nodes.length}`);

  // Get "Todo" state
  const states = await team.states();
  const todoState = states.nodes.find(s => s.name.toLowerCase() === 'todo');
  if (!todoState) {
    console.error('Could not find "Todo" state');
    return;
  }

  // Create missing issues
  let created = 0;
  for (const task of ROADMAP) {
    if (existingTitles.has(task.title)) {
      console.log(`Skip (exists): ${task.title}`);
      continue;
    }

    const result = await client.createIssue({
      teamId: team.id,
      title: task.title,
      description: `**${task.phase}**\n\n${task.description}`,
      stateId: todoState.id,
      assigneeId: me.id
    });

    const issue = await result.issue;
    console.log(`Created: ${issue?.identifier} - ${task.title}`);
    created++;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! Created ${created} new issues.`);
}

main().catch(console.error);

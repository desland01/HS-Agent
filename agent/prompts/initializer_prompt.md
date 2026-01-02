# Home Service Agent - Project Initializer

You are an autonomous agent responsible for setting up the Home Service Agent project in Linear.

## Your Mission

Create a complete set of Linear issues that break down the Home Service Agent application into implementable tasks. You will create exactly 50 issues based on the application specification below.

## Application Specification

{{APP_SPEC}}

## Instructions

### Step 1: List Linear Teams

First, use the Linear MCP to list available teams:
```
Use: mcp__linear__list_teams
```

Find the team named "Grove Street Painting" and note its ID.

### Step 2: Create Project

Create a new project for tracking this work:
```
Use: mcp__linear__create_project
- name: "Home Service Agent"
- description: "AI-powered lead management platform for home service businesses"
- team: [team ID from step 1]
```

Note the project ID for use in issue creation.

### Step 3: Create Issues

Create exactly 50 issues based on the "Implementation Steps" section of the app spec. For each issue:

**Issue Structure:**
- **Title**: Clear, action-oriented (e.g., "Implement SDR agent prompt with BANT methodology")
- **Description**: Include:
  - Overview of what needs to be built
  - Acceptance criteria (2-4 bullet points)
  - Technical notes (files to create/modify, dependencies)
  - Testing requirements
- **Priority**: Map from spec (Priority 1 = High/2, Priority 2 = Normal/3, Priority 3 = Low/4)
- **Labels**: Apply appropriate labels (foundation, agent, integration, api, security, testing, dashboard)
- **Project**: Assign to "Home Service Agent" project

**Example Issue Description:**
```markdown
## Overview
Implement the SDR agent prompt that uses BANT (Budget, Authority, Need, Timeline) methodology to qualify leads through natural conversation.

## Acceptance Criteria
- [ ] Agent asks qualifying questions naturally, not as a checklist
- [ ] Extracts budget range, decision-maker status, project timeline
- [ ] Categorizes lead as hot/warm/cool based on responses
- [ ] Handles edge cases (unclear answers, off-topic messages)

## Technical Notes
- Create `src/agents/sdr/prompt.ts` with system prompt
- Use Claude's conversation format with examples
- Reference `src/types/lead.ts` for LeadTemperature type

## Testing
- Unit test with mock conversations covering each temperature
- Integration test with Claude API (mocked responses)
```

### Step 4: Create META Issue

Create a special tracking issue:
```
Title: "[META] Home Service Agent Progress Tracker"
Description:
## Purpose
This issue tracks overall progress and serves as a session handoff point for the autonomous agent.

## Session Log
(Agent will add comments here summarizing each session's work)

## Completion Checklist
- [ ] Foundation (Issues 1-4)
- [ ] SDR Agent (Issues 5-8)
- [ ] Reminder Agent (Issues 9-13)
- [ ] Follow-up Agent (Issues 14-18)
- [ ] Orchestrator (Issues 19-22)
- [ ] Channel Adapters (Issues 23-27)
- [ ] CRM Adapter (Issues 28-32)
- [ ] API Routes (Issues 33-38)
- [ ] Security & Compliance (Issues 39-43)
- [ ] Testing (Issues 44-47)
- [ ] Owner Dashboard (Issues 48-50)
```

### Step 5: Create Initialization Script

Create an init.sh file in the project directory:
```bash
#!/bin/bash
# Home Service Agent - Project Initialization

echo "Setting up Home Service Agent..."

# Install dependencies
npm install

# Create .env from example if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env file - please configure it"
fi

# Run type check
npm run typecheck

echo "Setup complete!"
```

### Step 6: Verify and Report

After creating all issues:
1. List all created issues to verify count
2. Add a comment to the META issue summarizing initialization:
   - Number of issues created
   - Project structure
   - Next steps

## Rules

1. **Be thorough**: Each issue should have enough detail for autonomous implementation
2. **Be consistent**: Use the same format for all issue descriptions
3. **Be practical**: Include file paths, dependencies, and testing requirements
4. **No placeholders**: Every field should have real, actionable content
5. **Atomic issues**: Each issue should be completable in one session (2-4 hours of work)

## Working Directory

You are working in: {{PROJECT_DIR}}

The existing codebase has:
- `src/` - Core application code (partially implemented)
- `docs/PRD.md` - Full product requirements
- `docs/SECURITY.md` - Security checklist

Your job is to create the Linear project structure that will guide the autonomous coding agent through completing this application.

## Begin

Start by listing the Linear teams to find "Grove Street Painting".

---
name: Linear Workflow
description: Issue templates, priority guidelines, view management, and Linear best practices
---

# Linear Workflow Skill

Standards and templates for managing work in Linear.

## Workspace Structure

### Teams

| Team | Key | Purpose |
|------|-----|---------|
| Engineering | ENG | All development work |
| Design | DES | UI/UX design tasks |
| Product | PRD | Feature planning |

### Views

| View | Purpose | Filter |
|------|---------|--------|
| **Up Next** | Prioritized work ready for development | State: Todo, Priority: 1-2 |
| **Active Work** | Currently in progress | State: In Progress, In Review |
| **Blocked** | Items needing human input | Label: blocked |
| **Backlog** | Future work to prioritize | State: Backlog |

## Issue Templates

### Feature Issue

```markdown
## Summary
[One-line description of the feature]

## User Story
As a [type of user], I want [goal] so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Approach
[High-level implementation notes]

## Design
[Link to Figma/design files]

## Dependencies
- Blocked by: [issue links]
- Blocks: [issue links]

## Out of Scope
[What this issue does NOT include]
```

### Bug Issue

```markdown
## Bug Description
[Clear description of the issue]

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Browser/Device:
- OS:
- User type:

## Screenshots/Logs
[Attach relevant evidence]

## Severity
- [ ] Critical (production down)
- [ ] High (major feature broken)
- [ ] Medium (feature impaired)
- [ ] Low (minor issue)
```

### Tech Debt Issue

```markdown
## Problem
[What's the current situation]

## Impact
[Why this matters - performance, maintainability, security]

## Proposed Solution
[How to fix it]

## Effort Estimate
[Time/complexity estimate]

## Risk if Deferred
[What happens if we don't fix this]
```

### Spike Issue

```markdown
## Question to Answer
[What do we need to learn?]

## Context
[Why we need to investigate this]

## Approach
- Research area 1
- Research area 2
- Prototype if needed

## Timebox
[Maximum time to spend: usually 2-4 hours]

## Deliverable
- [ ] Written summary of findings
- [ ] Recommendation for next steps
- [ ] Create follow-up issues if needed
```

## Priority Guidelines

| Priority | Label | SLA | Examples |
|----------|-------|-----|----------|
| **P1 Urgent** | urgent | Same day | Production outage, security breach |
| **P2 High** | high | This sprint | Critical path, revenue impact |
| **P3 Medium** | medium | Next sprint | Important features, tech debt |
| **P4 Low** | low | Backlog | Nice-to-have, polish |

## State Workflow

```
Triage -> Backlog -> Todo -> In Progress -> In Review -> Done
                                     |
                                     v
                                  Blocked
```

### State Descriptions

- **Triage**: New issues needing review
- **Backlog**: Accepted but not prioritized
- **Todo**: Ready for work, prioritized
- **In Progress**: Actively being worked on
- **In Review**: Code review or testing
- **Blocked**: Waiting on external input
- **Done**: Completed and deployed
- **Canceled**: Won't do

## Labels

### Type Labels
- `feature` - New functionality
- `bug` - Something broken
- `tech-debt` - Code quality improvement
- `spike` - Research/investigation
- `chore` - Maintenance tasks

### Area Labels
- `frontend` - UI/client code
- `backend` - API/server code
- `infra` - DevOps/infrastructure
- `docs` - Documentation

### Status Labels
- `blocked` - Waiting on something
- `needs-design` - Requires design input
- `needs-review` - Ready for code review

## Estimation

Use Fibonacci points: 1, 2, 3, 5, 8

- **1**: Trivial change, <1 hour
- **2**: Simple, few hours
- **3**: Moderate, half day
- **5**: Complex, full day
- **8**: Very complex, consider splitting

## Best Practices

1. **One concern per issue** - Don't bundle unrelated work
2. **Clear acceptance criteria** - Know when it's done
3. **Link dependencies** - Use blocking relationships
4. **Update status daily** - Keep stakeholders informed
5. **Close issues promptly** - Don't leave done work open
6. **Archive completed cycles** - Keep views clean
7. **Use sub-issues** - Break down large work items

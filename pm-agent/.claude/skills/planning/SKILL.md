---
name: Planning
description: Break down features into actionable Linear issues with proper estimates, dependencies, and acceptance criteria
---

# Planning Skill

This skill guides you through breaking down features into well-structured Linear issues.

## Feature Breakdown Process

### Step 1: Understand the Feature

Before creating issues, ensure you understand:
- **User story**: Who benefits and how?
- **Scope boundaries**: What's in and out?
- **Dependencies**: What must exist first?
- **Success criteria**: How do we know it's done?

### Step 2: Identify Work Types

Categorize work into these types:

| Type | Description | Typical Estimate |
|------|-------------|------------------|
| **Spike** | Research/investigation | 1-2 points |
| **Foundation** | Infrastructure/setup | 2-3 points |
| **Core** | Main feature logic | 3-5 points |
| **Integration** | Connect to external systems | 2-3 points |
| **Polish** | UX improvements, edge cases | 1-2 points |
| **Testing** | Test coverage, QA | 1-2 points |

### Step 3: Issue Template

Each issue should include:

```markdown
## Context
[Why this work matters]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
[Implementation hints, gotchas]

## Testing Requirements
- Unit tests for: ...
- Integration tests for: ...

## Out of Scope
[Explicitly list what's NOT included]
```

### Step 4: Estimate Guidelines

Use Fibonacci points (1, 2, 3, 5, 8):

- **1 point**: Simple change, well-understood
- **2 points**: Straightforward implementation
- **3 points**: Some complexity, may need research
- **5 points**: Complex, multiple components
- **8 points**: Very complex, consider splitting

### Step 5: Priority Assignment

| Priority | When to Use | Response Time |
|----------|-------------|---------------|
| **Urgent (1)** | Blocking production | Immediate |
| **High (2)** | Critical path item | This sprint |
| **Medium (3)** | Important but not critical | Next sprint |
| **Low (4)** | Nice to have | Backlog |

## Example Breakdown

**Feature**: User Authentication

**Issues**:

1. `[Foundation]` Set up auth middleware (3 pts, High)
2. `[Core]` Implement login/logout flow (5 pts, High)
3. `[Core]` Password reset functionality (3 pts, Medium)
4. `[Integration]` OAuth provider setup (5 pts, Medium)
5. `[Polish]` Session timeout handling (2 pts, Low)
6. `[Testing]` Auth integration tests (2 pts, High)

## Linear Best Practices

1. **Use Labels**: Apply consistent labels (feature, bug, tech-debt, etc.)
2. **Set Parent Issues**: Group related work under epics
3. **Link Dependencies**: Use blocking relationships
4. **Add Context**: Include links to designs, docs
5. **Assign Early**: Get commitment from developers

## Handoff to Development

When planning is complete:
1. Review estimates with dev team
2. Clarify any questions
3. Move issues to "Up Next" view
4. Schedule kickoff discussion if complex

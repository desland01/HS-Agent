---
name: escalation
description: When and how to escalate blockers, document issues, and request human help
triggers: [block, stuck, error, fail, help, escalate, human, review, unclear]
priority: 4
alwaysLoad: false
---

# Escalation Protocol

## When to Escalate

Escalate to a human when:

1. **Technical Blockers**
   - Build/type errors after 3 fix attempts
   - External service is down or returning unexpected errors
   - Missing environment variables or credentials
   - Dependency conflicts that can't be resolved

2. **Ambiguous Requirements**
   - Task description is unclear or contradictory
   - Multiple valid interpretations exist
   - Acceptance criteria are missing or vague
   - Business logic decisions needed

3. **Security Concerns**
   - Task requires handling sensitive data
   - Potential security implications unclear
   - Need approval for risky operations

4. **Architecture Decisions**
   - Major structural changes needed
   - Breaking changes to APIs
   - New dependencies with licensing concerns
   - Performance implications unclear

5. **External Dependencies**
   - Waiting on third-party API access
   - Need human to configure external service
   - Requires manual verification steps

## How to Escalate

### Use Structured Escalation Tool

```typescript
await linearTools.structured_escalation({
  issueId: issue.id,
  blockerType: 'technical', // or 'requirements', 'security', 'architecture', 'external'
  summary: 'Short one-line summary of the blocker',
  context: {
    attempted: [
      'Approach 1: Tried X, failed because Y',
      'Approach 2: Tried A, failed because B',
      'Approach 3: Tried C, resulted in D'
    ],
    errorDetails: 'Specific error message or stack trace',
    filesInvolved: ['src/file1.ts', 'src/file2.ts'],
    hypothesis: 'What I think the root cause might be',
    suggestedNextSteps: [
      'Option A: Do X (pros/cons)',
      'Option B: Do Y (pros/cons)'
    ]
  },
  urgency: 'medium' // 'low', 'medium', 'high', 'critical'
});
```

### Blocker Report Format

When documenting a blocker, include:

```markdown
## Blocker Report

### Summary
One sentence describing the blocker.

### What I Tried
1. **Approach 1**: Tried X
   - Result: Failed with error "..."
   - Why it didn't work: Y

2. **Approach 2**: Tried A
   - Result: Partially worked but B
   - Why it didn't work: C

3. **Approach 3**: Tried D
   - Result: Made progress but E
   - Why it didn't work: F

### Error Details
```
Paste actual error message or stack trace
```

### Files Involved
- `src/path/to/file1.ts` - Description of relevance
- `src/path/to/file2.ts` - Description of relevance

### Root Cause Hypothesis
What I think is causing this issue and why.

### Suggested Next Steps
1. Option A: Description (Recommended if X)
2. Option B: Description (Recommended if Y)

### Questions for Human
- Specific question 1?
- Specific question 2?

### Urgency
- [ ] Critical - Blocking all work
- [x] High - Blocking this task
- [ ] Medium - Can work around temporarily
- [ ] Low - Nice to resolve but not blocking
```

## Escalation Levels

### Level 1: Self-Recovery
Before escalating, attempt:
- Check CLAUDE.md for project-specific guidance
- Search codebase for similar patterns
- Use Context7 for library documentation
- Try alternative approaches (minimum 3 attempts)

### Level 2: Request Clarification
For ambiguous requirements:
- Document your interpretation
- List the alternatives
- Ask specific questions
- Propose a default approach

### Level 3: Full Escalation
For true blockers:
- Update Linear issue status
- Add detailed blocker comment
- Assign to appropriate human
- Set priority to urgent if blocking

## After Escalation

### Do NOT
- Continue working on blocked task
- Make assumptions about blocked decision
- Attempt risky workarounds
- Wait indefinitely without follow-up

### DO
- Move to next available task
- Check back periodically for updates
- Add new information if discovered
- Update blocker status when resolved

## Escalation Tool Usage

### Quick Escalation (Simple Blockers)

```typescript
// For straightforward blockers
await linearTools.assign_to_human({
  issueId: issue.id,
  reason: 'Build failing with TypeScript error after 3 attempts: "TS2304: Cannot find name X"'
});
```

### Detailed Escalation (Complex Issues)

```typescript
// For complex blockers requiring context
await linearTools.structured_escalation({
  issueId: issue.id,
  blockerType: 'technical',
  summary: 'CRM sync failing with authentication error',
  context: {
    attempted: [
      'Refreshed OAuth token - still fails',
      'Checked credentials in env - all present',
      'Tested with curl - same error'
    ],
    errorDetails: 'GoHighLevel API returning 401 Unauthorized...',
    filesInvolved: [
      'src/adapters/crm/gohighlevel.ts',
      'src/lib/auth.ts'
    ],
    hypothesis: 'OAuth token may be expired and refresh mechanism broken',
    suggestedNextSteps: [
      'Manually regenerate token in GHL dashboard',
      'Review OAuth refresh implementation'
    ]
  },
  urgency: 'high'
});
```

## Response to Resolution

When a blocker is resolved:

1. Read the resolution comment carefully
2. Understand the fix or decision made
3. Apply the solution to the current task
4. Add a confirmation comment
5. Continue with implementation

```typescript
// After human resolves blocker
await linearTools.add_comment({
  issueId: issue.id,
  body: '## Blocker Resolved\n\nApplied the solution from @human. Continuing with implementation...'
});
```

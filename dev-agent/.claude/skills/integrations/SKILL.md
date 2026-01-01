---
name: integrations
description: Linear, GitHub, and external API integration patterns
triggers: [linear, github, api, webhook, integration, sync, external]
priority: 3
alwaysLoad: false
---

# External Integrations

## Linear Integration

### Workflow States

Linear issues follow this workflow:

```
Todo -> In Progress -> In Review -> Done
```

State transitions:
- **Todo**: Assigned and ready to work
- **In Progress**: Agent is actively working
- **In Review**: PR created, awaiting human review
- **Done**: Merged and deployed

### Updating Issues

Always update Linear status when task state changes:

```typescript
// Move to In Progress when starting
await linearTools.update_issue_status({
  issueId: issue.id,
  status: 'in_progress'
});

// Add progress comments
await linearTools.add_comment({
  issueId: issue.id,
  body: '## Progress Update\n\nCompleted X, working on Y...'
});

// Complete task with PR
await linearTools.complete_task({
  issueId: issue.id,
  prUrl: 'https://github.com/...',
  prTitle: 'feat: add new feature',
  summary: 'Implemented X by doing Y'
});
```

### Issue Structure

Linear issues should contain:
- Clear title describing the work
- Description with acceptance criteria
- Priority (1 = Urgent, 4 = Low)
- Labels for categorization

### Escalation

When stuck, escalate properly:

```typescript
await linearTools.assign_to_human({
  issueId: issue.id,
  reason: 'Blocked on X. Tried approaches A, B, C. Need human decision on...'
});
```

## GitHub Integration

### Branch Naming

Format: `feature/{issue-id}-{description}`

Examples:
- `feature/gro-42-add-sms-reminder`
- `feature/gro-15-fix-crm-sync`
- `bugfix/gro-99-null-pointer`

### Commit Messages

Use conventional commits:

```
feat: add SMS reminder functionality
fix: handle null lead phone numbers
refactor: extract CRM sync logic
docs: update API documentation
test: add unit tests for lead processor
```

### Pull Requests

PR body template:

```markdown
## Summary
Brief description of changes

## Changes
- Added X
- Modified Y
- Fixed Z

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Linear Issue
Closes GRO-42
```

### Creating PRs

Use the consolidated `complete_feature` tool:

```typescript
await gitTools.complete_feature({
  issueId: 'GRO-42',
  branchDescription: 'add-sms-reminder',
  commitMessage: 'feat: add SMS reminder functionality for appointments',
  prTitle: 'feat: Add SMS reminder for appointments',
  prBody: '## Summary\n\nAdded automated SMS reminders...',
  baseBranch: 'main'
});
```

## External APIs

### Request Patterns

Always handle API errors gracefully:

```typescript
async function callExternalApi<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(`API call failed: ${response.status}`, {
      status: response.status,
      body: error
    });
  }

  return response.json();
}
```

### Rate Limiting

Implement exponential backoff for retries:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Webhook Security

Always verify webhook signatures:

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Environment Variables

Never hardcode API credentials:

```typescript
// Good - use environment variables
const apiKey = process.env.EXTERNAL_API_KEY;
if (!apiKey) {
  throw new Error('EXTERNAL_API_KEY not configured');
}

// Bad - hardcoded credentials
const apiKey = 'sk-1234567890';
```

## Context7 MCP for Documentation

When working with unfamiliar libraries, use Context7:

```typescript
// Resolve library ID first
const libraryId = await context7.resolve('linear-sdk');

// Then fetch docs for specific topic
const docs = await context7.getLibraryDocs({
  libraryId,
  topic: 'creating issues'
});
```

## Testing Integrations

Mock external services in tests:

```typescript
import { vi } from 'vitest';

// Mock Linear client
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    issue: vi.fn().mockResolvedValue(mockIssue),
    updateIssue: vi.fn().mockResolvedValue({ success: true })
  }))
}));

// Test with mocked client
it('should update issue status', async () => {
  const result = await updateIssueStatus('GRO-42', 'done');
  expect(result.success).toBe(true);
});
```

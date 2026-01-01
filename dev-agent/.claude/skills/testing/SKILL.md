---
name: testing
description: Testing patterns, test-driven development, coverage requirements
triggers: [test, testing, jest, vitest, coverage, tdd, spec]
priority: 4
alwaysLoad: false
---

# Testing Skill

Patterns for writing effective tests in the home-service-agent codebase.

## Testing Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests |
| Testing Library | React component tests |
| Playwright | E2E tests (dashboard) |
| MSW | API mocking |

## Test File Conventions

```
src/
├── agents/
│   ├── sdr.ts
│   └── sdr.test.ts       # Co-located unit tests
├── lib/
│   ├── orchestrator.ts
│   └── orchestrator.test.ts
└── __tests__/
    └── integration/      # Integration tests
        └── agent-flow.test.ts

web/
├── src/
│   └── components/
│       └── leads/
│           ├── LeadCard.tsx
│           └── LeadCard.test.tsx
└── e2e/
    └── dashboard.spec.ts  # Playwright E2E
```

## Unit Testing Patterns

### Basic Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processLead } from './sdr';

describe('SDR Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processLead', () => {
    it('qualifies lead with BANT complete', async () => {
      const lead = createMockLead({
        budget: '$5000+',
        authority: true,
        need: 'kitchen cabinets',
        timeline: '2 weeks'
      });

      const result = await processLead(lead);

      expect(result.temperature).toBe('hot');
      expect(result.status).toBe('qualified');
    });

    it('marks lead as cool when timeline > 6 months', async () => {
      const lead = createMockLead({ timeline: '1 year' });

      const result = await processLead(lead);

      expect(result.temperature).toBe('cool');
    });
  });
});
```

### Mocking External Services

```typescript
import { vi } from 'vitest';

// Mock Claude API
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
        stop_reason: 'end_turn'
      })
    }
  }))
}));

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }))
}));
```

### Testing Async Operations

```typescript
it('handles API timeout gracefully', async () => {
  vi.useFakeTimers();

  const promise = fetchWithTimeout('/api/slow', { timeout: 5000 });

  vi.advanceTimersByTime(6000);

  await expect(promise).rejects.toThrow('Timeout');

  vi.useRealTimers();
});
```

## Integration Testing

### Agent Flow Tests

```typescript
describe('Agent Flow', () => {
  it('routes new lead to SDR agent', async () => {
    const orchestrator = new Orchestrator(testConfig);

    const result = await orchestrator.handleMessage({
      platform: 'facebook',
      leadId: 'lead-123',
      message: 'I need kitchen cabinets'
    });

    expect(result.agent).toBe('sdr');
    expect(result.actions).toContainEqual({
      type: 'update_crm',
      status: 'contacted'
    });
  });

  it('hands off to followup agent after estimate', async () => {
    const orchestrator = new Orchestrator(testConfig);

    // Simulate estimate sent
    await updateLeadStatus('lead-123', 'estimate_sent');

    const result = await orchestrator.handleMessage({
      platform: 'sms',
      leadId: 'lead-123',
      message: 'Got your estimate, thinking about it'
    });

    expect(result.agent).toBe('followup');
  });
});
```

## React Component Testing

### Component Test Pattern

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadCard } from './LeadCard';

describe('LeadCard', () => {
  it('displays lead name and status', () => {
    render(<LeadCard lead={mockLead} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('calls onStatusChange when status clicked', async () => {
    const onStatusChange = vi.fn();
    render(<LeadCard lead={mockLead} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: /change status/i }));
    fireEvent.click(screen.getByText('Won'));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('lead-123', 'won');
    });
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useLeadPipeline } from './useLeadPipeline';

describe('useLeadPipeline', () => {
  it('fetches leads on mount', async () => {
    const { result } = renderHook(() => useLeadPipeline());

    await waitFor(() => {
      expect(result.current.leads).toHaveLength(5);
    });
  });

  it('updates optimistically on drag', async () => {
    const { result } = renderHook(() => useLeadPipeline());

    act(() => {
      result.current.moveLead('lead-1', 'qualified', 'appointment_scheduled');
    });

    expect(result.current.leads.find(l => l.id === 'lead-1')?.status)
      .toBe('appointment_scheduled');
  });
});
```

## E2E Testing (Playwright)

### Dashboard E2E

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/leads');
  });

  test('displays lead pipeline', async ({ page }) => {
    await expect(page.getByTestId('kanban-column-new')).toBeVisible();
    await expect(page.getByTestId('kanban-column-qualified')).toBeVisible();
  });

  test('can drag lead between columns', async ({ page }) => {
    const lead = page.getByTestId('lead-card-123');
    const targetColumn = page.getByTestId('kanban-column-qualified');

    await lead.dragTo(targetColumn);

    await expect(lead).toBeVisible();
    await expect(targetColumn).toContainText('John Smith');
  });
});
```

## Test Data Factories

### Factory Pattern

```typescript
// test/factories/lead.ts
import { faker } from '@faker-js/faker';

export function createMockLead(overrides?: Partial<Lead>): Lead {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    status: 'new',
    temperature: 'warm',
    source: 'facebook',
    createdAt: new Date(),
    ...overrides
  };
}

export function createMockConversation(leadId: string): Conversation {
  return {
    leadId,
    messages: [
      { role: 'user', content: 'I need help with cabinets' },
      { role: 'assistant', content: 'I can help with that!' }
    ],
    agent: 'sdr'
  };
}
```

## Coverage Requirements

| Type | Minimum |
|------|---------|
| Unit tests | 80% |
| Integration | Key flows |
| E2E | Critical paths |

### Running Tests

```bash
# Unit tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# E2E
npx playwright test
```

## Testing Checklist

Before shipping, verify:

- [ ] Unit tests for new functions
- [ ] Integration tests for new API routes
- [ ] Component tests for new React components
- [ ] E2E tests for new user flows
- [ ] Edge cases covered (empty states, errors)
- [ ] Async operations properly awaited
- [ ] Mocks cleaned up in beforeEach/afterEach

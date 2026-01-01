---
name: coding
description: TypeScript patterns, ESM modules, error handling, and code quality standards
triggers: [implement, code, function, class, module, typescript, type, interface, async, promise]
priority: 2
alwaysLoad: false
---

# TypeScript Coding Standards

## ESM Module Pattern

This codebase uses ES Modules. Always use `.js` extensions in imports:

```typescript
// Correct - ESM with .js extension
import { myFunction } from './utils.js';
import type { MyType } from './types.js';

// Wrong - will fail at runtime
import { myFunction } from './utils';
```

## Type Definitions

Prefer explicit types over inference for public APIs:

```typescript
// Correct - explicit return type
export function processLead(lead: Lead): ProcessedLead {
  return { ...lead, processed: true };
}

// Avoid - implicit return type
export function processLead(lead: Lead) {
  return { ...lead, processed: true };
}
```

Use `interface` for objects that may be extended, `type` for unions/primitives:

```typescript
// Interface for extensible objects
interface LeadData {
  id: string;
  name: string;
  email: string;
}

// Type for unions and literals
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
type ProcessResult = Success | Failure;
```

## Error Handling

Never swallow errors silently:

```typescript
// Wrong - silent failure
try {
  await riskyOperation();
} catch (error) {
  // Do nothing
}

// Correct - explicit handling
try {
  await riskyOperation();
} catch (error) {
  console.error('Failed to perform operation:', error);
  throw new OperationError('Operation failed', { cause: error });
}
```

Use typed errors for domain-specific failures:

```typescript
class CrmSyncError extends Error {
  constructor(
    message: string,
    public readonly leadId: string,
    public readonly operation: 'create' | 'update' | 'delete'
  ) {
    super(message);
    this.name = 'CrmSyncError';
  }
}

// Usage
throw new CrmSyncError('Failed to sync lead', lead.id, 'update');
```

## Async/Await Patterns

Always handle promise rejections:

```typescript
// Correct - with error handling
async function fetchLeads(): Promise<Lead[]> {
  try {
    const response = await fetch('/api/leads');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    throw error;
  }
}

// Parallel operations with Promise.all
const [leads, accounts] = await Promise.all([
  fetchLeads(),
  fetchAccounts()
]);

// Sequential with reduce (when order matters)
const results = await items.reduce(async (accPromise, item) => {
  const acc = await accPromise;
  const result = await processItem(item);
  return [...acc, result];
}, Promise.resolve([] as Result[]));
```

## Zod Validation

Use Zod for runtime validation at system boundaries:

```typescript
import { z } from 'zod';

// Define schema
const LeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'won', 'lost'])
});

// Infer type from schema
type Lead = z.infer<typeof LeadSchema>;

// Validate at boundaries
function processWebhook(body: unknown): Lead {
  return LeadSchema.parse(body); // Throws on invalid data
}

// Safe parsing with error handling
const result = LeadSchema.safeParse(body);
if (!result.success) {
  console.error('Validation failed:', result.error.flatten());
  throw new ValidationError('Invalid lead data');
}
```

## Function Design

Keep functions small and focused (< 30 lines ideally):

```typescript
// Good - single responsibility
async function sendReminderSms(lead: Lead, appointment: Appointment): Promise<void> {
  const message = formatReminderMessage(lead, appointment);
  await smsClient.send(lead.phone, message);
  await logReminderSent(lead.id, appointment.id);
}

// Bad - doing too much
async function handleAppointment(lead: Lead, appointment: Appointment): Promise<void> {
  // 100+ lines of mixed concerns...
}
```

## JSDoc Comments

Add JSDoc for public APIs:

```typescript
/**
 * Qualifies a lead based on BANT criteria.
 *
 * @param lead - The lead to qualify
 * @param responses - BANT question responses
 * @returns Qualification result with score and temperature
 * @throws {ValidationError} If lead data is invalid
 *
 * @example
 * ```typescript
 * const result = qualifyLead(lead, {
 *   budget: 'under_5k',
 *   authority: 'decision_maker',
 *   need: 'kitchen_remodel',
 *   timeline: '1_3_months'
 * });
 * ```
 */
export function qualifyLead(
  lead: Lead,
  responses: BANTResponses
): QualificationResult {
  // Implementation
}
```

## Code Organization

Follow the project's adapter pattern:

```typescript
// Base adapter interface
interface CrmAdapter {
  createLead(data: LeadData): Promise<Lead>;
  updateLead(id: string, data: Partial<LeadData>): Promise<Lead>;
  getLead(id: string): Promise<Lead | null>;
}

// Concrete implementation
class GoHighLevelAdapter implements CrmAdapter {
  private client: GoHighLevelClient;

  constructor(config: GHLConfig) {
    this.client = new GoHighLevelClient(config);
  }

  async createLead(data: LeadData): Promise<Lead> {
    const ghlLead = await this.client.contacts.create(this.mapToGHL(data));
    return this.mapFromGHL(ghlLead);
  }

  // ... other methods
}
```

## Testing Patterns

Write testable code with dependency injection:

```typescript
// Testable - dependencies injected
class LeadProcessor {
  constructor(
    private crmAdapter: CrmAdapter,
    private smsClient: SmsClient
  ) {}

  async process(lead: Lead): Promise<void> {
    await this.crmAdapter.updateLead(lead.id, { status: 'processed' });
    await this.smsClient.send(lead.phone, 'Your request has been received');
  }
}

// In tests
const mockCrm = { updateLead: vi.fn() };
const mockSms = { send: vi.fn() };
const processor = new LeadProcessor(mockCrm, mockSms);
```

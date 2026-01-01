---
name: security
description: Security patterns, OWASP prevention, TCPA compliance, input validation
triggers: [security, auth, validation, sanitize, xss, injection, tcpa, compliance]
priority: 3
alwaysLoad: false
---

# Security Skill

Security patterns and compliance requirements for the home-service-agent system.

## Core Security Principles

1. **Defense in depth** - Multiple layers of protection
2. **Least privilege** - Minimum access required
3. **Fail secure** - Deny by default
4. **Validate at boundaries** - Never trust external input

## OWASP Top 10 Prevention

### 1. Injection Prevention

```typescript
// SQL Injection - ALWAYS use parameterized queries
// BAD
const query = `SELECT * FROM leads WHERE id = '${leadId}'`;

// GOOD
const query = 'SELECT * FROM leads WHERE id = $1';
const result = await db.query(query, [leadId]);

// Command Injection - NEVER interpolate user input
// BAD
exec(`ls ${userInput}`);

// GOOD
import { execFile } from 'child_process';
execFile('ls', [sanitizedPath]);
```

### 2. XSS Prevention

```typescript
// React auto-escapes, but watch for:
// BAD - dangerouslySetInnerHTML with user content
<div dangerouslySetInnerHTML={{ __html: userMessage }} />

// GOOD - use text content or sanitize
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userMessage) }} />

// Or just use text
<div>{userMessage}</div>
```

### 3. Authentication

```typescript
// Password hashing - use bcrypt or argon2
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);
const valid = await bcrypt.compare(password, hash);

// Session tokens - cryptographically random
import { randomBytes } from 'crypto';
const sessionToken = randomBytes(32).toString('hex');
```

### 4. Authorization

```typescript
// Always verify ownership
async function getLeadById(leadId: string, businessId: string) {
  const lead = await db.leads.findFirst({
    where: {
      id: leadId,
      businessId: businessId  // Ensure business owns this lead
    }
  });

  if (!lead) throw new AuthorizationError('Lead not found');
  return lead;
}
```

### 5. Sensitive Data Exposure

```typescript
// Never log sensitive data
// BAD
console.log('User login:', { email, password, apiKey });

// GOOD
console.log('User login:', { email, passwordProvided: !!password });

// Never return sensitive fields
const safeUser = {
  id: user.id,
  email: user.email,
  // password: user.password  <- NEVER
};
```

## Input Validation

### Zod Schema Patterns

```typescript
import { z } from 'zod';

// Lead input validation
const LeadInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),  // E.164 format
  message: z.string().max(2000).optional(),
  source: z.enum(['web', 'facebook', 'referral']),
});

// Validate at API boundary
app.post('/api/:business/lead', async (req, res) => {
  const result = LeadInputSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten()
    });
  }

  // result.data is now type-safe
  await processLead(result.data);
});
```

### Sanitization

```typescript
// HTML sanitization for rich text
import DOMPurify from 'dompurify';

const cleanHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href']
});

// Path traversal prevention
import path from 'path';

function getFilePath(userFilename: string): string {
  const safeName = path.basename(userFilename);  // Remove path components
  return path.join(UPLOADS_DIR, safeName);
}
```

## TCPA Compliance

### Requirements

| Rule | Implementation |
|------|----------------|
| **Explicit consent** | `textingConsent: true` on lead record |
| **Quiet hours** | No texts 8pm-8am local time |
| **Rate limiting** | Max 3 texts per lead per day |
| **Opt-out** | Honor STOP, UNSUBSCRIBE immediately |

### Implementation

```typescript
// Check consent before texting
async function sendSms(leadId: string, message: string) {
  const lead = await getLead(leadId);

  // 1. Check explicit consent
  if (!lead.textingConsent) {
    throw new ComplianceError('No texting consent');
  }

  // 2. Check quiet hours (8pm-8am local)
  const localHour = getLocalHour(lead.timezone);
  if (localHour < 8 || localHour >= 20) {
    throw new ComplianceError('Quiet hours - scheduling for later');
  }

  // 3. Check rate limit
  const todayCount = await getTextCountToday(leadId);
  if (todayCount >= 3) {
    throw new ComplianceError('Rate limit exceeded');
  }

  // 4. Send and log
  await smsProvider.send(lead.phone, message);
  await logSmsEvent(leadId, message);
}

// Handle opt-out keywords
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];

function isOptOut(message: string): boolean {
  return OPT_OUT_KEYWORDS.includes(message.toLowerCase().trim());
}

async function handleInboundSms(from: string, message: string) {
  if (isOptOut(message)) {
    await updateLeadConsent(from, { textingConsent: false });
    await sendSms(from, 'You have been unsubscribed. Reply START to re-subscribe.');
    return;
  }
  // Process normal message
}
```

## API Security

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: { error: 'Too many requests' }
});

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 failed attempts
  message: { error: 'Too many login attempts' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);
```

### Webhook Security

```typescript
import crypto from 'crypto';

// Verify webhook signatures
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Use in webhook handler
app.post('/api/webhook/facebook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);

  if (!verifyWebhookSignature(payload, signature, FB_APP_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook...
});
```

### CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: [
    'https://app.orangeblossomcabinets.com',
    'https://dashboard.orangeblossomcabinets.com'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400  // 24 hours
};

app.use(cors(corsOptions));
```

## Environment Variables

```typescript
// NEVER hardcode secrets
// BAD
const apiKey = 'sk-ant-xxx';

// GOOD
const apiKey = process.env.ANTHROPIC_API_KEY;

// Validate required env vars at startup
const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  'SESSION_SECRET'
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

## Error Handling

```typescript
// Never expose internal errors
// BAD
catch (error) {
  res.status(500).json({ error: error.message, stack: error.stack });
}

// GOOD
catch (error) {
  console.error('Internal error:', error);
  res.status(500).json({ error: 'An unexpected error occurred' });
}

// Custom error classes
class AuthorizationError extends Error {
  statusCode = 403;
}

class ValidationError extends Error {
  statusCode = 400;
}

// Error handler middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({ error: message });
});
```

## Security Checklist

Before every PR, verify:

- [ ] **No command injection** - User input never in shell commands
- [ ] **No XSS** - User input escaped or sanitized
- [ ] **No SQL injection** - Parameterized queries only
- [ ] **No hardcoded secrets** - Environment variables
- [ ] **Input validation** - Zod schemas at boundaries
- [ ] **Proper error handling** - No sensitive data in errors
- [ ] **Rate limiting** - On public endpoints
- [ ] **TCPA compliance** - Explicit consent, quiet hours, rate limits
- [ ] **Authorization checks** - Verify ownership/permissions
- [ ] **Webhook verification** - Signature validation

## Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

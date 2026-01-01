# Security Checklist for Vibe Coding

> **Warning:** Research shows only 10.5% of AI-generated code is secure.
> This checklist is **mandatory** for every PR.

---

## Pre-Commit Checklist

### Secrets & Credentials
- [ ] No API keys in code (use `process.env.*`)
- [ ] No passwords or tokens in code
- [ ] `.env` files are in `.gitignore`
- [ ] No secrets in commit messages
- [ ] No credentials in error messages or logs

### Input Validation
- [ ] All user input is validated before use
- [ ] Phone numbers validated with regex
- [ ] Email addresses validated
- [ ] URLs validated before fetching
- [ ] JSON parsed with try/catch

### SQL Injection Prevention
- [ ] Using parameterized queries (never string concatenation)
- [ ] ORM used for database operations
- [ ] No raw SQL with user input

### XSS Prevention
- [ ] HTML output is escaped
- [ ] User content not rendered as HTML
- [ ] React uses proper JSX escaping

### Authentication & Authorization
- [ ] Endpoints check authentication
- [ ] User can only access their own data
- [ ] Admin routes have role checks
- [ ] Session tokens are httpOnly cookies

---

## TCPA Compliance (SMS/Texting)

### Required for Every Text Message
- [ ] Lead has `textingConsent: true` in database
- [ ] Consent was explicitly given (not assumed)
- [ ] Opt-out mechanism in every message
- [ ] "Reply STOP to unsubscribe" included

### Quiet Hours
- [ ] No texts before 8:00 AM local time
- [ ] No texts after 8:00 PM local time
- [ ] Timezone detected from phone number

### Rate Limiting
- [ ] Max 3 texts per lead per day
- [ ] Max 10 texts per lead per week
- [ ] Exponential backoff on retries

### Record Keeping
- [ ] All messages logged with timestamp
- [ ] Consent timestamp recorded
- [ ] Opt-out requests processed immediately
- [ ] Records retained for 4 years

---

## API Security

### Rate Limiting
- [ ] Rate limiting on all public endpoints
- [ ] Per-IP and per-user limits
- [ ] 429 response with Retry-After header

### Webhook Validation
- [ ] Facebook webhooks verify signature
- [ ] Twilio webhooks verify X-Twilio-Signature
- [ ] Unknown webhooks rejected

### Error Handling
- [ ] No stack traces in production responses
- [ ] Generic error messages to users
- [ ] Detailed errors only in logs
- [ ] PII stripped from error logs

---

## Data Protection

### PII Handling
- [ ] No PII in logs (names, phones, emails)
- [ ] PII encrypted at rest
- [ ] PII not sent to external services unnecessarily
- [ ] Data deletion on user request

### Database
- [ ] Connections use SSL
- [ ] Passwords hashed with bcrypt
- [ ] Sensitive fields encrypted

### Backups
- [ ] Backups encrypted
- [ ] Backup access logged
- [ ] Regular backup testing

---

## Infrastructure

### Environment
- [ ] Production uses HTTPS only
- [ ] HSTS headers enabled
- [ ] CSP headers configured
- [ ] CORS properly restricted

### Monitoring
- [ ] Security events logged
- [ ] Failed login attempts tracked
- [ ] Unusual activity alerts

### Dependencies
- [ ] No known vulnerabilities (`npm audit`)
- [ ] Dependencies up to date
- [ ] Lock file committed

---

## Code Review Checklist

Before approving a PR, verify:

1. **Secrets:** No hardcoded credentials
2. **Validation:** All inputs validated
3. **Auth:** Proper access controls
4. **Injection:** Parameterized queries only
5. **Logging:** No PII in logs
6. **TCPA:** Texting consent verified

---

## Incident Response

If a security issue is found:

1. **Contain:** Disable affected feature
2. **Document:** Record what happened
3. **Fix:** Patch the vulnerability
4. **Notify:** Alert affected users if required
5. **Review:** Update this checklist

---

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [TCPA Compliance Guide](https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts)
- [arXiv: Is Vibe Coding Safe?](https://arxiv.org/abs/2512.03262)

---

*This checklist must be reviewed before every merge to main.*

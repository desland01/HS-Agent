# Agent Instructions

This project uses **Linear** for work tracking. The autonomous dev-agent (`dev-agent/`) processes tasks automatically.

---

## Session Start

1. **Check Linear Queue** (https://linear.app/grovestreetpainting)
   - "Up Next" view - Prioritized tasks
   - "Active Work" view - In progress items
   - "Blocked" view - Items needing human input

2. **Read Context**
   - `docs/PRD.md` - Product requirements and MVP definition
   - `docs/SECURITY.md` - Security checklist (mandatory for PRs)
   - `CLAUDE.md` - Codebase architecture

---

## Dev-Agent (Autonomous)

The dev-agent runs continuously and processes Linear tasks:
- Polls "Up Next" view for new work
- Explores codebase, implements features, runs tests
- Creates PRs and moves issues to "In Review"
- Escalates to human after 3 failed attempts

**Location:** `dev-agent/src/agent.ts`

---

## During Work

### Before Writing Code

- [ ] Read the relevant files first (never modify code you haven't read)
- [ ] Check `docs/PRD.md` for acceptance criteria
- [ ] Understand existing patterns in `CLAUDE.md`

### While Writing Code

- [ ] Follow `docs/SECURITY.md` checklist
- [ ] No API keys in code (use `process.env.*`)
- [ ] Validate all user input
- [ ] Use parameterized queries for database
- [ ] TCPA compliance for any texting features

### Commit Guidelines

- Feature branches: `feature/{issue-id}-{description}`
- Clear, conventional commit messages
- One logical change per commit
- Run `npm run typecheck && npm run build` before committing

---

## Session Completion

**When ending a work session**, complete ALL steps below.

**MANDATORY WORKFLOW:**

1. **Run quality gates** (if code changed):
   ```bash
   npm run typecheck
   npm run build
   ```
2. **Commit and push**:
   ```bash
   git add -A
   git commit -m "feat: description"
   git push
   git status  # MUST show "up to date with origin"
   ```
3. **Update Linear** - Move issue to appropriate state, add PR link if applicable

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- If push fails, resolve and retry until it succeeds

---

## Error Handling

### If Build Fails
1. Read the error message carefully
2. Fix the issue
3. Run typecheck and build again
4. Do NOT commit broken code

### If Blocked
1. Add "blocked" label to Linear issue
2. Add clear comment explaining the blocker
3. Move to next available task
4. Do NOT spin on a problem for more than 3 attempts

---

## Security Checklist (Summary)

Before every PR, verify:

- [ ] No hardcoded credentials or API keys
- [ ] All user input validated
- [ ] Parameterized queries only (no SQL injection)
- [ ] Output escaped (no XSS)
- [ ] No PII in logs
- [ ] TCPA compliance if texting (consent, opt-out, quiet hours)

Full checklist: `docs/SECURITY.md`

---

## Key Commands

```bash
# Development
npm run dev            # Run with hot reload
npm run typecheck      # Type check
npm run build          # Build for production

# Git
git checkout -b feature/{issue}-{desc}
git add -A && git commit -m "feat: description"
gh pr create --title "Title" --body "Description"
```

---

*This file is read by coding agents at session start. Keep it concise and actionable.*

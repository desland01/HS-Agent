# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

---

## Session Start

1. **Load Memory**
   ```bash
   bd quickstart
   ```

2. **Check Linear Queue**
   - "Up Next" view - Prioritized tasks
   - "Blocked" view - Items needing human input

3. **Read Context**
   - `docs/PRD.md` - Product requirements and MVP definition
   - `docs/SECURITY.md` - Security checklist (mandatory for PRs)
   - `CLAUDE.md` - Codebase architecture

---

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

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

## Landing the Plane (Session Completion)

**When ending a work session**, complete ALL steps below.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed):
   ```bash
   npm run typecheck
   npm run build
   ```
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Update Linear** - Move issue to appropriate state, add PR link if applicable
6. **Hand off** - Provide context for next session

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

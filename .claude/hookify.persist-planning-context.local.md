---
name: persist-planning-context
enabled: true
event: stop
pattern: .*
action: warn
---

# Context Preservation Check

Before stopping, verify planning context is preserved:

## Crash Protection Checklist

- [ ] **Plans saved to beads**: Did you run `bd create` for significant work items?
- [ ] **Decision rationale documented**: Are key decisions captured in docs or comments?
- [ ] **Progress tracked**: Is the todo list or beads updated with current status?

## Context for Future Agents

- [ ] **CLAUDE.md updated** if architecture changed
- [ ] **Beads sync'd**: Run `bd sync` to push work tracking
- [ ] **Commit staged work**: Even partial progress should be git staged

## If IDE Crashed Before Code Execution

Your planning context is safe if you:
1. Used TodoWrite to track the plan
2. Created beads for multi-session work
3. Wrote decisions to docs before coding

**Reminder**: Plans in your head are lost on crash. Plans in files survive.

If you haven't persisted context yet, do it now before stopping.

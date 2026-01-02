---
name: save-plans-first
enabled: false
event: prompt
pattern: (plan|implement|build|create|add feature|refactor|migrate)
action: warn
---

# Planning Context Protection

Detected a planning/implementation request. Before diving into code:

## Crash-Proof Your Work

1. **Use TodoWrite immediately** - Break down the plan into tracked items
2. **Create beads for significant work** - `bd create --title="..." --type=task`
3. **Document decisions first** - Write the approach before coding

## Why This Matters

If the IDE crashes or context is cleared:
- Plans in your head = **LOST**
- TodoWrite items = **Visible in session**
- Beads = **Persisted across sessions**
- Docs/comments = **Permanent record**

## Quick Save Workflow

```
1. TodoWrite: Break down tasks
2. bd create: For multi-session work
3. THEN start coding
```

The 30 seconds spent saving context can save hours of re-planning.

**Proceed with implementation, but save your plan first!**

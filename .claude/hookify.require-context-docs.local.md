---
name: require-context-docs
enabled: false
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/.*\.(ts|js|tsx|jsx)$
action: warn
---

# Context Documentation Reminder

You're modifying source code. Future agents need context!

## Quick Context Checklist

When making significant changes:

1. **Why this approach?**
   - Add a brief comment explaining non-obvious decisions
   - Link to relevant docs/issues if applicable

2. **What's the bigger picture?**
   - Is this part of a larger feature? Note it in beads (`bd create`)
   - Update CLAUDE.md if architecture patterns change

3. **What should the next agent know?**
   - Edge cases discovered
   - Related files that may need updating
   - Dependencies or prerequisites

## Vibe Code Context Rules

- **Code should be self-documenting** - but decisions aren't obvious from code
- **Beads for work tracking** - `bd ready` shows available work
- **CLAUDE.md for patterns** - not every file, just the important stuff
- **Keep it lightweight** - a one-liner beats a paragraph

If this is a minor fix, proceed. For features/refactors, ensure context is preserved.

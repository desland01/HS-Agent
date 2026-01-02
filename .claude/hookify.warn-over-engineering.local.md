---
name: warn-over-engineering
enabled: true
event: file
pattern: (abstract\s+class|interface\s+\w+Strategy|Factory\s*[<{]|implements\s+\w+Handler|createFactory|AbstractBase|GenericProvider)
action: warn
---

# Vibe Check: Over-Engineering Alert

You're adding abstraction patterns that may be premature:
- Abstract classes, Strategy patterns, Factories, Handlers

**Vibe code principles:**
- Keep it simple - write code that works first
- Don't add abstractions until you have 3+ concrete cases
- Prefer composition over inheritance
- A direct function is better than a wrapped one

**Ask yourself:**
1. Is this solving a real problem I have NOW?
2. Will this make the code harder to understand?
3. Can I achieve this with a simple function instead?

If this abstraction is truly needed, proceed. Otherwise, simplify.

---
name: warn-premature-abstraction
enabled: true
event: file
pattern: (\/\/\s*TODO:?\s*(refactor|extract|abstract|generalize|DRY)|util(s|ity|ities)?\.ts|helper(s)?\.ts|common\.ts|shared\.ts)
action: warn
---

# Vibe Check: Premature Abstraction Warning

You may be creating premature abstractions:
- Utility/helper files for one-time use
- TODO comments planning future abstractions
- "Common" or "shared" modules before sharing is needed

## The Rule of Three

**Don't abstract until you have 3 concrete cases:**

1. First time: Just write the code
2. Second time: Copy-paste is OK, note the duplication
3. Third time: NOW consider abstracting

## Vibe Code Principles

- **Duplication is cheaper than wrong abstraction**
- **Delete code > abstract code**
- **Inline functions > utility files for single use**
- **Let patterns emerge, don't force them**

## Common Anti-Patterns

- `utils.ts` with one function
- `helpers/` folder with single-use wrappers
- `common/` for code used in exactly 2 places
- Abstract base classes with one implementation

**If you truly have 3+ uses, proceed. Otherwise, keep it simple!**

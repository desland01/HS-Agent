# Dev Agent Context

This file provides context to Claude when working on this codebase.

## Project Overview

This is an autonomous development agent built with the Claude Agent SDK that:
- Runs 24/7 on Railway
- Pulls tasks from Linear
- Implements code changes autonomously
- Creates PRs for human review
- Escalates after 3 failed attempts

## Architecture

### Multi-Agent System

The agent uses specialized subagents for different tasks:

| Subagent | Purpose | Model |
|----------|---------|-------|
| `code-explorer` | Understands codebase before changes | haiku |
| `implementer` | Writes code changes | sonnet |
| `tester` | Runs tests and builds | haiku |
| `git-ops` | Handles git operations | haiku |
| `linear-ops` | Updates Linear issues | haiku |

### MCP Servers

Custom MCP servers provide tools for:
- **linear**: Issue management (7 tools)
- **git**: Version control (10 tools)  
- **bash**: Command execution (5 tools)

### Key Files

```
dev-agent/
├── src/
│   ├── agent.ts      # Main agent loop with multi-agent architecture
│   ├── index.ts      # Entry point with env validation
│   └── tools/
│       ├── linear.ts # Linear API tools
│       ├── git.ts    # Git operations
│       └── bash.ts   # Command execution
├── Dockerfile        # Railway container
├── railway.toml      # Railway config
└── scripts/
    ├── entrypoint.sh # Container startup
    └── setup-repo.sh # Repo cloning
```

## Development Workflow

When implementing a Linear task, follow this workflow:

1. **Update Linear** - Move to "In Progress", add comment
2. **Explore** - Use code-explorer to understand context
3. **Plan** - Think through the approach
4. **Implement** - Write clean TypeScript code
5. **Test** - Run `npm run typecheck` and `npm run build`
6. **Commit** - Feature branch, clear commit message
7. **PR** - Create via gh CLI
8. **Update Linear** - Move to "In Review", link PR

## Code Standards

- TypeScript with strict typing
- Follow existing patterns in the codebase
- JSDoc comments for public APIs
- Small, focused functions
- Handle edge cases

## Git Workflow

- Never commit directly to main
- Branch naming: `feature/{issue-id}-{description}`
- Clear, conventional commit messages
- One logical change per commit

## Environment Variables

Required on Railway:
- `ANTHROPIC_API_KEY` - Claude API
- `LINEAR_API_KEY` - Linear API
- `GITHUB_TOKEN` - GitHub PAT for PRs
- `GITHUB_REPO_URL` - Repository to clone

## Error Handling

- Retry up to 3 times on failure
- Escalate to human after max retries
- Never force push or delete without approval
- Log detailed error information

## Testing Changes

Before committing:
```bash
npm run typecheck  # Check types
npm run build      # Verify build
npm test           # Run tests if they exist
```

## Linear Integration

Workflow states: Todo → In Progress → In Review → Done

Update Linear with:
- Progress comments
- Blocker notifications
- PR links
- Completion status

## Links

- Linear: https://linear.app/grovestreetpainting
- GitHub: https://github.com/desland01/HS-Agent
- Railway: https://railway.com/project/7404c238-9b52-4ef2-95f7-362dfa2b1ff8

# PM Agent

Local Project Management Agent powered by Claude.

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export ANTHROPIC_API_KEY=your-key
export LINEAR_API_KEY=your-linear-key

# Run the agent
npm run dev
```

## Architecture

```
pm-agent/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── agent.ts          # Main PM agent with sub-agent orchestration
│   ├── skills/           # Skill loader with progressive disclosure
│   └── tools/            # Linear API tools
├── skills/               # Skill definitions (SKILL.md files)
├── agents/               # Sub-agent system prompts
└── CLAUDE.md             # This file
```

## Progressive Disclosure

Skills are loaded in three levels:

1. **Level 1**: Name + description (always in system prompt)
2. **Level 2**: Full SKILL.md content (loaded via `load_skill` tool)
3. **Level 3**: Reference files (loaded with `includeReferences: true`)

## Sub-Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| planning | Opus | Complex feature breakdown |
| design-review | Sonnet | UI/UX feedback |
| qa | Sonnet | Security and quality |
| linear-coordinator | Haiku | Quick status updates |

## Available Skills

- **project-context**: PRD, architecture, business rules
- **planning**: Feature breakdown, Linear issues
- **design-system**: UI/UX standards
- **linear-workflow**: Issue templates, priorities
- **agent-patterns**: SDK patterns, skill authoring

## Linear Integration

The agent can:
- Create and update issues
- Search and list issues
- Manage projects and teams
- Track work through views

## CLI Commands

- `/clear` - Reset conversation
- `/help` - Show help
- `/skills` - List skills
- `/agents` - List sub-agents
- `/quit` - Exit

## Development

```bash
npm run dev        # Run with hot reload
npm run typecheck  # Check types
npm run build      # Build for production
```

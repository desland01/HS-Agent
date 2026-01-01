# PM Agent

Local Project Management Agent powered by Claude with Claude Code-like CLI experience.

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables (API key optional with Claude Max subscription)
export ANTHROPIC_API_KEY=your-key  # Optional with Max subscription
export LINEAR_API_KEY=your-linear-key  # Optional

# Run the agent
npm run dev
```

## Features

- **Streaming responses** - Real-time output as Claude thinks
- **File operations** - Read, search, and explore local files
- **Linear integration** - Create/update issues, track progress
- **Sub-agent delegation** - Specialized agents for complex tasks
- **Tool feedback** - Visual indicators for tool use

## Architecture

```
pm-agent/
├── src/
│   ├── index.ts          # Claude Code-like CLI with streaming
│   ├── agent.ts          # Main PM agent with sub-agent orchestration
│   ├── skills/           # Skill loader with progressive disclosure
│   └── tools/
│       ├── index.ts      # Tool registry
│       ├── files.ts      # File operations (read, glob, grep)
│       └── linear.ts     # Linear API tools
├── .claude/
│   ├── skills/           # Skill definitions (SKILL.md files)
│   └── agents/           # Sub-agent system prompts
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

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/help` | Show help and examples |
| `/tools` | List available tools |
| `/skills` | List available skills |
| `/agents` | List sub-agents |
| `/cwd` | Show working directory |
| `/quit` | Exit the agent |

## File Tools

The agent can read and search files in the working directory:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with line numbers |
| `list_directory` | List directory contents (supports recursion) |
| `glob_files` | Find files matching pattern (e.g., `**/*.ts`) |
| `grep_content` | Search for pattern in files |
| `get_file_info` | Get file metadata |

Example prompts:
- "Show me the contents of package.json"
- "Find all TypeScript files in src/"
- "Search for TODO comments"
- "What files are in this directory?"

## Development

```bash
npm run dev        # Run with hot reload
npm run typecheck  # Check types
npm run build      # Build for production
```

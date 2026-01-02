/**
 * PM Agent with Sub-Agent Orchestration
 * Built with Claude Agent SDK for proper tool handling and streaming
 */

import { query, type Options, type SDKMessage, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlock, TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLinearMcpServer } from './tools/linear-mcp.js';
import { formatMemoryForPrompt } from './memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// SDK standard location: .claude/agents/
const AGENTS_DIR = join(__dirname, '../.claude/agents');
const SKILLS_DIR = join(__dirname, '../.claude/skills');

/**
 * Load project context from skill file
 */
function loadProjectContext(): string {
  const skillPath = join(SKILLS_DIR, 'project-context/SKILL.md');
  if (!existsSync(skillPath)) {
    return '';
  }

  try {
    const content = readFileSync(skillPath, 'utf-8');
    // Remove YAML frontmatter
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/m, '');
    return `\n\n${withoutFrontmatter}`;
  } catch {
    return '';
  }
}

// Model configurations for different agent types
export const MODELS = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-3-5-haiku-20241022',
} as const;

export type ModelType = keyof typeof MODELS;

interface SubAgentConfig {
  name: string;
  model: 'opus' | 'sonnet' | 'haiku';
  systemPromptPath: string;
  description: string;
  tools: string[];
}

const SUB_AGENTS: SubAgentConfig[] = [
  {
    name: 'planning',
    model: 'opus',
    systemPromptPath: 'planning-agent.md',
    description: 'Breaks down features into Linear issues with estimates. Use for complex feature planning and sprint organization.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__linear__linear_create_issue', 'mcp__linear__linear_list_issues'],
  },
  {
    name: 'design-review',
    model: 'sonnet',
    systemPromptPath: 'design-review-agent.md',
    description: 'Reviews UI/UX decisions and provides feedback on design consistency and accessibility.',
    tools: ['Read', 'Glob', 'Grep'],
  },
  {
    name: 'qa',
    model: 'sonnet',
    systemPromptPath: 'qa-agent.md',
    description: 'Reviews security, test coverage, and code quality. Use for security audits and QA reviews.',
    tools: ['Read', 'Glob', 'Grep', 'Bash'],
  },
  {
    name: 'linear-coordinator',
    model: 'haiku',
    systemPromptPath: 'linear-coordinator.md',
    description: 'Tracks progress and updates Linear issues. Use for quick status checks and issue updates.',
    tools: ['mcp__linear__linear_list_issues', 'mcp__linear__linear_update_issue', 'mcp__linear__linear_get_view_issues'],
  },
];

function getSubAgentSystemPrompt(agentName: string): string | null {
  const config = SUB_AGENTS.find(a => a.name === agentName);
  if (!config) return null;

  const promptPath = join(AGENTS_DIR, config.systemPromptPath);
  if (!existsSync(promptPath)) {
    return null;
  }

  return readFileSync(promptPath, 'utf-8');
}

function buildSystemPrompt(): string {
  return `# PM Agent

You are an expert Project Manager for software development. You think strategically, anticipate blockers, and drive projects to completion. You don't just respond to requests—you proactively surface risks, suggest next steps, and keep work moving.

## Core Mindset

**Think like a PM, not an assistant.** Before responding, ask yourself:
1. What's the user really trying to accomplish?
2. What could block or delay this?
3. What should happen next, even if they didn't ask?
4. Who else needs to be involved?

## Decision Framework

Use this decision tree for every request:

\`\`\`
REQUEST RECEIVED
     │
     ├─ Is it a new feature/complex breakdown?
     │  └─ YES → Delegate to **planning** agent (Opus)
     │
     ├─ Is it a quick status check or issue update?
     │  └─ YES → Delegate to **linear-coordinator** (Haiku)
     │
     ├─ Does it involve UI/UX decisions?
     │  └─ YES → Delegate to **design-review** agent
     │
     ├─ Does it involve security, testing, or code quality?
     │  └─ YES → Delegate to **qa** agent
     │
     └─ Simple question or direct action?
        └─ Handle directly (don't over-delegate)
\`\`\`

## Sub-Agent Delegation

| Agent | Use When | Model | Typical Tasks |
|-------|----------|-------|---------------|
| **planning** | Breaking down features, creating issue sets, estimating | Opus | Feature breakdown, sprint planning, dependency mapping |
| **design-review** | UI changes, UX decisions, accessibility | Sonnet | Review mockups, check consistency, accessibility audit |
| **qa** | Before shipping, security concerns, test gaps | Sonnet | Security review, test coverage, code quality |
| **linear-coordinator** | Quick checks, updates, status reports | Haiku | "What's blocked?", "Update issue X", progress summaries |

## PM Workflow Patterns

### Pattern 1: Feature Request → Implementation
\`\`\`
1. Clarify scope → Ask: "What's in/out of scope?"
2. Delegate to planning → Get issue breakdown
3. Review with user → Adjust estimates/priorities
4. Create Linear issues → (after user approval)
5. Set up tracking → Schedule check-ins
\`\`\`

### Pattern 2: Progress Check
\`\`\`
1. Delegate to linear-coordinator → Get current state
2. Identify blockers → Flag items stuck >2 days
3. Surface risks → "X is behind, here's the impact"
4. Suggest actions → Concrete next steps
\`\`\`

### Pattern 3: Review Coordination
\`\`\`
1. Determine review type → Design? Security? Quality?
2. Delegate to appropriate agent → design-review or qa
3. Summarize findings → Group by severity
4. Create follow-up issues → If needed
\`\`\`

## Proactive Behaviors

**Always do these without being asked:**

1. **Surface blockers**: If anything is blocked >2 days, mention it
2. **Flag scope creep**: If a request seems bigger than it sounds, say so
3. **Suggest sequencing**: "Before X, we should do Y because..."
4. **Identify dependencies**: "This depends on Z—is that done?"
5. **Estimate impact**: "If we add this, it delays the release by..."

## Response Structure

For substantial responses, use this format:

\`\`\`
## Summary
[1-2 sentence answer to the immediate question]

## Details
[Relevant information, organized logically]

## Next Steps
[Concrete actions, who does what]

## Risks/Blockers (if any)
[Things that could go wrong, already blocked]
\`\`\`

For quick responses, skip the structure—be conversational.

## Constitutional Principles

Before finalizing any response, verify:
- [ ] Did I answer the actual question, not just related info?
- [ ] If I delegated, was it the right agent?
- [ ] Did I surface any blockers or risks I noticed?
- [ ] Did I provide concrete next steps?
- [ ] If creating issues, did I get user approval first?

## What NOT to Do

- **Don't create issues without approval** (present plan first)
- **Don't over-delegate simple questions** (answer directly)
- **Don't ignore context from earlier in conversation**
- **Don't give vague answers** ("it depends" → give options instead)
- **Don't wait to be asked about blockers** (surface them proactively)${loadProjectContext()}${formatMemoryForPrompt()}`;
}

function buildAgentsConfig(): Record<string, AgentDefinition> {
  const agents: Record<string, AgentDefinition> = {};

  for (const config of SUB_AGENTS) {
    const systemPrompt = getSubAgentSystemPrompt(config.name);
    if (systemPrompt) {
      agents[config.name] = {
        description: config.description,
        prompt: systemPrompt,
        tools: config.tools,
        model: config.model,
      };
    }
  }

  return agents;
}

// Working directory for file operations
let workingDirectory = process.cwd();

export function setWorkingDirectory(dir: string): void {
  workingDirectory = dir;
}

export function getWorkingDirectory(): string {
  return workingDirectory;
}

/**
 * Message types emitted during streaming
 */
export type PMAgentMessage =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_end'; toolName: string; result: string }
  | { type: 'thinking'; status: string }
  | { type: 'subagent_start'; agentName: string }
  | { type: 'subagent_end'; agentName: string }
  | { type: 'error'; error: string }
  | { type: 'session'; sessionId: string };

/**
 * Extract text content from SDK message content blocks
 */
function extractTextFromContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

/**
 * Streaming PM Agent using Claude Agent SDK
 */
export async function* streamPMAgent(
  userMessage: string,
  sessionId?: string
): AsyncGenerator<PMAgentMessage, string, undefined> {
  // Create Linear MCP server
  const linearServer = createLinearMcpServer();

  // Build query options
  const options: Options = {
    model: MODELS.sonnet,
    cwd: workingDirectory,
    // Register Linear MCP server
    mcpServers: {
      linear: linearServer,
    },
    // Register subagents
    agents: buildAgentsConfig(),
    // Allow all built-in tools plus Linear tools
    allowedTools: [
      'Read',
      'Glob',
      'Grep',
      'Bash',
      'Task',
      'mcp__linear__linear_create_issue',
      'mcp__linear__linear_update_issue',
      'mcp__linear__linear_list_issues',
      'mcp__linear__linear_get_issue',
      'mcp__linear__linear_search_issues',
      'mcp__linear__linear_list_teams',
      'mcp__linear__linear_list_projects',
      'mcp__linear__linear_get_view_issues',
    ],
    // Include streaming events for tool calls
    includePartialMessages: true,
    // Resume session if provided
    ...(sessionId ? { resume: sessionId } : {}),
  };

  // Prepend system prompt to user message since Options doesn't have systemPrompt
  const fullPrompt = `${buildSystemPrompt()}\n\n---\n\nUser: ${userMessage}`;

  // Start the query
  const response = query({
    prompt: fullPrompt,
    options,
  });

  let fullResponse = '';
  let currentSessionId: string | undefined;
  const activeToolCalls = new Map<string, string>(); // tool_use_id -> tool_name

  // Process streaming messages
  for await (const message of response) {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          currentSessionId = message.session_id;
          // Emit session ID so PMAgent class can capture it for multi-turn conversations
          yield { type: 'session', sessionId: message.session_id };
          yield { type: 'thinking', status: 'Thinking...' };
        }
        break;

      case 'assistant':
        // Extract text from the complete assistant message
        if (message.message.content) {
          const text = extractTextFromContent(message.message.content as ContentBlock[]);
          if (text) {
            fullResponse += text;
            yield { type: 'text', content: text };
          }

          // Check for tool use blocks to track them
          for (const block of message.message.content as ContentBlock[]) {
            if (block.type === 'tool_use') {
              const toolBlock = block as ToolUseBlock;
              activeToolCalls.set(toolBlock.id, toolBlock.name);
            }
          }
        }
        break;

      case 'stream_event':
        // Handle streaming events for real-time tool call visibility
        const event = message.event;
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          const toolBlock = event.content_block;
          activeToolCalls.set(toolBlock.id, toolBlock.name);
          yield {
            type: 'tool_start',
            toolName: toolBlock.name,
            input: {},
          };
        } else if (event.type === 'content_block_stop') {
          // Tool block completed - we'll get result via 'result' message type
        }
        break;

      case 'result':
        if (message.subtype === 'success') {
          // Query completed successfully
        } else {
          // Error occurred
          yield {
            type: 'error',
            error: message.errors?.join(', ') || 'Query failed',
          };
        }
        break;

      case 'tool_progress':
        // Tool is still running - could show progress indicator
        break;
    }
  }

  return fullResponse;
}

/**
 * Simple non-streaming chat (for backwards compatibility)
 */
export async function chat(userMessage: string, sessionId?: string): Promise<string> {
  let fullResponse = '';

  for await (const message of streamPMAgent(userMessage, sessionId)) {
    if (message.type === 'text') {
      fullResponse += message.content;
    }
  }

  return fullResponse;
}

/**
 * Create a PM Agent instance with conversation history management
 * Provides a class-based interface for session management
 */
export class PMAgent {
  private sessionId: string | undefined;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  async chat(userMessage: string): Promise<string> {
    // Track user message
    this.conversationHistory.push({ role: 'user', content: userMessage });

    let fullResponse = '';

    for await (const message of streamPMAgent(userMessage, this.sessionId)) {
      // Capture session ID for multi-turn conversation persistence
      if (message.type === 'session') {
        this.sessionId = message.sessionId;
      } else if (message.type === 'text') {
        fullResponse += message.content;
      }
    }

    // Track assistant response
    if (fullResponse) {
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    }

    return fullResponse;
  }

  async *streamChat(userMessage: string): AsyncGenerator<PMAgentMessage, string, undefined> {
    // Track user message
    this.conversationHistory.push({ role: 'user', content: userMessage });

    const generator = streamPMAgent(userMessage, this.sessionId);
    let fullResponse = '';

    for await (const message of generator) {
      // Capture session ID for multi-turn conversation persistence
      if (message.type === 'session') {
        this.sessionId = message.sessionId;
      } else if (message.type === 'text') {
        fullResponse += message.content;
      }
      yield message;
    }

    // Track assistant response
    if (fullResponse) {
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    }

    return '';
  }

  clearHistory(): void {
    // Start a new session by clearing the session ID
    this.sessionId = undefined;
    this.conversationHistory = [];
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Get conversation history for summarization
   */
  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory];
  }

  /**
   * Check if there's meaningful conversation to summarize
   */
  hasConversation(): boolean {
    return this.conversationHistory.length >= 2;
  }
}

export function createPMAgent(): PMAgent {
  return new PMAgent();
}

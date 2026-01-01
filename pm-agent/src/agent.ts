/**
 * PM Agent with Sub-Agent Orchestration
 * Main agent that coordinates specialized sub-agents for PM tasks
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { allTools, executeTool } from './tools/index.js';
import { generateSkillsSummary, skillTools, executeSkillTool } from './skills/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// SDK standard location: .claude/agents/
const AGENTS_DIR = join(__dirname, '../.claude/agents');

// Model configurations for different agent types
export const MODELS = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-3-5-haiku-20241022',
} as const;

export type ModelType = keyof typeof MODELS;

interface SubAgentConfig {
  name: string;
  model: ModelType;
  systemPromptPath: string;
  description: string;
}

interface SubAgentResult {
  agent: string;
  response: string;
  toolCalls?: { tool: string; result: string }[];
}

const SUB_AGENTS: SubAgentConfig[] = [
  {
    name: 'planning',
    model: 'opus',
    systemPromptPath: 'planning-agent.md',
    description: 'Breaks down features into Linear issues with estimates',
  },
  {
    name: 'design-review',
    model: 'sonnet',
    systemPromptPath: 'design-review-agent.md',
    description: 'Reviews UI/UX decisions and provides feedback',
  },
  {
    name: 'qa',
    model: 'sonnet',
    systemPromptPath: 'qa-agent.md',
    description: 'Reviews security, test coverage, and code quality',
  },
  {
    name: 'linear-coordinator',
    model: 'haiku',
    systemPromptPath: 'linear-coordinator.md',
    description: 'Tracks progress and updates Linear issues',
  },
];

export class PMAgent {
  private client: Anthropic;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor() {
    this.client = new Anthropic();
  }

  private buildSystemPrompt(): string {
    const skillsSummary = generateSkillsSummary();

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

**Delegation syntax**: Use \`delegate_to_agent\` tool with clear, specific tasks.

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

${skillsSummary}

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
- **Don't wait to be asked about blockers** (surface them proactively)
`;
  }

  private getSubAgentSystemPrompt(agentName: string): string | null {
    const config = SUB_AGENTS.find(a => a.name === agentName);
    if (!config) return null;

    const promptPath = join(AGENTS_DIR, config.systemPromptPath);
    if (!existsSync(promptPath)) {
      return null;
    }

    return readFileSync(promptPath, 'utf-8');
  }

  private getAgentTools(): Anthropic.Tool[] {
    return [
      ...allTools,
      ...skillTools,
      {
        name: 'delegate_to_agent',
        description: 'Delegate a task to a specialized sub-agent. Use for complex tasks that benefit from specialized expertise.',
        input_schema: {
          type: 'object' as const,
          properties: {
            agent: {
              type: 'string',
              enum: SUB_AGENTS.map(a => a.name),
              description: 'The sub-agent to delegate to',
            },
            task: {
              type: 'string',
              description: 'The task description to send to the sub-agent',
            },
            context: {
              type: 'string',
              description: 'Additional context for the sub-agent',
            },
          },
          required: ['agent', 'task'],
        },
      },
    ];
  }

  private async executeSubAgent(
    agentName: string,
    task: string,
    context?: string
  ): Promise<SubAgentResult> {
    const config = SUB_AGENTS.find(a => a.name === agentName);
    if (!config) {
      return {
        agent: agentName,
        response: `Unknown agent: ${agentName}`,
      };
    }

    const systemPrompt = this.getSubAgentSystemPrompt(agentName);
    if (!systemPrompt) {
      return {
        agent: agentName,
        response: `Failed to load agent configuration for: ${agentName}`,
      };
    }

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: context
          ? `Context:\n${context}\n\nTask:\n${task}`
          : task,
      },
    ];

    const toolCalls: { tool: string; result: string }[] = [];
    let response = '';

    // Run sub-agent with tool loop
    let continueLoop = true;
    while (continueLoop) {
      const result = await this.client.messages.create({
        model: MODELS[config.model],
        max_tokens: 4096,
        system: systemPrompt,
        tools: [...allTools, ...skillTools],
        messages,
      });

      // Process response
      for (const block of result.content) {
        if (block.type === 'text') {
          response += block.text;
        } else if (block.type === 'tool_use') {
          // Execute tool
          let toolResult: string;
          if (block.name.startsWith('linear_')) {
            toolResult = await executeTool(block.name, block.input as Record<string, unknown>);
          } else if (block.name === 'load_skill') {
            toolResult = executeSkillTool(block.name, block.input as Record<string, unknown>);
          } else {
            toolResult = JSON.stringify({ error: `Unknown tool: ${block.name}` });
          }

          toolCalls.push({ tool: block.name, result: toolResult });

          // Add to messages for continuation
          messages.push({
            role: 'assistant',
            content: result.content,
          });
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: block.id,
                content: toolResult,
              },
            ],
          });
        }
      }

      // Check if we should continue
      if (result.stop_reason === 'end_turn' || result.stop_reason === 'stop_sequence') {
        continueLoop = false;
      } else if (result.stop_reason !== 'tool_use') {
        continueLoop = false;
      }
    }

    return {
      agent: agentName,
      response,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let response = '';
    let continueLoop = true;

    while (continueLoop) {
      const result = await this.client.messages.create({
        model: MODELS.sonnet,
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        tools: this.getAgentTools(),
        messages: this.conversationHistory,
      });

      const assistantContent: Anthropic.ContentBlock[] = [];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of result.content) {
        if (block.type === 'text') {
          response += block.text;
          assistantContent.push(block);
        } else if (block.type === 'tool_use') {
          assistantContent.push(block);

          // Execute tool
          let toolResult: string;

          if (block.name === 'delegate_to_agent') {
            const input = block.input as { agent: string; task: string; context?: string };
            const subResult = await this.executeSubAgent(
              input.agent,
              input.task,
              input.context
            );
            toolResult = JSON.stringify(subResult);
          } else if (block.name.startsWith('linear_')) {
            toolResult = await executeTool(block.name, block.input as Record<string, unknown>);
          } else if (block.name === 'load_skill') {
            toolResult = executeSkillTool(block.name, block.input as Record<string, unknown>);
          } else {
            toolResult = JSON.stringify({ error: `Unknown tool: ${block.name}` });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult,
          });
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantContent,
      });

      // If there were tool calls, add results and continue
      if (toolResults.length > 0) {
        this.conversationHistory.push({
          role: 'user',
          content: toolResults,
        });
      }

      // Check if we should continue
      if (result.stop_reason === 'end_turn' || result.stop_reason === 'stop_sequence') {
        continueLoop = false;
      } else if (result.stop_reason !== 'tool_use') {
        continueLoop = false;
      }
    }

    return response;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }
}

export function createPMAgent(): PMAgent {
  return new PMAgent();
}

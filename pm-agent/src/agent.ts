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

You are a Project Management agent for software development projects. You help plan features, track progress in Linear, and coordinate development work.

## Your Capabilities

1. **Feature Planning**: Break down features into actionable Linear issues with estimates
2. **Linear Management**: Create, update, and track issues in Linear
3. **Design Review**: Coordinate UI/UX review using design standards
4. **QA Oversight**: Ensure security and quality standards are met
5. **Progress Tracking**: Keep stakeholders informed of project status

## Sub-Agents Available

You can delegate specialized tasks to these sub-agents:
- **planning**: Uses Claude Opus for complex feature breakdown (delegated via \`delegate_to_agent\`)
- **design-review**: Uses Claude Sonnet for UI/UX feedback
- **qa**: Uses Claude Sonnet for security and test coverage review
- **linear-coordinator**: Uses Claude Haiku for quick status updates

## Workflow

1. For new feature requests, use the planning agent to create a detailed breakdown
2. Create Linear issues for approved work items
3. Track progress and coordinate with the linear-coordinator
4. Request design-review for UI changes
5. Request qa review before marking work complete

${skillsSummary}

## Guidelines

- Always confirm understanding before taking action
- Provide clear summaries of Linear operations
- Escalate blockers promptly
- Keep responses concise but informative
`;
  }

  private getSubAgentSystemPrompt(agentName: string): string | null {
    const config = SUB_AGENTS.find(a => a.name === agentName);
    if (!config) return null;

    const promptPath = join(AGENTS_DIR, config.systemPromptPath);
    if (!existsSync(promptPath)) {
      console.warn(`Agent prompt not found: ${promptPath}`);
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

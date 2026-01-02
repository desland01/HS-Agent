#!/usr/bin/env node
/**
 * PM Agent CLI
 * Claude Code-like interactive command-line interface
 * Built with Claude Agent SDK
 */

import 'dotenv/config';
import * as readline from 'readline';
import { basename, resolve } from 'path';
import { createPMAgent, setWorkingDirectory, getWorkingDirectory, type PMAgentMessage } from './agent.js';
import { initializeLinearClient } from './tools/linear-mcp.js';
import {
  addMemoryEntry,
  addSessionInsight,
  summarizeConversation,
  getMemoryStats,
  type MemoryCategory
} from './memory.js';

// ANSI colors and styles
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Cursor control
  clearLine: '\x1b[2K',
  moveUp: '\x1b[1A',
  moveToStart: '\x1b[0G',
};

// Tool icons for visual feedback
const toolIcons: Record<string, string> = {
  Read: '📄',
  Glob: '🔍',
  Grep: '🔎',
  Bash: '💻',
  Write: '✏️',
  Edit: '📝',
  // Linear tools (MCP format)
  mcp__linear__linear_list_issues: '📋',
  mcp__linear__linear_create_issue: '✏️',
  mcp__linear__linear_update_issue: '🔄',
  mcp__linear__linear_get_issue: '📄',
  mcp__linear__linear_search_issues: '🔍',
  mcp__linear__linear_list_teams: '👥',
  mcp__linear__linear_list_projects: '📁',
  mcp__linear__linear_get_view_issues: '👁️',
  // Subagents
  planning: '🎯',
  'design-review': '🎨',
  qa: '🔬',
  'linear-coordinator': '📊',
};

function getToolIcon(toolName: string): string {
  return toolIcons[toolName] || '🔧';
}

function formatToolName(toolName: string): string {
  // Remove mcp__linear__ prefix for cleaner display
  const cleanName = toolName.replace(/^mcp__linear__/, '');
  return cleanName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function printCompactHeader(): void {
  const cwd = basename(getWorkingDirectory());
  console.log(`
${c.cyan}${c.bold}PM Agent${c.reset} ${c.dim}(${cwd})${c.reset}
${c.dim}Type /help for commands, /quit to exit${c.reset}
`);
}

function printHelp(): void {
  console.log(`
${c.bold}Commands${c.reset}
  ${c.yellow}/clear${c.reset}     Clear conversation (auto-saves insights)
  ${c.yellow}/skills${c.reset}    List available skills
  ${c.yellow}/agents${c.reset}    List sub-agents
  ${c.yellow}/tools${c.reset}     List available tools
  ${c.yellow}/cwd${c.reset}       Show working directory
  ${c.yellow}/quit${c.reset}      Exit (auto-saves insights)

${c.bold}Memory Commands${c.reset}
  ${c.yellow}/remember${c.reset}  Save insight to memory
  ${c.yellow}/memory${c.reset}    Show memory statistics

  Examples:
    /remember vision: Building multi-tenant SaaS for home services
    /remember decision: Chose Redis for session state
    /remember preference: Prefer explicit error handling

${c.bold}File Operations${c.reset}
  The agent uses Claude Code's built-in file tools:
  - Read, Glob, Grep, Bash

  Examples:
    "Show me the contents of package.json"
    "Find all TypeScript files in src/"
    "Search for TODO comments"

${c.bold}Linear Integration${c.reset}
  "Show me issues in the Up Next view"
  "Create an issue for implementing auth"
  "What's blocked right now?"
`);
}

function printTools(): void {
  console.log(`
${c.bold}Available Tools${c.reset}

${c.cyan}File Operations (Built-in)${c.reset}
  ${c.dim}•${c.reset} Read         Read file contents
  ${c.dim}•${c.reset} Glob         Find files by pattern
  ${c.dim}•${c.reset} Grep         Search file contents
  ${c.dim}•${c.reset} Bash         Run shell commands

${c.cyan}Linear Integration (MCP)${c.reset}
  ${c.dim}•${c.reset} linear_list_issues    List/filter issues
  ${c.dim}•${c.reset} linear_create_issue   Create new issue
  ${c.dim}•${c.reset} linear_update_issue   Update issue status
  ${c.dim}•${c.reset} linear_get_issue      Get issue details
  ${c.dim}•${c.reset} linear_search_issues  Search issues
  ${c.dim}•${c.reset} linear_list_teams     List teams
  ${c.dim}•${c.reset} linear_list_projects  List projects
  ${c.dim}•${c.reset} linear_get_view_issues Get view issues
`);
}

function printSkills(): void {
  console.log(`
${c.bold}Available Skills${c.reset}
  ${c.magenta}project-context${c.reset}   PRD, architecture, business rules
  ${c.magenta}planning${c.reset}          Feature breakdown, issue creation
  ${c.magenta}design-system${c.reset}     UI/UX standards, typography
  ${c.magenta}linear-workflow${c.reset}   Issue templates, priorities
  ${c.magenta}agent-patterns${c.reset}    SDK patterns, skill authoring
`);
}

function printAgents(): void {
  console.log(`
${c.bold}Sub-Agents${c.reset}
  ${c.green}planning${c.reset}           ${c.dim}(Opus)${c.reset}   Complex feature breakdown
  ${c.green}design-review${c.reset}      ${c.dim}(Sonnet)${c.reset} UI/UX feedback
  ${c.green}qa${c.reset}                 ${c.dim}(Sonnet)${c.reset} Security and quality
  ${c.green}linear-coordinator${c.reset} ${c.dim}(Haiku)${c.reset}  Quick status updates
`);
}

function clearLine(): void {
  process.stdout.write(c.clearLine + c.moveToStart);
}

async function main(): Promise<void> {
  // Note: ANTHROPIC_API_KEY is optional when using Claude Max subscription
  // The Claude Agent SDK will use your authenticated session automatically

  // Set working directory to current directory
  setWorkingDirectory(resolve(process.cwd()));

  // Initialize Linear if available
  if (process.env.LINEAR_API_KEY) {
    initializeLinearClient(process.env.LINEAR_API_KEY);
  }

  printCompactHeader();

  const agent = createPMAgent();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  // Track if we're currently outputting
  let isOutputting = false;

  const getPrompt = (): string => {
    const cwd = basename(getWorkingDirectory());
    return `${c.dim}${cwd}${c.reset} ${c.cyan}❯${c.reset} `;
  };

  const askQuestion = (): void => {
    rl.question(getPrompt(), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        const cmd = trimmed.toLowerCase().split(' ')[0];
        const cmdArgs = trimmed.slice(cmd.length).trim();

        // Helper to auto-summarize conversation before clearing/exiting
        const autoSummarize = async (): Promise<void> => {
          if (agent.hasConversation()) {
            console.log(`${c.dim}Saving insights...${c.reset}`);
            try {
              const insight = await summarizeConversation(agent.getConversationHistory());
              if (insight) {
                addSessionInsight(insight.title, insight.content);
                console.log(`${c.green}✓ Saved: ${insight.title}${c.reset}`);
              }
            } catch (error) {
              // Silently fail - don't block exit/clear
            }
          }
        };

        switch (cmd) {
          case '/quit':
          case '/exit':
          case '/q':
            await autoSummarize();
            console.log(`${c.dim}Goodbye!${c.reset}`);
            rl.close();
            process.exit(0);
            break;

          case '/clear':
            await autoSummarize();
            agent.clearHistory();
            console.clear();
            printCompactHeader();
            console.log(`${c.green}✓ Cleared${c.reset}\n`);
            break;

          case '/help':
          case '/?':
            printHelp();
            break;

          case '/skills':
            printSkills();
            break;

          case '/agents':
            printAgents();
            break;

          case '/tools':
            printTools();
            break;

          case '/cwd':
            console.log(`${c.dim}Working directory:${c.reset} ${getWorkingDirectory()}\n`);
            break;

          case '/remember': {
            // Parse: /remember category: content
            const match = cmdArgs.match(/^(vision|decisions?|preferences?|history):\s*(.+)$/i);
            if (!match) {
              console.log(`${c.yellow}Usage: /remember <category>: <content>${c.reset}`);
              console.log(`${c.dim}Categories: vision, decision, preference, history${c.reset}\n`);
              break;
            }

            // Normalize category name (singular -> plural)
            const categoryMap: Record<string, MemoryCategory> = {
              vision: 'vision',
              decision: 'decisions',
              decisions: 'decisions',
              preference: 'preferences',
              preferences: 'preferences',
              history: 'history',
            };
            const category = categoryMap[match[1].toLowerCase()];
            const content = match[2].trim();
            addMemoryEntry(category, content);
            console.log(`${c.green}✓ Remembered in ${category}${c.reset}\n`);
            break;
          }

          case '/memory': {
            const stats = getMemoryStats();
            console.log(`\n${c.bold}Memory Statistics${c.reset}`);
            console.log(`${c.dim}────────────────────${c.reset}`);
            console.log(`  Total entries: ${c.cyan}${stats.totalEntries}${c.reset}`);
            console.log(`  Vision & Goals: ${stats.byCategory.vision}`);
            console.log(`  Decisions: ${stats.byCategory.decisions}`);
            console.log(`  Preferences: ${stats.byCategory.preferences}`);
            console.log(`  History: ${stats.byCategory.history}`);
            console.log(`  Session Insights: ${stats.byCategory.insights}`);
            if (stats.lastUpdated) {
              console.log(`  Last updated: ${c.dim}${stats.lastUpdated}${c.reset}`);
            }
            console.log(`\n${c.dim}Edit: pm-agent/.claude/memory.md${c.reset}\n`);
            break;
          }

          default:
            console.log(`${c.yellow}Unknown command: ${cmd}${c.reset}`);
            console.log(`${c.dim}Type /help for commands${c.reset}\n`);
        }

        askQuestion();
        return;
      }

      // Process with streaming agent
      isOutputting = true;
      let lastWasToolOutput = false;
      let hasStartedOutput = false;

      try {
        const generator = agent.streamChat(trimmed);

        for await (const message of generator) {
          handleMessage(message);
        }

        function handleMessage(message: PMAgentMessage): void {
          switch (message.type) {
            case 'session':
              // Internal message for session tracking - no output needed
              break;

            case 'thinking':
              if (!hasStartedOutput) {
                process.stdout.write(`\n${c.dim}${message.status}${c.reset}`);
              }
              break;

            case 'text':
              if (!hasStartedOutput) {
                clearLine();
                process.stdout.write('\n');
                hasStartedOutput = true;
              }
              if (lastWasToolOutput) {
                process.stdout.write('\n');
                lastWasToolOutput = false;
              }
              process.stdout.write(message.content);
              break;

            case 'tool_start': {
              if (!hasStartedOutput) {
                clearLine();
                process.stdout.write('\n');
                hasStartedOutput = true;
              }

              const icon = getToolIcon(message.toolName);
              const name = formatToolName(message.toolName);

              // Format tool input summary
              let summary = '';
              const input = message.input;

              if (message.toolName === 'Read' && input.file_path) {
                summary = ` ${c.dim}${input.file_path}${c.reset}`;
              } else if (message.toolName === 'Glob' && input.pattern) {
                summary = ` ${c.dim}${input.pattern}${c.reset}`;
              } else if (message.toolName === 'Grep' && input.pattern) {
                summary = ` ${c.dim}"${input.pattern}"${c.reset}`;
              } else if (message.toolName === 'Bash' && input.command) {
                const cmd = String(input.command).slice(0, 50);
                summary = ` ${c.dim}${cmd}${cmd.length >= 50 ? '...' : ''}${c.reset}`;
              } else if (message.toolName.includes('linear')) {
                // Show relevant Linear tool info
                if (input.title) summary = ` ${c.dim}${input.title}${c.reset}`;
                else if (input.query) summary = ` ${c.dim}"${input.query}"${c.reset}`;
                else if (input.viewName) summary = ` ${c.dim}${input.viewName}${c.reset}`;
              }

              process.stdout.write(`\n${c.brightBlack}${icon} ${name}${summary}${c.reset}`);
              lastWasToolOutput = true;
              break;
            }

            case 'tool_end':
              // Parse result to show success/failure
              try {
                const parsed = JSON.parse(message.result);
                if (parsed.success === false) {
                  process.stdout.write(` ${c.red}✗${c.reset}`);
                } else {
                  process.stdout.write(` ${c.green}✓${c.reset}`);
                }
              } catch {
                process.stdout.write(` ${c.green}✓${c.reset}`);
              }
              break;

            case 'subagent_start':
              if (!hasStartedOutput) {
                clearLine();
                process.stdout.write('\n');
                hasStartedOutput = true;
              }
              const agentIcon = getToolIcon(message.agentName);
              process.stdout.write(`\n${c.brightBlack}${agentIcon} Delegating to ${c.cyan}${message.agentName}${c.reset}${c.brightBlack} agent...${c.reset}`);
              lastWasToolOutput = true;
              break;

            case 'subagent_end':
              process.stdout.write(` ${c.green}✓${c.reset}`);
              break;

            case 'error':
              if (!hasStartedOutput) {
                clearLine();
                process.stdout.write('\n');
              }
              console.error(`\n${c.red}Error: ${message.error}${c.reset}`);
              break;
          }
        }

        // End output
        if (!hasStartedOutput) {
          clearLine();
        }
        process.stdout.write('\n\n');
      } catch (error) {
        clearLine();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`\n${c.red}Error: ${errorMessage}${c.reset}\n`);
      }

      isOutputting = false;
      askQuestion();
    });
  };

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    if (!isOutputting) {
      console.log(`\n${c.dim}Goodbye!${c.reset}`);
    }
    process.exit(0);
  });

  // Handle SIGINT for cleaner exit during output
  process.on('SIGINT', () => {
    if (isOutputting) {
      console.log(`\n${c.yellow}Interrupted${c.reset}`);
    }
    process.exit(0);
  });

  // Start the conversation
  askQuestion();
}

main().catch((error) => {
  console.error(`${c.red}Fatal error:${c.reset}`, error);
  process.exit(1);
});

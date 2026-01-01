#!/usr/bin/env node
/**
 * PM Agent CLI
 * Interactive command-line interface for the PM Agent
 */

import 'dotenv/config';
import * as readline from 'readline';
import { createPMAgent } from './agent.js';
import { initializeLinear } from './tools/index.js';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function printHeader(): void {
  console.log(`
${colors.cyan}${colors.bright}╔══════════════════════════════════════════╗
║          PM Agent - Project Manager       ║
║    Powered by Claude Agent SDK            ║
╚══════════════════════════════════════════╝${colors.reset}

${colors.dim}Commands:${colors.reset}
  ${colors.yellow}/clear${colors.reset}    - Clear conversation history
  ${colors.yellow}/help${colors.reset}     - Show available commands
  ${colors.yellow}/quit${colors.reset}     - Exit the agent

${colors.dim}Example prompts:${colors.reset}
  - "Show me the Up Next view in Linear"
  - "Break down this feature: user authentication"
  - "Create a Linear issue for implementing OAuth"
  - "What's the status of our current sprint?"

`);
}

function printHelp(): void {
  console.log(`
${colors.bright}Available Commands:${colors.reset}

  ${colors.yellow}/clear${colors.reset}     Clear conversation history and start fresh
  ${colors.yellow}/history${colors.reset}   Show conversation history summary
  ${colors.yellow}/skills${colors.reset}    List available skills
  ${colors.yellow}/agents${colors.reset}    List available sub-agents
  ${colors.yellow}/help${colors.reset}      Show this help message
  ${colors.yellow}/quit${colors.reset}      Exit the PM Agent

${colors.bright}Tips:${colors.reset}
  - Ask natural questions about your project
  - The agent can create and manage Linear issues
  - Complex tasks are delegated to specialized sub-agents
  - Use skills for specific workflows (planning, design review, etc.)
`);
}

async function main(): Promise<void> {
  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${colors.red}Error: ANTHROPIC_API_KEY environment variable is required${colors.reset}`);
    process.exit(1);
  }

  // Initialize Linear if API key is available
  if (process.env.LINEAR_API_KEY) {
    initializeLinear(process.env.LINEAR_API_KEY);
    console.log(`${colors.green}Linear integration enabled${colors.reset}`);
  } else {
    console.log(`${colors.yellow}Warning: LINEAR_API_KEY not set. Linear tools will not work.${colors.reset}`);
  }

  printHeader();

  const agent = createPMAgent();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = `${colors.cyan}You${colors.reset}${colors.dim} > ${colors.reset}`;

  const askQuestion = (): void => {
    rl.question(prompt, async (input) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        askQuestion();
        return;
      }

      // Handle commands
      if (trimmedInput.startsWith('/')) {
        const command = trimmedInput.toLowerCase();

        switch (command) {
          case '/quit':
          case '/exit':
          case '/q':
            console.log(`\n${colors.dim}Goodbye!${colors.reset}\n`);
            rl.close();
            process.exit(0);
            break;

          case '/clear':
            agent.clearHistory();
            console.log(`${colors.green}Conversation history cleared.${colors.reset}\n`);
            break;

          case '/help':
          case '/?':
            printHelp();
            break;

          case '/history':
            const history = agent.getHistory();
            console.log(`${colors.bright}Conversation History:${colors.reset}`);
            console.log(`${colors.dim}${history.length} messages in history${colors.reset}\n`);
            break;

          case '/skills':
            console.log(`
${colors.bright}Available Skills:${colors.reset}
  - ${colors.magenta}project-context${colors.reset}: PRD, architecture, business rules
  - ${colors.magenta}planning${colors.reset}: Feature breakdown, Linear issue creation
  - ${colors.magenta}design-system${colors.reset}: UI/UX standards, typography, colors
  - ${colors.magenta}linear-workflow${colors.reset}: Issue templates, priorities, views
  - ${colors.magenta}agent-patterns${colors.reset}: SDK patterns, skill authoring
`);
            break;

          case '/agents':
            console.log(`
${colors.bright}Available Sub-Agents:${colors.reset}
  - ${colors.magenta}planning${colors.reset} (Opus): Complex feature breakdown
  - ${colors.magenta}design-review${colors.reset} (Sonnet): UI/UX feedback
  - ${colors.magenta}qa${colors.reset} (Sonnet): Security and test coverage
  - ${colors.magenta}linear-coordinator${colors.reset} (Haiku): Quick status updates
`);
            break;

          default:
            console.log(`${colors.yellow}Unknown command: ${trimmedInput}${colors.reset}`);
            console.log(`${colors.dim}Type /help for available commands${colors.reset}\n`);
        }

        askQuestion();
        return;
      }

      // Process with agent
      console.log(`\n${colors.dim}Thinking...${colors.reset}`);

      try {
        const response = await agent.chat(trimmedInput);
        console.log(`\n${colors.green}${colors.bright}PM Agent${colors.reset}${colors.dim} > ${colors.reset}`);
        console.log(response);
        console.log();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`\n${colors.red}Error: ${message}${colors.reset}\n`);
      }

      askQuestion();
    });
  };

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    console.log(`\n${colors.dim}Goodbye!${colors.reset}\n`);
    process.exit(0);
  });

  // Start the conversation loop
  askQuestion();
}

main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

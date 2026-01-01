/**
 * Autonomous Dev Agent - Multi-Agent Architecture
 *
 * Built following Claude Agent SDK best practices:
 * - Uses Claude Code preset for system prompt and tools
 * - Defines specialized subagents for different tasks
 * - Loads CLAUDE.md for project context via settingSources
 * - Implements hooks for monitoring and context management
 * - Session resume support for long-running tasks
 *
 * Development Loop:
 * 1. Fetch highest priority "Todo" issue from Linear
 * 2. Move to "In Progress", add comment "Starting work..."
 * 3. Explore → Plan → Implement → Test → Commit → PR
 * 4. If fail: retry up to 3 times, then escalate
 * 5. Repeat
 */

import {
  query,
  type SDKMessage,
  type AgentDefinition,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput,
  type SessionStartHookInput
} from '@anthropic-ai/claude-agent-sdk';
import { LinearClient } from '@linear/sdk';
import { linearServer } from './tools/linear.js';
import { gitServer, setWorkingDirectory as setGitDir } from './tools/git.js';
import { bashServer, setWorkingDirectory as setBashDir } from './tools/bash.js';

// Configuration
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 30000; // 30 seconds between task checks
const WORKING_DIR = process.env.WORKING_DIRECTORY || process.cwd();

// Initialize Linear client for direct API calls
const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!
});

// Set working directories for MCP tools
setGitDir(WORKING_DIR);
setBashDir(WORKING_DIR);

/**
 * Issue interface
 */
interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
}

/**
 * Session state for context management
 */
interface SessionState {
  currentIssue: Issue | null;
  sessionId: string | null;
  toolsUsed: string[];
  filesModified: string[];
  startTime: number;
}

let sessionState: SessionState = {
  currentIssue: null,
  sessionId: null,
  toolsUsed: [],
  filesModified: [],
  startTime: 0
};

/**
 * Specialized Subagents - Minimal prompts for speed/context efficiency
 */
const SUBAGENTS: Record<string, AgentDefinition> = {
  // Fast exploration with haiku
  'explorer': {
    description: 'Find relevant files and understand codebase patterns. Use first.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    prompt: 'Find relevant files, identify patterns, report concisely.',
    model: 'haiku'
  },

  // Code implementation with sonnet
  'coder': {
    description: 'Write/edit code following existing patterns.',
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    prompt: 'Write clean TypeScript. Match existing style. Handle edge cases.',
    model: 'sonnet'
  },

  // Git + verification combined (reduces agent switching)
  'ship': {
    description: 'Verify build, commit, push, create PR. Use when code is ready.',
    tools: ['Bash', 'Read'],
    prompt: 'Run verify_build. If pass: use complete_feature tool. Report PR URL.',
    model: 'haiku'
  }
};

/**
 * Hooks for monitoring and context management
 */
const createHooks = () => ({
  // Track session start
  SessionStart: [{
    hooks: [async (input: SessionStartHookInput) => {
      console.log(`[Hook] Session started: ${input.session_id}`);
      sessionState.sessionId = input.session_id;
      sessionState.startTime = Date.now();
      return { continue: true };
    }] as HookCallback[]
  }],

  // Track tool usage before execution
  PreToolUse: [{
    hooks: [async (input: PreToolUseHookInput) => {
      const toolName = input.tool_name;
      console.log(`[Hook] Tool: ${toolName}`);
      sessionState.toolsUsed.push(toolName);

      // Track file modifications
      if (['Write', 'Edit'].includes(toolName)) {
        const filePath = (input.tool_input as any)?.file_path;
        if (filePath && !sessionState.filesModified.includes(filePath)) {
          sessionState.filesModified.push(filePath);
        }
      }

      return { continue: true };
    }] as HookCallback[]
  }],

  // Log tool results
  PostToolUse: [{
    hooks: [async (input: PostToolUseHookInput) => {
      // Could add logging, metrics, or context updates here
      return { continue: true };
    }] as HookCallback[]
  }]
});

/**
 * Extract text content from SDK message
 */
function getMessageContent(message: SDKMessage): string {
  if (message.type === 'assistant' && message.message.content) {
    const content = message.message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
  }
  return '';
}

/**
 * Process a single issue using multi-agent architecture
 */
async function processIssue(issue: Issue): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${issue.identifier} - ${issue.title}`);
  console.log(`${'='.repeat(60)}\n`);

  // Reset session state
  sessionState = {
    currentIssue: issue,
    sessionId: null,
    toolsUsed: [],
    filesModified: [],
    startTime: Date.now()
  };

  let retryCount = 0;
  let success = false;

  while (retryCount < MAX_RETRIES && !success) {
    try {
      retryCount++;
      console.log(`\nAttempt ${retryCount}/${MAX_RETRIES}`);

      // Build the task prompt
      const taskPrompt = buildTaskPrompt(issue, retryCount);

      // Run the agent with full SDK capabilities
      const response = query({
        prompt: taskPrompt,
        options: {
          model: 'claude-sonnet-4-5',
          cwd: WORKING_DIR,

          // Use Claude Code's full system prompt with custom append
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: `
## Current Task Context
You are working on Linear issue: ${issue.identifier}
Issue URL: ${issue.url}
Working Directory: ${WORKING_DIR}

## Development Standards
- Follow existing code patterns in the codebase
- Use TypeScript with strict typing
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Always work on feature branches, never main
- Create clear commit messages
- Run typecheck and build before committing`
          },

          // Use Claude Code's full tool set plus our MCP servers
          tools: { type: 'preset', preset: 'claude_code' },

          // Load CLAUDE.md for project context
          settingSources: ['project'],

          // Auto-approve file edits for autonomous operation
          permissionMode: 'acceptEdits',

          // Define specialized subagents
          agents: SUBAGENTS,

          // Add our MCP servers for Linear, Git, and Bash
          mcpServers: {
            linear: linearServer,
            git: gitServer,
            bash: bashServer
          },

          // Enable hooks for monitoring
          hooks: createHooks(),

          // Context management
          maxTurns: 50, // Limit conversation length
        }
      });

      // Process the response stream
      for await (const message of response) {
        switch (message.type) {
          case 'assistant':
            const content = getMessageContent(message);
            if (content) {
              // Truncate long outputs for logging
              const truncated = content.length > 500
                ? content.substring(0, 500) + '...[truncated]'
                : content;
              console.log('Agent:', truncated);
            }
            break;

          case 'result':
            if (message.subtype === 'success') {
              console.log('\n✅ Task completed successfully');
              console.log(`   Duration: ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s`);
              console.log(`   Tools used: ${sessionState.toolsUsed.length}`);
              console.log(`   Files modified: ${sessionState.filesModified.length}`);
              success = true;
            } else {
              console.error('\n❌ Task failed:', message.errors);
              throw new Error(`Agent error: ${message.errors?.join(', ')}`);
            }
            break;

          case 'system':
            if (message.subtype === 'init') {
              console.log(`Session: ${message.session_id}`);
              console.log(`Model: ${message.model}`);
              console.log(`Tools: ${message.tools.length} available`);
            }
            break;
        }
      }

    } catch (error) {
      console.error(`\n❌ Attempt ${retryCount} failed:`, error);

      if (retryCount >= MAX_RETRIES) {
        console.log('\n🚨 Max retries reached, escalating to human...');
        await escalateToHuman(issue, error);
      } else {
        console.log(`\n⏳ Retrying in 10 seconds...`);
        await sleep(10000);
      }
    }
  }

  return success;
}

/**
 * Build the task prompt for an issue - concise for token efficiency
 */
function buildTaskPrompt(issue: Issue, attemptNumber: number): string {
  let prompt = `# ${issue.identifier}: ${issue.title}

${issue.description || 'No description.'}

## Steps
1. Update Linear → "In Progress"
2. explorer → find relevant files
3. coder → implement changes
4. ship → verify_build, complete_feature, complete_task

Use consolidated tools: verify_build, complete_feature, complete_task`;

  if (attemptNumber > 1) {
    prompt += `\n\n⚠️ Attempt ${attemptNumber}/${MAX_RETRIES}. Investigate failure first.`;
  }

  return prompt;
}

/**
 * Escalate issue to human after max retries
 */
async function escalateToHuman(issue: Issue, error: unknown): Promise<void> {
  const reason = `Failed after ${MAX_RETRIES} attempts.

Last error:
\`\`\`
${error}
\`\`\`

Session stats:
- Tools used: ${sessionState.toolsUsed.length}
- Files modified: ${sessionState.filesModified.join(', ') || 'none'}
- Duration: ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s`;

  try {
    const response = query({
      prompt: `Escalate ${issue.identifier}: ${reason.slice(0, 200)}. Use assign_to_human tool.`,
      options: {
        model: 'claude-haiku-3-5',
        mcpServers: { linear: linearServer }
      }
    });

    for await (const message of response) {
      if (message.type === 'assistant') {
        const content = getMessageContent(message);
        if (content) console.log('Escalation:', content);
      }
    }
  } catch (escError) {
    console.error('Failed to escalate:', escError);
  }
}

/**
 * Main agent loop
 */
export async function runAgent(): Promise<void> {
  console.log('\n🤖 Dev Agent v2 | Agents: ' + Object.keys(SUBAGENTS).join(', '));
  console.log(`Dir: ${WORKING_DIR} | Poll: ${POLL_INTERVAL_MS / 1000}s | Retries: ${MAX_RETRIES}\n`);

  // Initialize repository
  console.log('📁 Initializing repository...');
  try {
    const initResponse = query({
      prompt: `Initialize the repository:
1. Check git status
2. Ensure we're on main branch
3. Pull latest changes
4. Report current state`,
      options: {
        model: 'claude-sonnet-4-5',
        cwd: WORKING_DIR,
        mcpServers: { git: gitServer, bash: bashServer },
        permissionMode: 'acceptEdits'
      }
    });

    for await (const message of initResponse) {
      if (message.type === 'assistant') {
        const content = getMessageContent(message);
        if (content) console.log(content);
      }
    }
  } catch (initError) {
    console.error('Repository init warning:', initError);
  }

  // Main loop
  console.log('\n🔄 Starting main loop...\n');

  while (true) {
    try {
      console.log('\n--- Checking for new tasks ---');

      // Fetch todo issues directly from Linear
      const viewer = await linearClient.viewer;
      const issues = await linearClient.issues({
        filter: {
          assignee: { id: { eq: viewer.id } },
          state: { name: { eq: 'Todo' } }
        },
        first: 10
      });

      const issueList: Issue[] = issues.nodes.map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || undefined,
        url: issue.url
      }));

      console.log(`Found ${issueList.length} issue(s) assigned to ${viewer.name}`);

      if (issueList.length === 0) {
        console.log('📭 No tasks in queue. Waiting...');
      } else {
        // Process the first issue
        const issue = issueList[0];
        const success = await processIssue(issue);

        if (success) {
          console.log(`\n✅ Completed: ${issue.identifier}`);
        } else {
          console.log(`\n❌ Failed: ${issue.identifier} (escalated to human)`);
        }
      }

      // Wait before checking again
      console.log(`\n⏰ Waiting ${POLL_INTERVAL_MS / 1000}s before next check...`);
      await sleep(POLL_INTERVAL_MS);

    } catch (error) {
      console.error('❌ Error in main loop:', error);
      console.log('🔄 Recovering in 60 seconds...');
      await sleep(60000);
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

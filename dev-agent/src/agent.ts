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
 * Specialized Subagents
 *
 * These agents handle specific aspects of the development workflow,
 * allowing for better context management and parallel operations.
 */
const SUBAGENTS: Record<string, AgentDefinition> = {
  // Explorer agent - understands codebase before making changes
  'code-explorer': {
    description: 'Explores and analyzes the codebase to understand context, architecture, and existing patterns before making changes. Use this first for any new task.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    prompt: `You are a code exploration specialist. Your job is to:
1. Understand the codebase structure and architecture
2. Find relevant files for the task at hand
3. Identify existing patterns and conventions
4. Report findings clearly for the implementation phase

Be thorough but focused. Look for:
- Related files and dependencies
- Existing patterns to follow
- Potential impacts of changes
- Test files that may need updates`,
    model: 'haiku' // Fast model for exploration
  },

  // Implementer agent - writes code changes
  'implementer': {
    description: 'Implements code changes following established patterns. Use after exploration to write actual code.',
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    prompt: `You are a code implementation specialist. Your job is to:
1. Write clean, well-structured TypeScript code
2. Follow existing patterns in the codebase
3. Add appropriate comments and documentation
4. Handle edge cases properly

Guidelines:
- Match the style of surrounding code
- Use TypeScript strict typing
- Keep functions small and focused
- Add JSDoc comments for public APIs`,
    model: 'sonnet'
  },

  // Tester agent - runs tests and builds
  'tester': {
    description: 'Runs tests, type checks, and builds to verify code changes. Use after implementation.',
    tools: ['Bash', 'Read', 'Grep'],
    prompt: `You are a testing specialist. Your job is to:
1. Run type checks (npm run typecheck)
2. Run builds (npm run build)
3. Run tests (npm test) if they exist
4. Analyze any failures and report clearly

If tests fail:
- Identify the root cause
- Explain what went wrong
- Suggest fixes`,
    model: 'haiku'
  },

  // Git operations agent - handles version control
  'git-ops': {
    description: 'Handles git operations: branching, committing, pushing, and creating PRs. Use after tests pass.',
    tools: ['Bash', 'Read'],
    prompt: `You are a git operations specialist. Your job is to:
1. Create feature branches with proper naming
2. Stage and commit changes with clear messages
3. Push to remote
4. Create pull requests via gh CLI

Branch naming: feature/{issue-id}-{short-description}
Commit messages: Clear, descriptive, following conventional commits`,
    model: 'haiku'
  },

  // Linear integration agent - manages issue tracking
  'linear-ops': {
    description: 'Manages Linear issue status updates and comments. Use to update progress.',
    tools: ['mcp__linear__update_issue_status', 'mcp__linear__add_comment', 'mcp__linear__link_pr_to_issue', 'mcp__linear__assign_to_human'],
    prompt: `You are a project management specialist. Your job is to:
1. Update issue status (Todo → In Progress → In Review → Done)
2. Add progress comments
3. Link PRs to issues
4. Escalate blockers when needed

Keep stakeholders informed with clear, concise updates.`,
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
 * Build the task prompt for an issue
 */
function buildTaskPrompt(issue: Issue, attemptNumber: number): string {
  let prompt = `## Task: ${issue.identifier} - ${issue.title}

${issue.description || 'No description provided.'}

---

## Workflow

1. **Update Linear** - Move issue to "In Progress" and add a starting comment

2. **Explore** - Use the code-explorer subagent to understand:
   - Relevant files and dependencies
   - Existing patterns to follow
   - Potential impacts

3. **Plan** - Think through the implementation approach

4. **Implement** - Use the implementer subagent to write code:
   - Follow existing patterns
   - Handle edge cases
   - Add documentation

5. **Test** - Use the tester subagent to verify:
   - Run \`npm run typecheck\`
   - Run \`npm run build\`
   - Run tests if they exist

6. **Commit & PR** - Use the git-ops subagent:
   - Create feature branch: feature/${issue.identifier.toLowerCase()}-description
   - Commit with clear message
   - Push and create PR

7. **Update Linear** - Move to "In Review" and link the PR

Issue URL: ${issue.url}`;

  if (attemptNumber > 1) {
    prompt += `

---

⚠️ **Note:** This is attempt ${attemptNumber}/${MAX_RETRIES}.
Previous attempts failed. Focus on understanding why and fixing the root cause.
Consider using the code-explorer subagent to investigate the failure.`;
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
      prompt: `Escalate issue ${issue.identifier} to a human.

Reason: ${reason}

1. Add a detailed comment explaining what was attempted and why it failed
2. Assign the issue to a human team member
3. Update the issue priority to urgent`,
      options: {
        model: 'claude-sonnet-4-5',
        mcpServers: { linear: linearServer },
        agents: { 'linear-ops': SUBAGENTS['linear-ops'] }
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
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Home Service Dev Agent - Multi-Agent Architecture');
  console.log('='.repeat(60));
  console.log(`Working Directory: ${WORKING_DIR}`);
  console.log(`Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`Max Retries: ${MAX_RETRIES}`);
  console.log(`Subagents: ${Object.keys(SUBAGENTS).join(', ')}`);
  console.log('='.repeat(60) + '\n');

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

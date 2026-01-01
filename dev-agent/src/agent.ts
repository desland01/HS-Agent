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
import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 3; // Circuit breaker - stop after this many failures
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

// Path for session progress log (advisory only - Linear is source of truth)
const PROGRESS_PATH = path.join(process.cwd(), 'claude-progress.txt');

/**
 * Session Startup Protocol
 * Per Anthropic best practices: verify state before starting work
 *
 * Note: Linear is the source of truth for tasks.
 * features.json and claude-progress.txt are advisory/logging only.
 */
async function sessionStartup(): Promise<void> {
  console.log('\n📋 Session Startup Protocol...');

  // 1. Read claude-progress.txt (advisory - for context)
  try {
    const progress = await fs.readFile(PROGRESS_PATH, 'utf-8');
    const sessionCount = (progress.match(/### Session:/g) || []).length;
    console.log(`   Progress: ${sessionCount} previous sessions logged`);
  } catch (err) {
    console.log('   Progress: No progress file found (fresh start)');
  }

  // 2. Get last few git commits for context
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git log -3 --oneline', { cwd: WORKING_DIR });
    console.log(`   Recent commits:\n${stdout.split('\n').map(l => '     ' + l).join('\n')}`);
  } catch (err) {
    console.log('   Git: Could not read commit history');
  }

  // 3. Query Linear for current queue status
  try {
    const viewer = await linearClient.viewer;
    const todoIssues = await linearClient.issues({
      filter: {
        assignee: { id: { eq: viewer.id } },
        state: { name: { eq: 'Todo' } }
      },
      first: 100
    });
    console.log(`   Linear: ${todoIssues.nodes.length} issues in Todo queue`);
  } catch (err) {
    console.log('   Linear: Could not fetch queue status');
  }
}

/**
 * Session Handoff Protocol
 * Per Anthropic best practices: save state for next session
 *
 * CRITICAL: Returns true only if Linear status was successfully updated
 * This prevents the infinite loop bug where tasks stay in Todo queue
 */
async function sessionHandoff(
  issue: Issue,
  success: boolean,
  prUrl?: string
): Promise<boolean> {
  console.log('\n📝 Session Handoff Protocol...');
  const timestamp = new Date().toISOString();

  // 1. Append to claude-progress.txt (advisory, not critical)
  try {
    const entry = `
### Session: ${timestamp}
**Issue:** ${issue.identifier} - ${issue.title}
**Status:** ${success ? 'completed' : 'failed'}
**Summary:** ${success ? 'Task completed successfully.' : 'Task failed after retries.'}
**Files Modified:** ${sessionState.filesModified.join(', ') || 'none'}
**Tools Used:** ${sessionState.toolsUsed.length}
**Duration:** ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s
${prUrl ? `**PR:** ${prUrl}` : ''}
---
`;
    await fs.appendFile(PROGRESS_PATH, entry);
    console.log('   Appended session to claude-progress.txt');
  } catch (err) {
    console.error('   Failed to update progress file:', err);
    // Non-critical, continue
  }

  // 2. CRITICAL: Update Linear status to remove from Todo queue
  // This MUST succeed or we return false to trigger circuit breaker
  if (success) {
    try {
      const linearIssue = await linearClient.issue(issue.id);
      if (!linearIssue) {
        console.error('   CRITICAL: Could not fetch issue from Linear');
        return false;
      }

      const team = await linearIssue.team;
      const states = await team?.states();
      const doneState = states?.nodes.find(s => s.name.toLowerCase() === 'done');

      if (!doneState) {
        console.error('   CRITICAL: Could not find Done state in Linear');
        return false;
      }

      // Update the issue status
      await linearClient.updateIssue(issue.id, { stateId: doneState.id });
      console.log(`   Linear: Moved ${issue.identifier} to Done`);

      // VERIFICATION: Re-fetch and confirm the status changed
      const verifyIssue = await linearClient.issue(issue.id);
      const verifyState = await verifyIssue.state;

      if (verifyState?.name?.toLowerCase() !== 'done') {
        console.error(`   CRITICAL: Linear verification failed - issue still in "${verifyState?.name}" state`);
        return false;
      }

      console.log(`   VERIFIED: ${issue.identifier} is now in Done state`);

      // Add completion comment (non-critical)
      try {
        await linearClient.createComment({
          issueId: issue.id,
          body: `## ✅ Task Completed\n\n**Duration:** ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s\n**Tools Used:** ${sessionState.toolsUsed.length}\n${prUrl ? `**PR:** ${prUrl}` : ''}\n\n---\n*Completed by dev-agent*`
        });
      } catch (commentErr) {
        console.error('   Warning: Failed to add completion comment:', commentErr);
        // Non-critical, continue
      }

      return true;

    } catch (err) {
      console.error('   CRITICAL: Failed to update Linear status:', err);
      return false;
    }
  }

  // Task failed - no Linear update needed, just return true to continue
  // The issue stays in Todo for retry
  return true;
}

/**
 * Specialized Subagents - Minimal prompts for speed/context efficiency
 */
const SUBAGENTS: Record<string, AgentDefinition> = {
  // Exploration - find relevant files and patterns
  'explorer': {
    description: 'Find relevant files and understand codebase patterns. Use first.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    prompt: 'Find relevant files, identify patterns, report concisely.',
    model: 'opus'
  },

  // Think tool for complex decisions (per Anthropic best practices)
  'thinker': {
    description: 'Analyze complex problems before acting. Use for architecture decisions or when unsure.',
    tools: ['Read', 'Grep', 'Glob'],
    prompt: `Think step by step before deciding:
1. What are the options?
2. What are the tradeoffs?
3. What's the safest approach?
Return: recommended action with reasoning.`,
    model: 'opus'
  },

  // Code implementation
  'coder': {
    description: 'Write/edit code following existing patterns.',
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    prompt: 'Write clean TypeScript. Match existing style. Handle edge cases.',
    model: 'opus'
  },

  // Git + verification combined (reduces agent switching)
  'ship': {
    description: 'Verify build, commit, push, create PR. Use when code is ready.',
    tools: ['Bash', 'Read'],
    prompt: 'Run verify_build. If pass: use complete_feature tool. Report PR URL.',
    model: 'opus'
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
3. thinker → if architecture decisions needed
4. coder → implement changes
5. ship → verify_build, complete_feature, complete_task

## Tools
- verify_build: typecheck + build in one call
- complete_feature: branch + commit + push + PR in one call
- complete_task: Linear status + comment + PR link in one call`;

  if (attemptNumber > 1) {
    prompt += `\n\n⚠️ Attempt ${attemptNumber}/${MAX_RETRIES}. Use thinker first to analyze failure.`;
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
 *
 * Features:
 * - Circuit breaker: stops after MAX_CONSECUTIVE_FAILURES to prevent runaway costs
 * - Linear as source of truth (no features.json dependency)
 * - Verified handoff: confirms Linear status update before continuing
 */
export async function runAgent(): Promise<void> {
  console.log('\n🤖 Dev Agent v4 | Circuit Breaker Enabled');
  console.log(`   Agents: ${Object.keys(SUBAGENTS).join(', ')}`);
  console.log(`   Dir: ${WORKING_DIR}`);
  console.log(`   Poll: ${POLL_INTERVAL_MS / 1000}s | Retries: ${MAX_RETRIES}`);
  console.log(`   Circuit Breaker: ${MAX_CONSECUTIVE_FAILURES} consecutive failures\n`);

  // Session startup - read previous state (advisory only)
  await sessionStartup();

  // Initialize repository
  console.log('\n📁 Initializing repository...');
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

  // Circuit breaker tracking
  let consecutiveFailures = 0;
  let lastProcessedIssue: string | null = null;

  // Main loop
  console.log('\n🔄 Starting main loop...\n');

  while (true) {
    try {
      console.log('\n--- Checking for new tasks ---');

      // Fetch todo issues directly from Linear (source of truth)
      const viewer = await linearClient.viewer;
      const issues = await linearClient.issues({
        filter: {
          assignee: { id: { eq: viewer.id } },
          state: { name: { eq: 'Todo' } }
        },
        first: 10
      });

      // Map and sort by issue number (GRO-9 before GRO-44)
      const issueList: Issue[] = issues.nodes
        .map(issue => ({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description || undefined,
          url: issue.url
        }))
        .sort((a, b) => {
          const numA = parseInt(a.identifier.split('-')[1]) || 0;
          const numB = parseInt(b.identifier.split('-')[1]) || 0;
          return numA - numB;
        });

      console.log(`Found ${issueList.length} issue(s) assigned to ${viewer.name}`);

      if (issueList.length === 0) {
        console.log('📭 No tasks in queue. Waiting...');
        consecutiveFailures = 0; // Reset on empty queue
      } else {
        // Process the first issue
        const issue = issueList[0];

        // Circuit breaker: detect if we're stuck on the same issue
        if (lastProcessedIssue === issue.identifier) {
          consecutiveFailures++;
          console.log(`⚠️ Same issue again: ${issue.identifier} (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED`);
            console.error(`   Processed ${issue.identifier} ${consecutiveFailures} times`);
            console.error(`   Issue is stuck in Todo queue - Linear update may be failing`);
            console.error(`   STOPPING to prevent runaway costs\n`);

            // Add a comment to the issue explaining why we stopped
            try {
              await linearClient.createComment({
                issueId: issue.id,
                body: `## 🛑 Circuit Breaker Triggered\n\nDev agent has stopped after ${consecutiveFailures} consecutive attempts on this issue.\n\n**Possible causes:**\n- Linear API failing to update status\n- Task completing but status not moving to Done\n- Network issues\n\n**Action required:** Manual review needed.\n\n---\n*Circuit breaker triggered by dev-agent*`
              });
            } catch (commentErr) {
              console.error('Could not add circuit breaker comment:', commentErr);
            }

            // Exit the loop entirely
            break;
          }
        } else {
          consecutiveFailures = 0; // Reset when processing a new issue
        }

        lastProcessedIssue = issue.identifier;

        const success = await processIssue(issue);

        // Session handoff - MUST return true for Linear update
        const handoffSuccess = await sessionHandoff(issue, success);

        if (!handoffSuccess) {
          console.error(`\n⚠️ HANDOFF FAILED: Linear status not updated for ${issue.identifier}`);
          consecutiveFailures++;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED: Linear updates failing`);
            console.error(`   Stopping to prevent infinite loop\n`);
            break;
          }
        } else if (success) {
          console.log(`\n✅ Completed and verified: ${issue.identifier}`);
          consecutiveFailures = 0; // Reset on verified success
        } else {
          console.log(`\n❌ Failed: ${issue.identifier} (escalated to human)`);
          // Don't reset consecutiveFailures - task failures count toward breaker
        }
      }

      // Wait before checking again
      console.log(`\n⏰ Waiting ${POLL_INTERVAL_MS / 1000}s before next check...`);
      await sleep(POLL_INTERVAL_MS);

    } catch (error) {
      console.error('❌ Error in main loop:', error);
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED: Too many errors`);
        break;
      }

      console.log('🔄 Recovering in 60 seconds...');
      await sleep(60000);
    }
  }

  // If we exit the loop, log final state
  console.log('\n========================================');
  console.log('DEV AGENT STOPPED');
  console.log(`Consecutive failures: ${consecutiveFailures}`);
  console.log(`Last issue: ${lastProcessedIssue || 'none'}`);
  console.log('Check Railway logs and Linear for details.');
  console.log('========================================\n');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

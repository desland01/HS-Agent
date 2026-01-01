/**
 * Autonomous Dev Agent
 *
 * This agent runs 24/7 on Railway, pulling tasks from Linear and implementing them.
 *
 * Development Loop:
 * 1. Fetch highest priority "Todo" issue from Linear
 * 2. Move to "In Progress", add comment "Starting work..."
 * 3. Read issue description and acceptance criteria
 * 4. Explore codebase to understand context
 * 5. Implement solution (write code)
 * 6. Run tests/build
 * 7. If pass: commit, push, create PR, move to "Review"
 * 8. If fail: retry up to 3 times, then escalate
 * 9. Repeat
 */

import { query, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { LinearClient } from '@linear/sdk';
import { linearServer } from './tools/linear.js';
import { gitServer, setWorkingDirectory as setGitDir } from './tools/git.js';
import { bashServer, setWorkingDirectory as setBashDir } from './tools/bash.js';

// Direct Linear client for fetching issues (more reliable than going through Claude)
const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!
});

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 30000; // 30 seconds between task checks
const WORKING_DIR = process.env.WORKING_DIRECTORY || process.cwd();

// Set working directories for tools
setGitDir(WORKING_DIR);
setBashDir(WORKING_DIR);

/**
 * Extract text content from an SDK message
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

interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
}

/**
 * System prompt for the dev agent
 */
const DEV_AGENT_SYSTEM_PROMPT = `You are an autonomous software development agent working on the Home Service SaaS platform.

## Your Role
You are a skilled TypeScript/Node.js developer implementing features and fixing bugs based on Linear issues.

## Working Directory
All code changes should be made in the repository at: ${WORKING_DIR}

## Development Workflow
1. **Understand the Task**: Read the issue description carefully. Identify acceptance criteria.
2. **Explore**: Use Read, Grep, and Glob to understand the codebase context.
3. **Plan**: Think through the implementation approach before coding.
4. **Implement**: Write clean, well-structured TypeScript code following existing patterns.
5. **Test**: Run npm test and npm run build to verify changes.
6. **Commit**: Create atomic commits with clear messages.
7. **PR**: Create a pull request with a summary of changes.

## Code Standards
- Follow existing code patterns in the codebase
- Use TypeScript with strict typing
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write tests for new functionality

## Git Workflow
- Always work on a feature branch (never commit to main)
- Branch naming: feature/{issue-id}-{short-description}
- Commit messages: Clear and descriptive
- Create PR when ready for review

## Error Handling
- If tests fail, analyze the error and fix it
- If stuck after 3 attempts, escalate to human with detailed notes
- Never force push or make destructive changes without approval

## Communication
- Update Linear issue with progress comments
- Document any blockers or questions in comments
- Link PRs to issues when created

Remember: Quality over speed. It's better to escalate than to merge broken code.`;

/**
 * Process a single issue
 */
async function processIssue(issue: Issue): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${issue.identifier} - ${issue.title}`);
  console.log(`${'='.repeat(60)}\n`);

  let retryCount = 0;
  let success = false;

  while (retryCount < MAX_RETRIES && !success) {
    try {
      retryCount++;
      console.log(`Attempt ${retryCount}/${MAX_RETRIES}`);

      // Build the prompt for this task
      const taskPrompt = buildTaskPrompt(issue, retryCount);

      // Run the agent
      const response = query({
        prompt: taskPrompt,
        options: {
          model: 'claude-sonnet-4-5',
          cwd: WORKING_DIR,
          systemPrompt: DEV_AGENT_SYSTEM_PROMPT,
          permissionMode: 'acceptEdits', // Auto-approve file edits
          mcpServers: {
            linear: linearServer,
            git: gitServer,
            bash: bashServer
          },
          // Allow all our custom tools plus standard file tools
          tools: [
            'Read', 'Write', 'Edit', 'Glob', 'Grep',
            'mcp__linear__get_assigned_issues',
            'mcp__linear__get_issue_details',
            'mcp__linear__update_issue_status',
            'mcp__linear__add_comment',
            'mcp__linear__create_sub_issue',
            'mcp__linear__assign_to_human',
            'mcp__linear__link_pr_to_issue',
            'mcp__git__git_status',
            'mcp__git__git_create_branch',
            'mcp__git__git_checkout',
            'mcp__git__git_add',
            'mcp__git__git_commit',
            'mcp__git__git_push',
            'mcp__git__create_pull_request',
            'mcp__git__git_diff',
            'mcp__git__git_log',
            'mcp__git__git_stash',
            'mcp__bash__execute',
            'mcp__bash__npm_run',
            'mcp__bash__npm_install',
            'mcp__bash__which',
            'mcp__bash__get_env'
          ]
        }
      });

      // Process the response stream
      for await (const message of response) {
        switch (message.type) {
          case 'assistant':
            const content = getMessageContent(message);
            if (content) console.log('Agent:', content);
            break;
          case 'result':
            if (message.subtype === 'success') {
              console.log('Task completed successfully');
              success = true;
            } else {
              console.error('Task failed:', message.errors);
              throw new Error(`Agent error: ${message.errors?.join(', ')}`);
            }
            break;
          case 'system':
            if (message.subtype === 'init') {
              console.log(`Session started: ${message.session_id}`);
            }
            break;
          case 'tool_progress':
            console.log(`Tool in progress: ${message.tool_name} (${message.elapsed_time_seconds}s)`);
            break;
        }
      }

    } catch (error) {
      console.error(`Attempt ${retryCount} failed:`, error);

      if (retryCount >= MAX_RETRIES) {
        // Escalate to human
        console.log('Max retries reached, escalating to human...');
        await escalateToHuman(issue, error);
      } else {
        console.log(`Retrying in 10 seconds...`);
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

## Instructions

1. First, update the Linear issue status to "In Progress" and add a comment that you're starting work.

2. Explore the codebase to understand the context:
   - Read relevant files
   - Understand existing patterns
   - Identify files that need to be modified

3. Implement the required changes:
   - Follow existing code patterns
   - Write clean, well-documented code
   - Handle edge cases

4. Verify your changes:
   - Run \`npm run typecheck\` to check types
   - Run \`npm run build\` to verify build
   - Run \`npm test\` if tests exist

5. If all checks pass:
   - Create a feature branch: feature/${issue.identifier.toLowerCase()}-{short-description}
   - Stage and commit your changes
   - Push to remote
   - Create a pull request
   - Update Linear issue to "Review" status
   - Add a comment with the PR link

6. If checks fail:
   - Analyze the error
   - Fix the issue
   - Try again

Issue URL: ${issue.url}`;

  if (attemptNumber > 1) {
    prompt += `\n\n**Note:** This is attempt ${attemptNumber}/${MAX_RETRIES}. Previous attempts failed. Focus on understanding why and fixing the root cause.`;
  }

  return prompt;
}

/**
 * Escalate issue to human after max retries
 */
async function escalateToHuman(issue: Issue, error: unknown): Promise<void> {
  const reason = `Failed after ${MAX_RETRIES} attempts.\n\nLast error:\n\`\`\`\n${error}\n\`\`\``;

  // Use the Linear tool directly to escalate
  const response = query({
    prompt: `Escalate issue ${issue.identifier} to a human with this reason: ${reason}`,
    options: {
      model: 'claude-sonnet-4-5',
      mcpServers: { linear: linearServer },
      tools: ['mcp__linear__assign_to_human', 'mcp__linear__add_comment', 'mcp__linear__update_issue_status']
    }
  });

  for await (const message of response) {
    if (message.type === 'assistant') {
      const content = getMessageContent(message);
      if (content) console.log('Escalation:', content);
    }
  }
}

/**
 * Main agent loop
 */
export async function runAgent(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Home Service Dev Agent Starting');
  console.log(`Working Directory: ${WORKING_DIR}`);
  console.log(`Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`Max Retries: ${MAX_RETRIES}`);
  console.log('='.repeat(60));

  // Ensure we're on main and up to date
  console.log('\nInitializing repository...');
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
      tools: ['mcp__git__git_status', 'mcp__git__git_checkout', 'mcp__bash__execute']
    }
  });

  for await (const message of initResponse) {
    if (message.type === 'assistant') {
      const content = getMessageContent(message);
      if (content) console.log(content);
    }
  }

  // Main loop
  while (true) {
    try {
      console.log('\n--- Checking for new tasks ---');

      // Fetch todo issues directly from Linear (more reliable)
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
        console.log('No tasks in queue. Waiting...');
      } else {
        console.log(`Found ${issueList.length} task(s)`);

        // Process the highest priority issue
        const issue = issueList[0];
        const success = await processIssue(issue);

        if (success) {
          console.log(`\nCompleted: ${issue.identifier}`);
        } else {
          console.log(`\nFailed: ${issue.identifier} (escalated)`);
        }
      }

      // Wait before checking again
      console.log(`\nWaiting ${POLL_INTERVAL_MS / 1000}s before next check...`);
      await sleep(POLL_INTERVAL_MS);

    } catch (error) {
      console.error('Error in main loop:', error);
      console.log('Recovering in 60 seconds...');
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

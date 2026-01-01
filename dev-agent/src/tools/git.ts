/**
 * Git Tools for Dev Agent
 *
 * These tools allow the agent to perform git operations:
 * - Create branches
 * - Commit changes
 * - Push to remote
 * - Create pull requests (via gh CLI)
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Working directory for git operations (set dynamically)
let workingDir = process.cwd();

export function setWorkingDirectory(dir: string) {
  workingDir = dir;
}

async function runGitCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(command, { cwd: workingDir, maxBuffer: 10 * 1024 * 1024 });
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.message}\nStderr: ${error.stderr}`);
  }
}

/**
 * Git MCP Server with all tools
 */
export const gitServer = createSdkMcpServer({
  name: 'git',
  version: '1.0.0',
  tools: [
    // Get current branch and status
    tool(
      'git_status',
      'Get the current git status including branch name, modified files, and staged changes.',
      {},
      async () => {
        try {
          const branch = await runGitCommand('git branch --show-current');
          const status = await runGitCommand('git status --porcelain');
          const lastCommit = await runGitCommand('git log -1 --oneline');

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                currentBranch: branch.stdout.trim(),
                lastCommit: lastCommit.stdout.trim(),
                modifiedFiles: status.stdout.trim().split('\n').filter(Boolean)
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error getting git status: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Create a new branch
    tool(
      'git_create_branch',
      'Create a new git branch from the current HEAD or specified base branch.',
      {
        branchName: z.string()
          .regex(/^[a-z0-9-_/]+$/i, 'Branch name can only contain letters, numbers, hyphens, underscores, and slashes')
          .describe('Name of the new branch'),
        baseBranch: z.string().optional()
          .describe('Base branch to create from (defaults to current branch)')
      },
      async (args) => {
        try {
          // Fetch latest
          await runGitCommand('git fetch origin');

          if (args.baseBranch) {
            await runGitCommand(`git checkout ${args.baseBranch}`);
            await runGitCommand(`git pull origin ${args.baseBranch}`);
          }

          await runGitCommand(`git checkout -b ${args.branchName}`);

          return {
            content: [{
              type: 'text',
              text: `Created and switched to branch: ${args.branchName}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error creating branch: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Switch to existing branch
    tool(
      'git_checkout',
      'Switch to an existing git branch.',
      {
        branchName: z.string().describe('Name of the branch to switch to')
      },
      async (args) => {
        try {
          await runGitCommand(`git checkout ${args.branchName}`);
          return {
            content: [{
              type: 'text',
              text: `Switched to branch: ${args.branchName}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error switching branch: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Stage files
    tool(
      'git_add',
      'Stage files for commit. Use "." to stage all changes.',
      {
        files: z.string()
          .describe('Files to stage (space-separated paths, or "." for all)')
      },
      async (args) => {
        try {
          await runGitCommand(`git add ${args.files}`);
          const status = await runGitCommand('git status --porcelain');

          return {
            content: [{
              type: 'text',
              text: `Files staged. Current status:\n${status.stdout}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error staging files: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Commit changes
    tool(
      'git_commit',
      'Commit staged changes with a message. The commit message should be clear and descriptive.',
      {
        message: z.string()
          .min(5, 'Commit message must be at least 5 characters')
          .describe('Commit message describing the changes'),
        addAll: z.boolean().default(false)
          .describe('Stage all changes before committing (git commit -a)')
      },
      async (args) => {
        try {
          const addFlag = args.addAll ? '-a' : '';
          // Use HEREDOC-style commit to handle special characters
          const escapedMessage = args.message.replace(/'/g, "'\\''");
          await runGitCommand(`git commit ${addFlag} -m '${escapedMessage}'`);

          const lastCommit = await runGitCommand('git log -1 --oneline');

          return {
            content: [{
              type: 'text',
              text: `Committed: ${lastCommit.stdout.trim()}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error committing: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Push to remote
    tool(
      'git_push',
      'Push the current branch to the remote repository.',
      {
        setUpstream: z.boolean().default(true)
          .describe('Set upstream tracking (required for new branches)')
      },
      async (args) => {
        try {
          const branch = await runGitCommand('git branch --show-current');
          const branchName = branch.stdout.trim();

          const upstreamFlag = args.setUpstream ? `-u origin ${branchName}` : '';
          await runGitCommand(`git push ${upstreamFlag}`);

          return {
            content: [{
              type: 'text',
              text: `Pushed branch ${branchName} to origin`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error pushing: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Create pull request using gh CLI
    tool(
      'create_pull_request',
      'Create a GitHub pull request for the current branch using the gh CLI.',
      {
        title: z.string()
          .min(5, 'PR title must be at least 5 characters')
          .describe('Title of the pull request'),
        body: z.string()
          .describe('Body/description of the pull request (supports markdown)'),
        baseBranch: z.string().default('main')
          .describe('Base branch to merge into'),
        draft: z.boolean().default(false)
          .describe('Create as draft PR')
      },
      async (args) => {
        try {
          // First ensure we've pushed
          const branch = await runGitCommand('git branch --show-current');
          const branchName = branch.stdout.trim();

          // Create PR using gh CLI
          const draftFlag = args.draft ? '--draft' : '';
          const escapedTitle = args.title.replace(/'/g, "'\\''");
          const escapedBody = args.body.replace(/'/g, "'\\''");

          const result = await runGitCommand(
            `gh pr create --title '${escapedTitle}' --body '${escapedBody}' --base ${args.baseBranch} ${draftFlag}`
          );

          // Extract PR URL from output
          const prUrl = result.stdout.trim().split('\n').pop();

          return {
            content: [{
              type: 'text',
              text: `Pull request created: ${prUrl}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error creating PR: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Get diff
    tool(
      'git_diff',
      'Show the diff of changes. Can show staged, unstaged, or all changes.',
      {
        staged: z.boolean().default(false)
          .describe('Show only staged changes'),
        file: z.string().optional()
          .describe('Specific file to show diff for')
      },
      async (args) => {
        try {
          const stagedFlag = args.staged ? '--cached' : '';
          const fileArg = args.file || '';
          const result = await runGitCommand(`git diff ${stagedFlag} ${fileArg}`);

          return {
            content: [{
              type: 'text',
              text: result.stdout || 'No changes'
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error getting diff: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Get log
    tool(
      'git_log',
      'Show recent commit history.',
      {
        count: z.number().min(1).max(50).default(10)
          .describe('Number of commits to show'),
        oneline: z.boolean().default(true)
          .describe('Show one-line format')
      },
      async (args) => {
        try {
          const format = args.oneline ? '--oneline' : '--pretty=format:"%h %s (%an, %ar)"';
          const result = await runGitCommand(`git log -${args.count} ${format}`);

          return {
            content: [{
              type: 'text',
              text: result.stdout
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error getting log: ${error}` }],
            isError: true
          };
        }
      }
    ),

    // Stash changes
    tool(
      'git_stash',
      'Stash or pop stashed changes.',
      {
        action: z.enum(['push', 'pop', 'list']).default('push')
          .describe('Stash action: push (save), pop (restore), or list'),
        message: z.string().optional()
          .describe('Message for stash (only for push action)')
      },
      async (args) => {
        try {
          let command = 'git stash';
          if (args.action === 'push' && args.message) {
            command = `git stash push -m "${args.message}"`;
          } else if (args.action === 'pop') {
            command = 'git stash pop';
          } else if (args.action === 'list') {
            command = 'git stash list';
          }

          const result = await runGitCommand(command);

          return {
            content: [{
              type: 'text',
              text: result.stdout || `Stash ${args.action} completed`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error with stash: ${error}` }],
            isError: true
          };
        }
      }
    )
  ]
});

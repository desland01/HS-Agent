/**
 * Bash Execution Tool for Dev Agent
 *
 * Allows the agent to run shell commands for:
 * - Running tests
 * - Building projects
 * - Installing dependencies
 * - Other development tasks
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Working directory for bash operations (set dynamically)
let workingDir = process.cwd();

export function setWorkingDirectory(dir: string) {
  workingDir = dir;
}

// Commands that are explicitly blocked for safety
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf ~',
  'rm -rf /*',
  'mkfs',
  'dd if=/dev',
  '> /dev/sda',
  ':(){ :|:& };:',  // Fork bomb
  'chmod -R 777 /',
  'chown -R',
];

// Commands that require extra caution
const CAUTIOUS_COMMANDS = [
  'rm -rf',
  'rm -r',
  'git push --force',
  'git reset --hard',
  'DROP TABLE',
  'DELETE FROM',
  'TRUNCATE',
];

function isBlockedCommand(command: string): boolean {
  return BLOCKED_COMMANDS.some(blocked =>
    command.toLowerCase().includes(blocked.toLowerCase())
  );
}

function isCautiousCommand(command: string): boolean {
  return CAUTIOUS_COMMANDS.some(cautious =>
    command.toLowerCase().includes(cautious.toLowerCase())
  );
}

/**
 * Bash MCP Server
 */
export const bashServer = createSdkMcpServer({
  name: 'bash',
  version: '1.0.0',
  tools: [
    // Execute a bash command
    tool(
      'execute',
      'Execute a bash command in the working directory. Use for running tests, builds, npm commands, etc.',
      {
        command: z.string()
          .min(1, 'Command cannot be empty')
          .describe('The bash command to execute'),
        timeout: z.number().min(1000).max(600000).default(120000)
          .describe('Timeout in milliseconds (default: 2 minutes, max: 10 minutes)')
      },
      async (args) => {
        // Check for blocked commands
        if (isBlockedCommand(args.command)) {
          return {
            content: [{
              type: 'text',
              text: `BLOCKED: This command is not allowed for safety reasons: ${args.command}`
            }],
            isError: true
          };
        }

        // Warn about cautious commands but allow them
        let warning = '';
        if (isCautiousCommand(args.command)) {
          warning = '**Warning:** This is a potentially destructive command. Proceeding with caution.\n\n';
        }

        try {
          const { stdout, stderr } = await execAsync(args.command, {
            cwd: workingDir,
            timeout: args.timeout,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: {
              ...process.env,
              CI: 'true', // Helps some tools behave better in automated environments
              FORCE_COLOR: '0', // Disable color codes for cleaner output
            }
          });

          let output = '';
          if (stdout) output += `STDOUT:\n${stdout}\n`;
          if (stderr) output += `STDERR:\n${stderr}\n`;
          if (!output) output = 'Command completed with no output';

          return {
            content: [{
              type: 'text',
              text: warning + output
            }]
          };
        } catch (error: any) {
          // Handle timeout
          if (error.killed) {
            return {
              content: [{
                type: 'text',
                text: `Command timed out after ${args.timeout / 1000} seconds`
              }],
              isError: true
            };
          }

          // Return error with output for debugging
          let errorOutput = `Command failed with exit code ${error.code || 'unknown'}\n`;
          if (error.stdout) errorOutput += `STDOUT:\n${error.stdout}\n`;
          if (error.stderr) errorOutput += `STDERR:\n${error.stderr}\n`;
          if (error.message) errorOutput += `Error: ${error.message}\n`;

          return {
            content: [{
              type: 'text',
              text: errorOutput
            }],
            isError: true
          };
        }
      }
    ),

    // Run npm/yarn/pnpm commands
    tool(
      'npm_run',
      'Run an npm script defined in package.json (e.g., test, build, lint).',
      {
        script: z.string()
          .describe('The npm script to run (e.g., "test", "build", "lint")'),
        packageManager: z.enum(['npm', 'yarn', 'pnpm']).default('npm')
          .describe('Package manager to use')
      },
      async (args) => {
        try {
          const runCmd = args.packageManager === 'npm' ? 'npm run' : `${args.packageManager} run`;
          const { stdout, stderr } = await execAsync(`${runCmd} ${args.script}`, {
            cwd: workingDir,
            timeout: 300000, // 5 minutes for build/test
            maxBuffer: 10 * 1024 * 1024,
            env: {
              ...process.env,
              CI: 'true',
              FORCE_COLOR: '0',
            }
          });

          let output = '';
          if (stdout) output += stdout;
          if (stderr) output += `\n${stderr}`;

          return {
            content: [{
              type: 'text',
              text: output || `${args.script} completed successfully`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: `npm run ${args.script} failed:\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message || ''}`
            }],
            isError: true
          };
        }
      }
    ),

    // Install dependencies
    tool(
      'npm_install',
      'Install npm dependencies. Can install all dependencies or specific packages.',
      {
        packages: z.string().optional()
          .describe('Specific packages to install (space-separated). Leave empty to install all.'),
        dev: z.boolean().default(false)
          .describe('Install as dev dependency'),
        packageManager: z.enum(['npm', 'yarn', 'pnpm']).default('npm')
          .describe('Package manager to use')
      },
      async (args) => {
        try {
          let command = '';
          if (args.packageManager === 'npm') {
            command = args.packages
              ? `npm install ${args.dev ? '--save-dev' : ''} ${args.packages}`
              : 'npm install';
          } else if (args.packageManager === 'yarn') {
            command = args.packages
              ? `yarn add ${args.dev ? '--dev' : ''} ${args.packages}`
              : 'yarn install';
          } else {
            command = args.packages
              ? `pnpm add ${args.dev ? '--save-dev' : ''} ${args.packages}`
              : 'pnpm install';
          }

          const { stdout, stderr } = await execAsync(command, {
            cwd: workingDir,
            timeout: 300000, // 5 minutes for install
            maxBuffer: 10 * 1024 * 1024,
          });

          return {
            content: [{
              type: 'text',
              text: `Dependencies installed successfully\n${stdout}`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: `Install failed:\n${error.stderr || error.message}`
            }],
            isError: true
          };
        }
      }
    ),

    // Check if a command exists
    tool(
      'which',
      'Check if a command/binary exists and get its path.',
      {
        command: z.string().describe('Command name to check')
      },
      async (args) => {
        try {
          const { stdout } = await execAsync(`which ${args.command}`);
          return {
            content: [{
              type: 'text',
              text: `${args.command} found at: ${stdout.trim()}`
            }]
          };
        } catch {
          return {
            content: [{
              type: 'text',
              text: `${args.command} not found in PATH`
            }],
            isError: true
          };
        }
      }
    ),

    // Get environment variable
    tool(
      'get_env',
      'Get the value of an environment variable.',
      {
        name: z.string().describe('Name of the environment variable')
      },
      async (args) => {
        const value = process.env[args.name];
        if (value) {
          // Mask sensitive values
          const sensitiveKeys = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL'];
          const isSensitive = sensitiveKeys.some(k => args.name.toUpperCase().includes(k));

          return {
            content: [{
              type: 'text',
              text: isSensitive
                ? `${args.name} = [REDACTED - ${value.length} chars]`
                : `${args.name} = ${value}`
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: `${args.name} is not set`
          }]
        };
      }
    ),

    // CONSOLIDATED: Verify code quality before committing
    tool(
      'verify_build',
      'Run typecheck and build to verify code quality. Use before committing changes. Returns concise pass/fail status with error details only on failure.',
      {
        skipTypecheck: z.boolean().default(false)
          .describe('Skip TypeScript type checking'),
        skipBuild: z.boolean().default(false)
          .describe('Skip build step'),
        runTests: z.boolean().default(false)
          .describe('Also run tests (npm test)')
      },
      async (args) => {
        const results: { step: string; status: 'pass' | 'fail'; output?: string }[] = [];

        // Step 1: Typecheck
        if (!args.skipTypecheck) {
          try {
            await execAsync('npm run typecheck', {
              cwd: workingDir,
              timeout: 120000,
              maxBuffer: 10 * 1024 * 1024,
            });
            results.push({ step: 'typecheck', status: 'pass' });
          } catch (error: any) {
            // Extract only the error lines, not all output
            const errorLines = (error.stdout || error.stderr || error.message)
              .split('\n')
              .filter((line: string) => line.includes('error') || line.includes('Error'))
              .slice(0, 10) // Limit to first 10 errors
              .join('\n');

            results.push({
              step: 'typecheck',
              status: 'fail',
              output: errorLines || 'Type check failed. Run `npm run typecheck` for details.'
            });
          }
        }

        // Step 2: Build
        if (!args.skipBuild && !results.some(r => r.status === 'fail')) {
          try {
            await execAsync('npm run build', {
              cwd: workingDir,
              timeout: 180000,
              maxBuffer: 10 * 1024 * 1024,
            });
            results.push({ step: 'build', status: 'pass' });
          } catch (error: any) {
            const errorLines = (error.stdout || error.stderr || error.message)
              .split('\n')
              .filter((line: string) => line.includes('error') || line.includes('Error'))
              .slice(0, 10)
              .join('\n');

            results.push({
              step: 'build',
              status: 'fail',
              output: errorLines || 'Build failed. Run `npm run build` for details.'
            });
          }
        }

        // Step 3: Tests (optional)
        if (args.runTests && !results.some(r => r.status === 'fail')) {
          try {
            await execAsync('npm test', {
              cwd: workingDir,
              timeout: 300000,
              maxBuffer: 10 * 1024 * 1024,
            });
            results.push({ step: 'test', status: 'pass' });
          } catch (error: any) {
            const errorLines = (error.stdout || error.stderr || error.message)
              .split('\n')
              .filter((line: string) =>
                line.includes('FAIL') ||
                line.includes('Error') ||
                line.includes('✗') ||
                line.includes('AssertionError')
              )
              .slice(0, 15)
              .join('\n');

            results.push({
              step: 'test',
              status: 'fail',
              output: errorLines || 'Tests failed. Run `npm test` for details.'
            });
          }
        }

        // Format response
        const allPassed = results.every(r => r.status === 'pass');
        const failedResults = results.filter(r => r.status === 'fail');

        if (allPassed) {
          return {
            content: [{
              type: 'text',
              text: `✅ All checks passed: ${results.map(r => r.step).join(', ')}`
            }]
          };
        } else {
          const errorReport = failedResults
            .map(r => `### ${r.step} FAILED\n\`\`\`\n${r.output}\n\`\`\``)
            .join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `❌ Verification failed\n\n${errorReport}\n\n**Fix the errors above before committing.**`
            }],
            isError: true
          };
        }
      }
    )
  ]
});

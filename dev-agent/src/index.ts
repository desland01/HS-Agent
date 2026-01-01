/**
 * Home Service Dev Agent - Entry Point
 *
 * This autonomous agent runs 24/7 on Railway, pulling tasks from Linear
 * and implementing them in the Home Service SaaS codebase.
 *
 * Environment Variables Required:
 * - ANTHROPIC_API_KEY: Claude API key
 * - LINEAR_API_KEY: Linear API key
 * - WORKING_DIRECTORY: Path to the cloned repository (default: /app/repo)
 * - GITHUB_TOKEN: For creating PRs (used by gh CLI)
 */

import { runAgent } from './agent.js';

// Validate required environment variables
const requiredEnvVars = ['ANTHROPIC_API_KEY', 'LINEAR_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach(v => console.error(`  - ${v}`));
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit - let the agent recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit - let the agent recover
});

// Start the agent
console.log(`
╔═══════════════════════════════════════════════════════════╗
║           HOME SERVICE DEV AGENT v1.0.0                   ║
║                                                           ║
║  Autonomous development agent for Home Service SaaS      ║
║  Powered by Claude Agent SDK                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

runAgent().catch(error => {
  console.error('Fatal agent error:', error);
  process.exit(1);
});

/**
 * Tool Registry
 *
 * With Claude Agent SDK, tools are handled differently:
 * - File operations: Built-in (Read, Glob, Grep, Bash)
 * - Linear operations: MCP server (see linear-mcp.ts)
 *
 * This file re-exports utilities for backwards compatibility.
 */

// Linear MCP server and client initialization
export { initializeLinearClient, createLinearMcpServer } from './linear-mcp.js';

// Working directory is now managed in agent.ts
// Re-export for any code that still references this module
export { setWorkingDirectory, getWorkingDirectory } from '../agent.js';

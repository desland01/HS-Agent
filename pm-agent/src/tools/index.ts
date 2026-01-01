/**
 * Tool Registry
 * Central registry for all agent tools
 */

import type Anthropic from '@anthropic-ai/sdk';
import { linearTools, executeLinearTool, initializeLinear } from './linear.js';

// Re-export Linear tools
export { initializeLinear } from './linear.js';

// All available tools
export const allTools: Anthropic.Tool[] = [...linearTools];

// Tool categories for selective loading
export const toolCategories = {
  linear: linearTools,
} as const;

// Execute any registered tool
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  // Route to appropriate executor
  if (toolName.startsWith('linear_')) {
    return executeLinearTool(toolName, input);
  }

  return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
}

// Get tools by category
export function getToolsByCategory(categories: (keyof typeof toolCategories)[]): Anthropic.Tool[] {
  return categories.flatMap(cat => toolCategories[cat]);
}

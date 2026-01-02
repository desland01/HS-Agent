/**
 * Agent Memory System
 * Maintains persistent context across sessions for deeper alignment
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_PATH = join(__dirname, '../.claude/memory.md');

// Memory categories
export type MemoryCategory =
  | 'vision'      // Vision & Goals
  | 'decisions'   // Decisions & Rationale
  | 'preferences' // Preferences & Patterns
  | 'history'     // Project History
  | 'insights';   // Session Insights

interface MemoryEntry {
  category: MemoryCategory;
  content: string;
  timestamp: string;
}

/**
 * Load memory content from file
 */
export function loadMemory(): string {
  if (!existsSync(MEMORY_PATH)) {
    return '';
  }
  return readFileSync(MEMORY_PATH, 'utf-8');
}

/**
 * Format memory for inclusion in system prompt
 * Returns a condensed version focusing on key insights
 */
export function formatMemoryForPrompt(): string {
  const memory = loadMemory();
  if (!memory || memory.includes('*No entries yet.*')) {
    return '';
  }

  // Extract non-empty sections
  const sections: string[] = [];

  const visionMatch = memory.match(/## Vision & Goals\n\n([\s\S]*?)(?=\n---)/);
  const decisionsMatch = memory.match(/## Decisions & Rationale\n\n([\s\S]*?)(?=\n---)/);
  const preferencesMatch = memory.match(/## Preferences & Patterns\n\n([\s\S]*?)(?=\n---)/);
  const historyMatch = memory.match(/## Project History\n\n([\s\S]*?)(?=\n---)/);
  const insightsMatch = memory.match(/## Session Insights\n\n([\s\S]*?)$/);

  if (visionMatch && !visionMatch[1].includes('*No entries yet.*')) {
    sections.push(`**Vision & Goals**\n${visionMatch[1].trim()}`);
  }
  if (decisionsMatch && !decisionsMatch[1].includes('*No entries yet.*')) {
    sections.push(`**Decisions**\n${decisionsMatch[1].trim()}`);
  }
  if (preferencesMatch && !preferencesMatch[1].includes('*No entries yet.*')) {
    sections.push(`**Preferences**\n${preferencesMatch[1].trim()}`);
  }
  if (historyMatch && !historyMatch[1].includes('*No entries yet.*')) {
    sections.push(`**History**\n${historyMatch[1].trim()}`);
  }
  if (insightsMatch && !insightsMatch[1].includes('*No entries yet.*')) {
    // Only include recent insights (last 10 entries max)
    const insights = insightsMatch[1].trim();
    const recentInsights = insights.split('\n### ').slice(-10).join('\n### ');
    sections.push(`**Recent Insights**\n${recentInsights}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `\n\n---\n\n## Accumulated Context\n\nThe following is your accumulated understanding of this project and user:\n\n${sections.join('\n\n')}`;
}

/**
 * Add an entry to a specific memory category
 */
export function addMemoryEntry(category: MemoryCategory, content: string): void {
  let memory = loadMemory();

  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const entry = `- [${timestamp}] ${content}`;

  // Map category to section header
  const sectionMap: Record<MemoryCategory, string> = {
    vision: '## Vision & Goals',
    decisions: '## Decisions & Rationale',
    preferences: '## Preferences & Patterns',
    history: '## Project History',
    insights: '## Session Insights',
  };

  const sectionHeader = sectionMap[category];

  // Find the section and add entry after header
  const sectionRegex = new RegExp(`(${sectionHeader}\\n\\n)((?:<!-- [^>]+ -->\\n)*)`);
  const match = memory.match(sectionRegex);

  if (match) {
    // Remove "No entries yet" placeholder if present
    memory = memory.replace(
      new RegExp(`(${sectionHeader}\\n\\n(?:<!-- [^>]+ -->\\n)*)\\*No entries yet[^*]*\\*`),
      `$1`
    );

    // Add new entry after comments
    memory = memory.replace(
      sectionRegex,
      `$1$2${entry}\n`
    );
  }

  writeFileSync(MEMORY_PATH, memory, 'utf-8');
}

/**
 * Add a session insight with a title
 */
export function addSessionInsight(title: string, content: string): void {
  let memory = loadMemory();

  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `\n### ${title} (${timestamp})\n\n${content}\n`;

  // Remove placeholder if present
  memory = memory.replace(
    /(## Session Insights\n\n)\*No entries yet\.\*/,
    '$1'
  );

  // Append to end of file (Session Insights is last section)
  memory = memory.trimEnd() + entry;

  writeFileSync(MEMORY_PATH, memory, 'utf-8');
}

/**
 * Summarize a conversation and extract key insights
 * Uses Claude to intelligently categorize learnings
 */
export async function summarizeConversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey?: string
): Promise<{ category: MemoryCategory; title: string; content: string } | null> {
  if (messages.length < 2) {
    return null; // Not enough content to summarize
  }

  // Use API key from env if not provided
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('No API key available for summarization');
    return null;
  }

  const client = new Anthropic({ apiKey: key });

  // Format conversation for analysis
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast model for summarization
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation and extract ONE key insight worth remembering for future context. Focus on:
- Vision/goals the user expressed
- Decisions made and their rationale
- Preferences or patterns revealed
- Project milestones or history

If there's nothing significant to remember, respond with just "NONE".

Otherwise, respond in this exact format:
CATEGORY: vision|decisions|preferences|history
TITLE: Brief 3-5 word title
INSIGHT: 1-2 sentence summary of what to remember

Conversation:
${conversationText.slice(-8000)}` // Last 8k chars to fit context
        }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    if (text.trim() === 'NONE' || !text.includes('CATEGORY:')) {
      return null;
    }

    // Parse response
    const categoryMatch = text.match(/CATEGORY:\s*(vision|decisions|preferences|history)/i);
    const titleMatch = text.match(/TITLE:\s*(.+)/i);
    const insightMatch = text.match(/INSIGHT:\s*(.+)/is);

    if (categoryMatch && titleMatch && insightMatch) {
      return {
        category: categoryMatch[1].toLowerCase() as MemoryCategory,
        title: titleMatch[1].trim(),
        content: insightMatch[1].trim(),
      };
    }
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
  }

  return null;
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): {
  totalEntries: number;
  byCategory: Record<MemoryCategory, number>;
  lastUpdated: string | null;
} {
  const memory = loadMemory();

  const countEntries = (section: string): number => {
    const match = memory.match(new RegExp(`${section}\\n\\n([\\s\\S]*?)(?=\\n---)`));
    if (!match || match[1].includes('*No entries yet.*')) return 0;
    return (match[1].match(/^- \[/gm) || []).length +
           (match[1].match(/^### /gm) || []).length;
  };

  const byCategory: Record<MemoryCategory, number> = {
    vision: countEntries('## Vision & Goals'),
    decisions: countEntries('## Decisions & Rationale'),
    preferences: countEntries('## Preferences & Patterns'),
    history: countEntries('## Project History'),
    insights: countEntries('## Session Insights'),
  };

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);

  // Find most recent timestamp
  const timestamps = memory.match(/\[(\d{4}-\d{2}-\d{2})\]/g) || [];
  const lastUpdated = timestamps.length > 0
    ? timestamps[timestamps.length - 1].replace(/[\[\]]/g, '')
    : null;

  return { totalEntries: total, byCategory, lastUpdated };
}

/**
 * Feedback Patterns - Store Successful Implementation Patterns
 *
 * Tracks patterns that worked well for future reference.
 * Persisted to disk for cross-session learning.
 *
 * Patterns are indexed by:
 * - Task type (feature, bugfix, refactor, etc.)
 * - Keywords from successful implementations
 * - File paths involved
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Pattern storage location
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const PATTERNS_FILE = path.join(DATA_DIR, 'patterns.json');

/**
 * A successful implementation pattern
 */
export interface Pattern {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Task context
  taskType: string;
  taskTitle: string;
  issueId: string;

  // What made it successful
  approach: string;
  keyDecisions: string[];

  // Implementation details
  filesModified: string[];
  codePatterns: CodePattern[];

  // Metrics
  successCount: number;
  lastUsed: string;

  // Search keywords
  keywords: string[];
}

/**
 * A reusable code pattern
 */
export interface CodePattern {
  name: string;
  description: string;
  example: string;
  context: string; // When to use this pattern
}

/**
 * Pattern store with persistence
 */
class PatternStore {
  private patterns: Map<string, Pattern> = new Map();
  private loaded = false;

  /**
   * Ensure data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Load patterns from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    await this.ensureDataDir();

    try {
      const data = await fs.readFile(PATTERNS_FILE, 'utf-8');
      const parsed = JSON.parse(data) as Pattern[];

      this.patterns.clear();
      for (const pattern of parsed) {
        this.patterns.set(pattern.id, pattern);
      }

      console.log(`[Patterns] Loaded ${this.patterns.size} patterns from disk`);
    } catch (error) {
      // File doesn't exist yet, start fresh
      console.log('[Patterns] No existing patterns file, starting fresh');
    }

    this.loaded = true;
  }

  /**
   * Save patterns to disk
   */
  async save(): Promise<void> {
    await this.ensureDataDir();

    const data = Array.from(this.patterns.values());
    await fs.writeFile(PATTERNS_FILE, JSON.stringify(data, null, 2));

    console.log(`[Patterns] Saved ${data.length} patterns to disk`);
  }

  /**
   * Add or update a pattern
   */
  async upsert(pattern: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'lastUsed'>): Promise<Pattern> {
    await this.load();

    // Generate ID from task type and title
    const id = `${pattern.taskType}-${pattern.issueId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = this.patterns.get(id);
    const now = new Date().toISOString();

    const updated: Pattern = existing
      ? {
          ...existing,
          ...pattern,
          updatedAt: now,
          successCount: existing.successCount + 1,
          lastUsed: now,
          // Merge keywords
          keywords: [...new Set([...existing.keywords, ...pattern.keywords])]
        }
      : {
          ...pattern,
          id,
          createdAt: now,
          updatedAt: now,
          successCount: 1,
          lastUsed: now
        };

    this.patterns.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * Find patterns matching a task
   */
  async findMatching(taskType: string, keywords: string[]): Promise<Pattern[]> {
    await this.load();

    const matches: Array<{ pattern: Pattern; score: number }> = [];

    for (const pattern of this.patterns.values()) {
      let score = 0;

      // Task type match
      if (pattern.taskType === taskType) {
        score += 10;
      }

      // Keyword matches
      const patternKeywords = new Set(pattern.keywords.map(k => k.toLowerCase()));
      for (const keyword of keywords) {
        if (patternKeywords.has(keyword.toLowerCase())) {
          score += 5;
        }
      }

      // Boost by success count
      score += Math.min(pattern.successCount, 5);

      // Recency boost
      const daysSinceUsed = (Date.now() - new Date(pattern.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUsed < 7) {
        score += 3;
      } else if (daysSinceUsed < 30) {
        score += 1;
      }

      if (score > 0) {
        matches.push({ pattern, score });
      }
    }

    // Sort by score descending, return top 5
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => m.pattern);
  }

  /**
   * Get all patterns
   */
  async getAll(): Promise<Pattern[]> {
    await this.load();
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern by ID
   */
  async getById(id: string): Promise<Pattern | undefined> {
    await this.load();
    return this.patterns.get(id);
  }

  /**
   * Delete a pattern
   */
  async delete(id: string): Promise<boolean> {
    await this.load();

    if (this.patterns.has(id)) {
      this.patterns.delete(id);
      await this.save();
      return true;
    }

    return false;
  }
}

// Singleton instance
export const patternStore = new PatternStore();

/**
 * Record a successful implementation
 */
export async function recordSuccess(
  issueId: string,
  taskType: string,
  taskTitle: string,
  approach: string,
  keyDecisions: string[],
  filesModified: string[],
  codePatterns: CodePattern[] = []
): Promise<Pattern> {
  // Extract keywords from task title and approach
  const keywords = extractKeywords(`${taskTitle} ${approach}`);

  return patternStore.upsert({
    taskType,
    taskTitle,
    issueId,
    approach,
    keyDecisions,
    filesModified,
    codePatterns,
    keywords
  });
}

/**
 * Find relevant patterns for a task
 */
export async function findRelevantPatterns(
  taskType: string,
  taskTitle: string,
  taskDescription: string = ''
): Promise<Pattern[]> {
  const keywords = extractKeywords(`${taskTitle} ${taskDescription}`);
  return patternStore.findMatching(taskType, keywords);
}

/**
 * Build context string from patterns for agent prompt
 */
export function buildPatternContext(patterns: Pattern[]): string {
  if (patterns.length === 0) {
    return '';
  }

  const sections: string[] = [];

  sections.push('## Relevant Past Implementations');
  sections.push('');
  sections.push('These patterns worked well for similar tasks:');
  sections.push('');

  for (const pattern of patterns) {
    sections.push(`### ${pattern.taskTitle} (${pattern.issueId})`);
    sections.push('');
    sections.push(`**Approach:** ${pattern.approach}`);
    sections.push('');

    if (pattern.keyDecisions.length > 0) {
      sections.push('**Key Decisions:**');
      pattern.keyDecisions.forEach(d => sections.push(`- ${d}`));
      sections.push('');
    }

    if (pattern.filesModified.length > 0) {
      sections.push(`**Files:** ${pattern.filesModified.slice(0, 5).join(', ')}`);
      sections.push('');
    }

    if (pattern.codePatterns.length > 0) {
      sections.push('**Code Patterns:**');
      for (const cp of pattern.codePatterns.slice(0, 2)) {
        sections.push(`- ${cp.name}: ${cp.description}`);
      }
      sections.push('');
    }

    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Common words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter((word, index, self) => self.indexOf(word) === index); // Unique
}

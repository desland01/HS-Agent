/**
 * Feedback Corrections - Track Human Review Feedback
 *
 * Records corrections from human code reviews to improve future implementations.
 * Persisted to disk for cross-session learning.
 *
 * Corrections are categorized by:
 * - Type (bug, style, security, performance, etc.)
 * - Severity (critical, major, minor, nitpick)
 * - File/pattern affected
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Correction storage location
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CORRECTIONS_FILE = path.join(DATA_DIR, 'corrections.json');

/**
 * Types of corrections
 */
export type CorrectionType =
  | 'bug'           // Logic error, incorrect behavior
  | 'security'      // Security vulnerability
  | 'performance'   // Performance issue
  | 'style'         // Code style violation
  | 'naming'        // Poor naming choices
  | 'architecture'  // Structural/design issue
  | 'testing'       // Missing or inadequate tests
  | 'documentation' // Missing or incorrect docs
  | 'typescript'    // Type-related issue
  | 'other';

/**
 * Severity levels
 */
export type CorrectionSeverity =
  | 'critical'  // Must fix immediately
  | 'major'     // Should fix before merge
  | 'minor'     // Nice to fix
  | 'nitpick';  // Style preference

/**
 * A correction from human review
 */
export interface Correction {
  id: string;
  createdAt: string;

  // Context
  issueId: string;
  prUrl?: string;
  filePath: string;
  lineNumber?: number;

  // Classification
  type: CorrectionType;
  severity: CorrectionSeverity;

  // Details
  originalCode?: string;
  correctedCode?: string;
  explanation: string;

  // Learning
  lesson: string;  // What to remember for next time
  keywords: string[];  // For matching future similar code

  // Tracking
  occurrences: number;  // How many times this pattern was corrected
  lastOccurrence: string;
}

/**
 * Summary of common corrections
 */
export interface CorrectionSummary {
  type: CorrectionType;
  count: number;
  examples: Array<{
    lesson: string;
    originalCode?: string;
    correctedCode?: string;
  }>;
}

/**
 * Correction store with persistence
 */
class CorrectionStore {
  private corrections: Map<string, Correction> = new Map();
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
   * Load corrections from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    await this.ensureDataDir();

    try {
      const data = await fs.readFile(CORRECTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data) as Correction[];

      this.corrections.clear();
      for (const correction of parsed) {
        this.corrections.set(correction.id, correction);
      }

      console.log(`[Corrections] Loaded ${this.corrections.size} corrections from disk`);
    } catch (error) {
      // File doesn't exist yet
      console.log('[Corrections] No existing corrections file, starting fresh');
    }

    this.loaded = true;
  }

  /**
   * Save corrections to disk
   */
  async save(): Promise<void> {
    await this.ensureDataDir();

    const data = Array.from(this.corrections.values());
    await fs.writeFile(CORRECTIONS_FILE, JSON.stringify(data, null, 2));

    console.log(`[Corrections] Saved ${data.length} corrections to disk`);
  }

  /**
   * Add a correction
   */
  async add(correction: Omit<Correction, 'id' | 'createdAt' | 'occurrences' | 'lastOccurrence'>): Promise<Correction> {
    await this.load();

    // Check for similar existing correction
    const similar = this.findSimilar(correction.lesson, correction.keywords);
    const now = new Date().toISOString();

    if (similar) {
      // Update existing correction
      similar.occurrences += 1;
      similar.lastOccurrence = now;
      similar.keywords = [...new Set([...similar.keywords, ...correction.keywords])];

      await this.save();
      return similar;
    }

    // Create new correction
    const id = `${correction.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newCorrection: Correction = {
      ...correction,
      id,
      createdAt: now,
      occurrences: 1,
      lastOccurrence: now
    };

    this.corrections.set(id, newCorrection);
    await this.save();

    return newCorrection;
  }

  /**
   * Find similar correction by lesson/keywords
   */
  private findSimilar(lesson: string, keywords: string[]): Correction | undefined {
    const lessonLower = lesson.toLowerCase();
    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));

    for (const correction of this.corrections.values()) {
      // Check lesson similarity
      if (correction.lesson.toLowerCase().includes(lessonLower.slice(0, 50))) {
        return correction;
      }

      // Check keyword overlap
      const overlap = correction.keywords.filter(k => keywordSet.has(k.toLowerCase()));
      if (overlap.length >= 2) {
        return correction;
      }
    }

    return undefined;
  }

  /**
   * Get corrections by type
   */
  async getByType(type: CorrectionType): Promise<Correction[]> {
    await this.load();

    return Array.from(this.corrections.values())
      .filter(c => c.type === type)
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Get summary of corrections by type
   */
  async getSummary(): Promise<CorrectionSummary[]> {
    await this.load();

    const byType = new Map<CorrectionType, Correction[]>();

    for (const correction of this.corrections.values()) {
      const existing = byType.get(correction.type) || [];
      existing.push(correction);
      byType.set(correction.type, existing);
    }

    const summaries: CorrectionSummary[] = [];

    for (const [type, corrections] of byType) {
      // Sort by occurrences, take top 3 examples
      const sorted = corrections.sort((a, b) => b.occurrences - a.occurrences);

      summaries.push({
        type,
        count: corrections.reduce((sum, c) => sum + c.occurrences, 0),
        examples: sorted.slice(0, 3).map(c => ({
          lesson: c.lesson,
          originalCode: c.originalCode,
          correctedCode: c.correctedCode
        }))
      });
    }

    return summaries.sort((a, b) => b.count - a.count);
  }

  /**
   * Get all corrections
   */
  async getAll(): Promise<Correction[]> {
    await this.load();
    return Array.from(this.corrections.values());
  }

  /**
   * Find corrections matching keywords (for pre-implementation warnings)
   */
  async findMatching(keywords: string[]): Promise<Correction[]> {
    await this.load();

    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
    const matches: Array<{ correction: Correction; score: number }> = [];

    for (const correction of this.corrections.values()) {
      let score = 0;

      for (const keyword of correction.keywords) {
        if (keywordSet.has(keyword.toLowerCase())) {
          score += 1;
        }
      }

      // Boost by occurrences
      score += Math.min(correction.occurrences - 1, 3);

      // Boost critical/major
      if (correction.severity === 'critical') score += 3;
      if (correction.severity === 'major') score += 2;

      if (score > 0) {
        matches.push({ correction, score });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => m.correction);
  }
}

// Singleton instance
export const correctionStore = new CorrectionStore();

/**
 * Record a correction from human review
 */
export async function recordCorrection(
  issueId: string,
  type: CorrectionType,
  severity: CorrectionSeverity,
  filePath: string,
  explanation: string,
  lesson: string,
  options: {
    prUrl?: string;
    lineNumber?: number;
    originalCode?: string;
    correctedCode?: string;
    keywords?: string[];
  } = {}
): Promise<Correction> {
  // Extract keywords from lesson and explanation
  const extractedKeywords = extractKeywords(`${lesson} ${explanation} ${filePath}`);
  const keywords = [...new Set([...(options.keywords || []), ...extractedKeywords])];

  return correctionStore.add({
    issueId,
    type,
    severity,
    filePath,
    explanation,
    lesson,
    keywords,
    ...options
  });
}

/**
 * Get warnings for a task based on past corrections
 */
export async function getWarningsForTask(
  taskTitle: string,
  taskDescription: string = '',
  filePaths: string[] = []
): Promise<Correction[]> {
  const keywords = extractKeywords(`${taskTitle} ${taskDescription} ${filePaths.join(' ')}`);
  return correctionStore.findMatching(keywords);
}

/**
 * Build context string from corrections for agent prompt
 */
export function buildCorrectionContext(corrections: Correction[]): string {
  if (corrections.length === 0) {
    return '';
  }

  const sections: string[] = [];

  sections.push('## Past Review Feedback');
  sections.push('');
  sections.push('Avoid these previously-corrected issues:');
  sections.push('');

  for (const correction of corrections) {
    const severityEmoji = {
      critical: '!!!',
      major: '!!',
      minor: '!',
      nitpick: '-'
    }[correction.severity];

    sections.push(`### ${severityEmoji} ${correction.type.toUpperCase()}: ${correction.lesson}`);
    sections.push('');

    if (correction.originalCode && correction.correctedCode) {
      sections.push('```typescript');
      sections.push('// Wrong:');
      sections.push(correction.originalCode);
      sections.push('');
      sections.push('// Correct:');
      sections.push(correction.correctedCode);
      sections.push('```');
      sections.push('');
    }

    sections.push(`*${correction.explanation}*`);
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Build summary of common mistakes for self-review
 */
export async function buildReviewChecklist(): Promise<string> {
  const summaries = await correctionStore.getSummary();

  if (summaries.length === 0) {
    return '';
  }

  const sections: string[] = [];

  sections.push('## Self-Review Checklist (Based on Past Feedback)');
  sections.push('');

  for (const summary of summaries.slice(0, 5)) {
    sections.push(`### ${summary.type.toUpperCase()} (${summary.count} occurrences)`);

    for (const example of summary.examples) {
      sections.push(`- [ ] ${example.lesson}`);
    }

    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter((word, index, self) => self.indexOf(word) === index);
}

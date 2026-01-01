/**
 * Skill Loader - Progressive Disclosure Pattern
 *
 * Skills provide contextual knowledge to the agent based on task type.
 * Each skill is a markdown file with YAML frontmatter defining:
 * - name: Skill identifier
 * - triggers: Keywords that activate the skill
 * - priority: Loading order (1 = highest)
 *
 * Skills are loaded progressively:
 * 1. Always load: codebase-context (project structure, conventions)
 * 2. Task-specific: coding, integrations, escalation based on triggers
 * 3. On-demand: loaded when subagent requests additional context
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Skill metadata from YAML frontmatter
export interface SkillMetadata {
  name: string;
  description: string;
  triggers: string[];
  priority: number;
  alwaysLoad?: boolean;
}

// Parsed skill with content
export interface Skill {
  metadata: SkillMetadata;
  content: string;
  filePath: string;
}

// Cache loaded skills to avoid re-reading files
const skillCache = new Map<string, Skill>();

// SDK standard location: .claude/skills/
const SKILLS_DIR = path.join(__dirname, '../../.claude/skills');

/**
 * Parse YAML frontmatter from markdown content
 * Returns metadata object and remaining content
 */
function parseSkillFile(content: string): { metadata: SkillMetadata; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Skill file must have YAML frontmatter');
  }

  const [, yamlContent, body] = match;

  // Simple YAML parser for our expected format
  const metadata: SkillMetadata = {
    name: '',
    description: '',
    triggers: [],
    priority: 10,
    alwaysLoad: false
  };

  yamlContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) return;

    const value = valueParts.join(':').trim();

    switch (key.trim()) {
      case 'name':
        metadata.name = value.replace(/^["']|["']$/g, '');
        break;
      case 'description':
        metadata.description = value.replace(/^["']|["']$/g, '');
        break;
      case 'triggers':
        // Parse YAML array: [item1, item2] or multiline
        if (value.startsWith('[')) {
          metadata.triggers = value
            .slice(1, -1)
            .split(',')
            .map(t => t.trim().replace(/^["']|["']$/g, ''));
        }
        break;
      case 'priority':
        metadata.priority = parseInt(value, 10) || 10;
        break;
      case 'alwaysLoad':
        metadata.alwaysLoad = value === 'true';
        break;
    }
  });

  return { metadata, body: body.trim() };
}

/**
 * Load a single skill from disk
 */
async function loadSkill(skillDir: string): Promise<Skill | null> {
  const skillPath = path.join(SKILLS_DIR, skillDir, 'SKILL.md');

  // Check cache first
  if (skillCache.has(skillPath)) {
    return skillCache.get(skillPath)!;
  }

  try {
    const content = await fs.readFile(skillPath, 'utf-8');
    const { metadata, body } = parseSkillFile(content);

    const skill: Skill = {
      metadata,
      content: body,
      filePath: skillPath
    };

    skillCache.set(skillPath, skill);
    return skill;
  } catch (error) {
    console.warn(`Failed to load skill from ${skillPath}:`, error);
    return null;
  }
}

/**
 * Discover all available skills
 */
export async function discoverSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skill = await loadSkill(entry.name);
        if (skill) {
          skills.push(skill);
        }
      }
    }
  } catch (error) {
    console.error('Failed to discover skills:', error);
  }

  return skills.sort((a, b) => a.metadata.priority - b.metadata.priority);
}

/**
 * Match skills to a task based on triggers
 *
 * Returns skills sorted by priority, with always-load skills first
 */
export async function matchSkillsToTask(
  taskTitle: string,
  taskDescription: string = ''
): Promise<Skill[]> {
  const allSkills = await discoverSkills();
  const taskText = `${taskTitle} ${taskDescription}`.toLowerCase();

  const matchedSkills: Skill[] = [];
  const alwaysLoadSkills: Skill[] = [];

  for (const skill of allSkills) {
    // Always include alwaysLoad skills
    if (skill.metadata.alwaysLoad) {
      alwaysLoadSkills.push(skill);
      continue;
    }

    // Check if any trigger matches the task
    const matches = skill.metadata.triggers.some(trigger =>
      taskText.includes(trigger.toLowerCase())
    );

    if (matches) {
      matchedSkills.push(skill);
    }
  }

  // Sort alwaysLoad first, then by priority
  return [...alwaysLoadSkills, ...matchedSkills].sort(
    (a, b) => a.metadata.priority - b.metadata.priority
  );
}

/**
 * Build context string from matched skills
 *
 * Uses progressive disclosure:
 * - First section: Summary of available skills
 * - Then: Full content of matched skills, most relevant first
 */
export function buildSkillContext(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // Header with skill list
  sections.push('## Available Skills');
  sections.push('');
  skills.forEach(skill => {
    sections.push(`- **${skill.metadata.name}**: ${skill.metadata.description}`);
  });
  sections.push('');

  // Full skill content
  sections.push('---');
  sections.push('');

  for (const skill of skills) {
    sections.push(`## ${skill.metadata.name}`);
    sections.push('');
    sections.push(skill.content);
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Get skill by name (for on-demand loading)
 */
export async function getSkillByName(name: string): Promise<Skill | null> {
  const allSkills = await discoverSkills();
  return allSkills.find(s => s.metadata.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Clear skill cache (useful for development/testing)
 */
export function clearSkillCache(): void {
  skillCache.clear();
}

/**
 * Task type detection for skill matching
 *
 * Analyzes task title/description to determine primary task type
 */
export type TaskType =
  | 'feature'      // New feature implementation
  | 'bugfix'       // Bug fix
  | 'refactor'     // Code refactoring
  | 'integration'  // External service integration
  | 'ui'           // Frontend/UI work
  | 'api'          // API development
  | 'infrastructure' // DevOps, CI/CD
  | 'documentation' // Docs
  | 'unknown';

export function detectTaskType(title: string, description: string = ''): TaskType {
  const text = `${title} ${description}`.toLowerCase();

  // Check for specific task types
  if (text.includes('bug') || text.includes('fix') || text.includes('error') || text.includes('issue')) {
    return 'bugfix';
  }
  if (text.includes('refactor') || text.includes('cleanup') || text.includes('reorganize')) {
    return 'refactor';
  }
  if (text.includes('linear') || text.includes('github') || text.includes('api') || text.includes('webhook')) {
    return 'integration';
  }
  if (text.includes('ui') || text.includes('dashboard') || text.includes('frontend') || text.includes('component')) {
    return 'ui';
  }
  if (text.includes('endpoint') || text.includes('route') || text.includes('rest')) {
    return 'api';
  }
  if (text.includes('docker') || text.includes('deploy') || text.includes('ci') || text.includes('pipeline')) {
    return 'infrastructure';
  }
  if (text.includes('docs') || text.includes('readme') || text.includes('documentation')) {
    return 'documentation';
  }
  if (text.includes('add') || text.includes('implement') || text.includes('create') || text.includes('feature')) {
    return 'feature';
  }

  return 'unknown';
}

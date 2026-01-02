/**
 * Skill Loader with Progressive Disclosure
 *
 * Level 1: Name + description (always in system prompt)
 * Level 2: Full SKILL.md content (loaded on demand)
 * Level 3: Reference files (loaded when explicitly requested)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// SDK standard location: .claude/skills/
const SKILLS_DIR = join(__dirname, '../../.claude/skills');

export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
  referenceFiles?: string[];
}

export interface Skill extends SkillMetadata {
  content?: string;  // Level 2: Full content
  references?: Map<string, string>;  // Level 3: Reference file contents
}

/**
 * Parse SKILL.md frontmatter to extract metadata
 */
function parseSkillMetadata(content: string, skillPath: string): SkillMetadata {
  const lines = content.split('\n');
  let name = '';
  let description = '';
  const referenceFiles: string[] = [];

  // Look for YAML frontmatter or header patterns
  let inFrontmatter = false;
  let inReferences = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }

    if (inFrontmatter) {
      if (line.startsWith('name:')) {
        name = line.replace('name:', '').trim().replace(/^["']|["']$/g, '');
      } else if (line.startsWith('description:')) {
        description = line.replace('description:', '').trim().replace(/^["']|["']$/g, '');
      }
    }

    // Also check for markdown headers as fallback
    if (line.startsWith('# ') && !name) {
      name = line.replace('# ', '').trim();
    }

    // Look for description in first paragraph after header
    if (name && !description && line.trim() && !line.startsWith('#') && !line.startsWith('-')) {
      description = line.trim();
    }

    // Parse reference files section
    if (line.toLowerCase().includes('reference files') || line.toLowerCase().includes('references:')) {
      inReferences = true;
      continue;
    }
    if (inReferences && line.startsWith('-')) {
      const refFile = line.replace('-', '').trim();
      if (refFile) referenceFiles.push(refFile);
    }
    if (inReferences && line.startsWith('#')) {
      inReferences = false;
    }
  }

  return {
    name: name || 'Unnamed Skill',
    description: description || 'No description provided',
    path: skillPath,
    referenceFiles: referenceFiles.length > 0 ? referenceFiles : undefined,
  };
}

/**
 * Load all skill metadata (Level 1)
 */
export function loadSkillsMetadata(): SkillMetadata[] {
  const skills: SkillMetadata[] = [];

  if (!existsSync(SKILLS_DIR)) {
    // Silently return - don't interfere with readline
    return skills;
  }

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of skillDirs) {
    const skillPath = join(SKILLS_DIR, dir, 'SKILL.md');
    if (existsSync(skillPath)) {
      try {
        const content = readFileSync(skillPath, 'utf-8');
        const metadata = parseSkillMetadata(content, skillPath);
        skills.push(metadata);
      } catch {
        // Skip invalid skills silently
      }
    }
  }

  return skills;
}

/**
 * Load full skill content (Level 2)
 */
export function loadSkillContent(skillName: string): Skill | null {
  const skills = loadSkillsMetadata();
  const metadata = skills.find(s =>
    s.name.toLowerCase() === skillName.toLowerCase() ||
    s.path.includes(skillName.toLowerCase().replace(/\s+/g, '-'))
  );

  if (!metadata) {
    return null;
  }

  try {
    const content = readFileSync(metadata.path, 'utf-8');
    return {
      ...metadata,
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Load skill reference files (Level 3)
 */
export function loadSkillReferences(skillName: string): Skill | null {
  const skill = loadSkillContent(skillName);
  if (!skill || !skill.referenceFiles) {
    return skill;
  }

  const skillDir = dirname(skill.path);
  const references = new Map<string, string>();

  for (const refFile of skill.referenceFiles) {
    const refPath = join(skillDir, refFile);
    if (existsSync(refPath)) {
      try {
        references.set(refFile, readFileSync(refPath, 'utf-8'));
      } catch {
        // Skip missing references silently
      }
    }
  }

  return {
    ...skill,
    references,
  };
}

/**
 * Generate Level 1 summary for system prompt
 */
export function generateSkillsSummary(): string {
  const skills = loadSkillsMetadata();

  if (skills.length === 0) {
    return 'No skills loaded.';
  }

  const lines = ['## Available Skills', ''];
  for (const skill of skills) {
    lines.push(`- **${skill.name}**: ${skill.description}`);
  }

  lines.push('');
  lines.push('Use `load_skill` to access full skill content when needed.');

  return lines.join('\n');
}

/**
 * Skill loading tool for Claude
 */
export const skillTools = [
  {
    name: 'load_skill',
    description: 'Load the full content of a skill. Use this when you need detailed instructions for a specific task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        skillName: {
          type: 'string',
          description: 'Name of the skill to load (e.g., "planning", "design-system")',
        },
        includeReferences: {
          type: 'boolean',
          description: 'Whether to also load reference files (Level 3). Default: false',
        },
      },
      required: ['skillName'],
    },
  },
];

export function executeSkillTool(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === 'load_skill') {
    const skillName = input.skillName as string;
    const includeReferences = input.includeReferences as boolean ?? false;

    const skill = includeReferences
      ? loadSkillReferences(skillName)
      : loadSkillContent(skillName);

    if (!skill) {
      return JSON.stringify({
        success: false,
        error: `Skill not found: ${skillName}`,
        availableSkills: loadSkillsMetadata().map(s => s.name),
      });
    }

    const result: Record<string, unknown> = {
      success: true,
      name: skill.name,
      description: skill.description,
      content: skill.content,
    };

    if (skill.references && skill.references.size > 0) {
      result.references = Object.fromEntries(skill.references);
    }

    return JSON.stringify(result);
  }

  return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
}

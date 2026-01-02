/**
 * File System Tools
 * Read, search, and explore files in the local directory
 */

import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, resolve, basename, dirname } from 'path';
import { execSync } from 'child_process';

// Working directory - defaults to process.cwd()
let workingDirectory = process.cwd();

export function setWorkingDirectory(dir: string): void {
  workingDirectory = resolve(dir);
}

export function getWorkingDirectory(): string {
  return workingDirectory;
}

/**
 * File tool definitions
 */
export const fileTools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Supports text files. Returns file content with line numbers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to working directory or absolute)',
        },
        startLine: {
          type: 'number',
          description: 'Optional: Start reading from this line (1-based)',
        },
        endLine: {
          type: 'number',
          description: 'Optional: Stop reading at this line (inclusive)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory with file sizes and types',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to directory (relative or absolute). Defaults to working directory.',
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list recursively (max 3 levels deep)',
        },
        pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter results (e.g., "*.ts")',
        },
      },
    },
  },
  {
    name: 'glob_files',
    description: 'Find files matching a glob pattern. Returns list of matching file paths.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx", "*.md")',
        },
        cwd: {
          type: 'string',
          description: 'Optional: Directory to search from (defaults to working directory)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep_content',
    description: 'Search for a pattern in files. Returns matching lines with context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern (supports regex)',
        },
        path: {
          type: 'string',
          description: 'File or directory to search in (defaults to working directory)',
        },
        filePattern: {
          type: 'string',
          description: 'Optional: Only search files matching this glob (e.g., "*.ts")',
        },
        ignoreCase: {
          type: 'boolean',
          description: 'Case-insensitive search (default: false)',
        },
        contextLines: {
          type: 'number',
          description: 'Number of context lines before/after match (default: 2)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Get metadata about a file (size, modified date, type)',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
      },
      required: ['path'],
    },
  },
];

/**
 * Resolve path relative to working directory
 */
function resolvePath(inputPath: string): string {
  if (!inputPath) return workingDirectory;
  return resolve(workingDirectory, inputPath);
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Read file contents with line numbers
 */
function readFile(
  path: string,
  startLine?: number,
  endLine?: number
): { success: boolean; content?: string; error?: string; lines?: number } {
  const fullPath = resolvePath(path);

  if (!existsSync(fullPath)) {
    return { success: false, error: `File not found: ${path}` };
  }

  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return { success: false, error: `Path is a directory: ${path}` };
    }

    // Limit file size to 1MB for safety
    if (stat.size > 1024 * 1024) {
      return { success: false, error: `File too large (${formatSize(stat.size)}). Max 1MB.` };
    }

    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(totalLines, endLine ?? totalLines);

    const selectedLines = lines.slice(start - 1, end);
    const numberedContent = selectedLines
      .map((line, i) => `${String(start + i).padStart(4)} │ ${line}`)
      .join('\n');

    return {
      success: true,
      content: numberedContent,
      lines: totalLines,
    };
  } catch (err) {
    return { success: false, error: `Failed to read file: ${(err as Error).message}` };
  }
}

/**
 * List directory contents
 */
function listDirectory(
  path: string = '',
  recursive: boolean = false,
  pattern?: string,
  depth: number = 0,
  maxDepth: number = 3
): { success: boolean; entries?: Array<{ name: string; type: string; size?: string }>; error?: string } {
  const fullPath = resolvePath(path);

  if (!existsSync(fullPath)) {
    return { success: false, error: `Directory not found: ${path || '.'}` };
  }

  try {
    const stat = statSync(fullPath);
    if (!stat.isDirectory()) {
      return { success: false, error: `Not a directory: ${path}` };
    }

    const entries: Array<{ name: string; type: string; size?: string }> = [];
    const items = readdirSync(fullPath);

    for (const item of items) {
      // Skip hidden files and common ignored directories
      if (item.startsWith('.') || item === 'node_modules') continue;

      const itemPath = join(fullPath, item);
      const relPath = relative(workingDirectory, itemPath);

      try {
        const itemStat = statSync(itemPath);
        const isDir = itemStat.isDirectory();

        // Apply pattern filter
        if (pattern && !isDir) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          if (!regex.test(item)) continue;
        }

        entries.push({
          name: relPath,
          type: isDir ? 'dir' : 'file',
          size: isDir ? undefined : formatSize(itemStat.size),
        });

        // Recurse into directories
        if (recursive && isDir && depth < maxDepth) {
          const subResult = listDirectory(itemPath, true, pattern, depth + 1, maxDepth);
          if (subResult.success && subResult.entries) {
            entries.push(...subResult.entries);
          }
        }
      } catch {
        // Skip items we can't stat
      }
    }

    // Sort: directories first, then files
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, entries };
  } catch (err) {
    return { success: false, error: `Failed to list directory: ${(err as Error).message}` };
  }
}

/**
 * Find files matching glob pattern using shell
 */
function globFiles(
  pattern: string,
  cwd?: string
): { success: boolean; files?: string[]; error?: string } {
  const searchDir = cwd ? resolvePath(cwd) : workingDirectory;

  try {
    // Use find command for glob matching (more portable than bash glob)
    // Convert glob pattern to find pattern
    let findPattern = pattern;

    // Handle ** patterns specially
    if (pattern.includes('**')) {
      // Use find with -name for simple patterns
      const parts = pattern.split('**');
      if (parts.length === 2 && parts[0] === '' && parts[1].startsWith('/')) {
        findPattern = parts[1].slice(1); // Remove leading /
      }
    }

    // Try using `find` command
    const cmd = `find "${searchDir}" -type f -name "${basename(findPattern)}" 2>/dev/null | head -100`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });

    const files = result
      .split('\n')
      .filter(f => f.trim())
      .map(f => relative(workingDirectory, f))
      .filter(f => !f.includes('node_modules') && !f.startsWith('.'));

    return { success: true, files };
  } catch (err) {
    // Fallback: manual recursive search
    try {
      const files: string[] = [];
      const searchPattern = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.')
          .replace(/\./g, '\\.')
      );

      function walkDir(dir: string): void {
        if (files.length >= 100) return;

        try {
          const items = readdirSync(dir);
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules') continue;

            const fullPath = join(dir, item);
            const relPath = relative(workingDirectory, fullPath);

            try {
              const stat = statSync(fullPath);
              if (stat.isDirectory()) {
                walkDir(fullPath);
              } else if (searchPattern.test(relPath)) {
                files.push(relPath);
              }
            } catch {
              // Skip inaccessible files
            }
          }
        } catch {
          // Skip inaccessible directories
        }
      }

      walkDir(searchDir);
      return { success: true, files };
    } catch (fallbackErr) {
      return { success: false, error: `Glob failed: ${(fallbackErr as Error).message}` };
    }
  }
}

/**
 * Search for pattern in files
 */
function grepContent(
  pattern: string,
  path?: string,
  filePattern?: string,
  ignoreCase: boolean = false,
  contextLines: number = 2,
  maxResults: number = 50
): { success: boolean; results?: Array<{ file: string; line: number; content: string; context?: string[] }>; error?: string } {
  const searchPath = path ? resolvePath(path) : workingDirectory;

  try {
    // Try using grep command first (faster for large codebases)
    const flags = ignoreCase ? '-rni' : '-rn';
    const includeFlag = filePattern ? `--include="${filePattern}"` : '';
    const contextFlag = contextLines > 0 ? `-C ${contextLines}` : '';

    const cmd = `grep ${flags} ${includeFlag} ${contextFlag} "${pattern}" "${searchPath}" 2>/dev/null | head -${maxResults * (1 + contextLines * 2)}`;

    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    const lines = output.split('\n').filter(l => l.trim());

    const results: Array<{ file: string; line: number; content: string }> = [];
    const seen = new Set<string>();

    for (const line of lines) {
      // Parse grep output: filename:linenum:content
      const match = line.match(/^(.+?):(\d+)[:-](.*)$/);
      if (match) {
        const [, filePath, lineNum, content] = match;
        const relPath = relative(workingDirectory, filePath);
        const key = `${relPath}:${lineNum}`;

        if (!seen.has(key) && results.length < maxResults) {
          seen.add(key);
          results.push({
            file: relPath,
            line: parseInt(lineNum, 10),
            content: content.trim(),
          });
        }
      }
    }

    return { success: true, results };
  } catch {
    // grep returns non-zero if no matches - that's ok
    return { success: true, results: [] };
  }
}

/**
 * Get file info
 */
function getFileInfo(
  path: string
): { success: boolean; info?: { size: string; modified: string; type: string; lines?: number }; error?: string } {
  const fullPath = resolvePath(path);

  if (!existsSync(fullPath)) {
    return { success: false, error: `File not found: ${path}` };
  }

  try {
    const stat = statSync(fullPath);
    const isDir = stat.isDirectory();

    const info: { size: string; modified: string; type: string; lines?: number } = {
      size: formatSize(stat.size),
      modified: stat.mtime.toISOString(),
      type: isDir ? 'directory' : 'file',
    };

    // Count lines for text files
    if (!isDir && stat.size < 1024 * 1024) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        info.lines = content.split('\n').length;
      } catch {
        // Not a text file
      }
    }

    return { success: true, info };
  } catch (err) {
    return { success: false, error: `Failed to get file info: ${(err as Error).message}` };
  }
}

/**
 * Execute file tools
 */
export async function executeFileTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'read_file':
      return JSON.stringify(readFile(
        input.path as string,
        input.startLine as number | undefined,
        input.endLine as number | undefined
      ));

    case 'list_directory':
      return JSON.stringify(listDirectory(
        input.path as string | undefined,
        input.recursive as boolean | undefined,
        input.pattern as string | undefined
      ));

    case 'glob_files':
      return JSON.stringify(globFiles(
        input.pattern as string,
        input.cwd as string | undefined
      ));

    case 'grep_content':
      return JSON.stringify(grepContent(
        input.pattern as string,
        input.path as string | undefined,
        input.filePattern as string | undefined,
        input.ignoreCase as boolean | undefined,
        input.contextLines as number | undefined,
        input.maxResults as number | undefined
      ));

    case 'get_file_info':
      return JSON.stringify(getFileInfo(input.path as string));

    default:
      return JSON.stringify({ success: false, error: `Unknown file tool: ${toolName}` });
  }
}

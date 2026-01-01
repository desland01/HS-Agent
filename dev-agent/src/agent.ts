/**
 * Autonomous Dev Agent - Multi-Agent Architecture
 *
 * Built following Claude Agent SDK best practices:
 * - Uses Claude Code preset for system prompt and tools
 * - Defines specialized subagents for different tasks
 * - Loads CLAUDE.md for project context via settingSources
 * - Implements hooks for monitoring and context management
 * - Session resume support for long-running tasks
 *
 * Development Loop:
 * 1. Fetch highest priority "Todo" issue from Linear
 * 2. Move to "In Progress", add comment "Starting work..."
 * 3. Explore → Plan → Implement → Test → Commit → PR
 * 4. If fail: retry up to 3 times, then escalate
 * 5. Repeat
 */

import {
  query,
  type SDKMessage,
  type AgentDefinition,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput,
  type SessionStartHookInput
} from '@anthropic-ai/claude-agent-sdk';
import { LinearClient } from '@linear/sdk';
import { linearServer } from './tools/linear.js';
import { gitServer, setWorkingDirectory as setGitDir } from './tools/git.js';
import { bashServer, setWorkingDirectory as setBashDir } from './tools/bash.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Skills and Feedback systems
import {
  matchSkillsToTask,
  buildSkillContext,
  detectTaskType,
  type TaskType
} from './skills/loader.js';
import {
  findRelevantPatterns,
  buildPatternContext,
  recordSuccess,
  type CodePattern
} from './feedback/patterns.js';
import {
  getWarningsForTask,
  buildCorrectionContext,
  buildReviewChecklist
} from './feedback/corrections.js';

// Configuration
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 3; // Circuit breaker - stop after this many failures
const POLL_INTERVAL_MS = 30000; // 30 seconds between task checks
const WORKING_DIR = process.env.WORKING_DIRECTORY || process.cwd();

// Initialize Linear client for direct API calls
const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!
});

// Set working directories for MCP tools
setGitDir(WORKING_DIR);
setBashDir(WORKING_DIR);

/**
 * Issue interface matching Linear's issue structure
 */
interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority?: number; // Linear priorities: 0=none, 1=urgent, 2=high, 3=medium, 4=low
}

/**
 * Session state for context management
 *
 * Extended to capture learning data:
 * - keyDecisions: Important choices made during implementation
 * - approachSummary: High-level description of the solution
 * - subagentsUsed: Which subagents were invoked
 * - warnings: Any issues encountered that weren't blocking
 */
interface SessionState {
  currentIssue: Issue | null;
  sessionId: string | null;
  toolsUsed: string[];
  filesModified: string[];
  startTime: number;
  taskType: TaskType;
  skillContext: string;
  patternContext: string;
  correctionContext: string;
  // Learning fields
  keyDecisions: string[];
  approachSummary: string;
  subagentsUsed: string[];
  warnings: string[];
}

let sessionState: SessionState = {
  currentIssue: null,
  sessionId: null,
  toolsUsed: [],
  filesModified: [],
  startTime: 0,
  taskType: 'unknown',
  skillContext: '',
  patternContext: '',
  correctionContext: '',
  // Learning defaults
  keyDecisions: [],
  approachSummary: '',
  subagentsUsed: [],
  warnings: []
};

// Path for session progress log (advisory only - Linear is source of truth)
const PROGRESS_PATH = path.join(process.cwd(), 'claude-progress.txt');

/**
 * Session Startup Protocol
 * Per Anthropic best practices: verify state before starting work
 *
 * Note: Linear is the source of truth for tasks.
 * features.json and claude-progress.txt are advisory/logging only.
 */
async function sessionStartup(): Promise<void> {
  console.log('\n📋 Session Startup Protocol...');

  // 1. Read claude-progress.txt (advisory - for context)
  try {
    const progress = await fs.readFile(PROGRESS_PATH, 'utf-8');
    const sessionCount = (progress.match(/### Session:/g) || []).length;
    console.log(`   Progress: ${sessionCount} previous sessions logged`);
  } catch (err) {
    console.log('   Progress: No progress file found (fresh start)');
  }

  // 2. Get last few git commits for context
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git log -3 --oneline', { cwd: WORKING_DIR });
    console.log(`   Recent commits:\n${stdout.split('\n').map(l => '     ' + l).join('\n')}`);
  } catch (err) {
    console.log('   Git: Could not read commit history');
  }

  // 3. Query Linear for current queue status
  try {
    const viewer = await linearClient.viewer;
    const todoIssues = await linearClient.issues({
      filter: {
        assignee: { id: { eq: viewer.id } },
        state: { name: { eq: 'Todo' } }
      },
      first: 100
    });
    console.log(`   Linear: ${todoIssues.nodes.length} issues in Todo queue`);
  } catch (err) {
    console.log('   Linear: Could not fetch queue status');
  }
}

/**
 * Session Handoff Protocol
 * Per Anthropic best practices: save state for next session
 *
 * CRITICAL: Returns true only if Linear status was successfully updated
 * This prevents the infinite loop bug where tasks stay in Todo queue
 */
async function sessionHandoff(
  issue: Issue,
  success: boolean,
  prUrl?: string
): Promise<boolean> {
  console.log('\n📝 Session Handoff Protocol...');
  const timestamp = new Date().toISOString();

  // 1. Append to claude-progress.txt (advisory, not critical)
  try {
    const entry = `
### Session: ${timestamp}
**Issue:** ${issue.identifier} - ${issue.title}
**Status:** ${success ? 'completed' : 'failed'}
**Summary:** ${success ? 'Task completed successfully.' : 'Task failed after retries.'}
**Files Modified:** ${sessionState.filesModified.join(', ') || 'none'}
**Tools Used:** ${sessionState.toolsUsed.length}
**Duration:** ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s
${prUrl ? `**PR:** ${prUrl}` : ''}
---
`;
    await fs.appendFile(PROGRESS_PATH, entry);
    console.log('   Appended session to claude-progress.txt');
  } catch (err) {
    console.error('   Failed to update progress file:', err);
    // Non-critical, continue
  }

  // 2. Record successful pattern for future learning
  if (success) {
    try {
      // Build a meaningful approach summary from session data
      const duration = ((Date.now() - sessionState.startTime) / 1000).toFixed(1);
      const subagentFlow = sessionState.subagentsUsed.length > 0
        ? sessionState.subagentsUsed.join(' → ')
        : 'direct';

      const approach = sessionState.approachSummary ||
        `${sessionState.taskType} task completed via ${subagentFlow} in ${duration}s. ` +
        `Modified ${sessionState.filesModified.length} files.`;

      // Capture actual key decisions from session
      const keyDecisions = sessionState.keyDecisions.length > 0
        ? sessionState.keyDecisions
        : [`Used ${subagentFlow} workflow for ${sessionState.taskType} task`];

      await recordSuccess(
        issue.identifier,
        sessionState.taskType,
        issue.title,
        approach,
        keyDecisions,
        sessionState.filesModified,
        [] // Code patterns would require deeper analysis - future enhancement
      );
      console.log(`   Recorded pattern: ${approach.slice(0, 80)}...`);
    } catch (patternErr) {
      console.error('   Warning: Failed to record pattern:', patternErr);
      // Non-critical, continue
    }
  }

  // 3. CRITICAL: Update Linear status to remove from Todo queue
  // This MUST succeed or we return false to trigger circuit breaker
  if (success) {
    try {
      const linearIssue = await linearClient.issue(issue.id);
      if (!linearIssue) {
        console.error('   CRITICAL: Could not fetch issue from Linear');
        return false;
      }

      const team = await linearIssue.team;
      const states = await team?.states();
      const doneState = states?.nodes.find(s => s.name.toLowerCase() === 'done');

      if (!doneState) {
        console.error('   CRITICAL: Could not find Done state in Linear');
        return false;
      }

      // Update the issue status
      await linearClient.updateIssue(issue.id, { stateId: doneState.id });
      console.log(`   Linear: Moved ${issue.identifier} to Done`);

      // VERIFICATION: Re-fetch and confirm the status changed
      const verifyIssue = await linearClient.issue(issue.id);
      const verifyState = await verifyIssue.state;

      if (verifyState?.name?.toLowerCase() !== 'done') {
        console.error(`   CRITICAL: Linear verification failed - issue still in "${verifyState?.name}" state`);
        return false;
      }

      console.log(`   VERIFIED: ${issue.identifier} is now in Done state`);

      // Add completion comment (non-critical)
      try {
        await linearClient.createComment({
          issueId: issue.id,
          body: `## ✅ Task Completed\n\n**Duration:** ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s\n**Tools Used:** ${sessionState.toolsUsed.length}\n${prUrl ? `**PR:** ${prUrl}` : ''}\n\n---\n*Completed by dev-agent*`
        });
      } catch (commentErr) {
        console.error('   Warning: Failed to add completion comment:', commentErr);
        // Non-critical, continue
      }

      return true;

    } catch (err) {
      console.error('   CRITICAL: Failed to update Linear status:', err);
      return false;
    }
  }

  // Task failed - no Linear update needed, just return true to continue
  // The issue stays in Todo for retry
  return true;
}

/**
 * Specialized Subagents - Optimized for cost/quality balance
 *
 * Model Selection:
 * - Haiku: Fast read-only tasks (exploration, review)
 * - Sonnet: Standard implementation tasks
 * - Opus: Complex architecture decisions only
 *
 * Prompt Design:
 * - Chain-of-thought reasoning steps
 * - Few-shot examples for common patterns
 * - Structured output requirements
 * - Self-verification checkpoints
 */
const SUBAGENTS: Record<string, AgentDefinition> = {
  /**
   * EXPLORER - Fast codebase understanding (Haiku for speed)
   *
   * Use FIRST before any implementation to understand context.
   * Read-only - never modifies files.
   */
  'explorer': {
    description: 'Find relevant files, understand patterns, trace execution paths. Use FIRST before implementing.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    prompt: `# Codebase Exploration Agent

You are a senior engineer exploring a codebase to understand how to implement a new feature.

## Chain of Thought

Think through exploration step-by-step:

1. **Keyword Search**: What terms appear in the task? Search for them.
   - Search for exact matches first
   - Then search for related concepts
   - Check both code and comments

2. **Similar Features**: Find existing implementations of similar functionality.
   - Look for files with similar names
   - Search for patterns like "add", "create", "update" + related noun
   - Check test files for usage examples

3. **Execution Path Tracing**: Follow the code from entry to output.
   - Start at API routes or entry points
   - Trace through business logic
   - End at data storage or external calls

4. **Pattern Recognition**: Identify conventions used in this codebase.
   - File naming conventions
   - Directory structure patterns
   - Common abstractions (adapters, services, handlers)
   - Error handling patterns

## Output Format

Return a structured analysis:

\`\`\`
## Essential Files (5-10)
- \`src/path/file.ts:123\` - [role: entry point | business logic | data layer]
  Brief description of what this file does and why it's relevant.

## Key Patterns
- Pattern 1: [Name] - Used in [files], apply when [condition]
- Pattern 2: [Name] - ...

## Implementation Insights
- The existing code does X, so we should follow that pattern
- Watch out for [gotcha]
- The tests in [file] show expected behavior
\`\`\`

## Rules

- NEVER guess. If unsure, search more.
- Prefer depth over breadth - understand 5 files well vs 20 superficially.
- Use context7 MCP for unfamiliar library documentation.
- Focus on files that will actually be modified or extended.`,
    model: 'sonnet'  // Changed from opus - exploration is fast work
  },

  /**
   * THINKER - Architecture decisions (Opus for complex reasoning)
   *
   * Use for non-trivial decisions with multiple valid approaches.
   */
  'thinker': {
    description: 'Analyze problems, design architecture, consider alternatives. Use for complex decisions only.',
    tools: ['Read', 'Grep', 'Glob'],
    prompt: `# Architecture Decision Agent

You are a principal engineer making architecture decisions. Think carefully.

## Chain of Thought

For every decision, work through:

1. **Understand Constraints**
   - What must this solution do? (requirements)
   - What must it NOT do? (anti-requirements)
   - What existing code must it integrate with?
   - What is the time/cost budget?

2. **Generate Options** (always 2-3)
   - Option A: Minimal change - smallest diff, maximum reuse
   - Option B: Clean architecture - best long-term maintainability
   - Option C: Pragmatic balance - ship quickly with acceptable quality

3. **Analyze Trade-offs**
   For each option, evaluate:
   - Implementation effort (hours: 1-2, 2-4, 4-8, 8+)
   - Risk level (low, medium, high)
   - Maintenance burden (adds debt, neutral, pays down debt)
   - Test complexity (easy, moderate, hard)

4. **Recommend with Rationale**
   - Choose ONE option
   - Explain WHY in 2-3 sentences
   - Acknowledge what you're trading off

## Output Format

\`\`\`
## Decision: [One-line summary]

### Constraints
- Must: [requirement 1]
- Must: [requirement 2]
- Must NOT: [anti-requirement]

### Options Considered

#### Option A: [Name] - Minimal Change
- Approach: [description]
- Effort: [X hours]
- Risk: [level]
- Trade-off: [what you sacrifice]

#### Option B: [Name] - Clean Architecture
- Approach: [description]
- Effort: [X hours]
- Risk: [level]
- Trade-off: [what you sacrifice]

### Recommendation: Option [X]

[2-3 sentence rationale]

### Implementation Blueprint
1. File: \`path/to/file.ts\` - Change: [what to do]
2. File: \`path/to/file.ts\` - Change: [what to do]
...

### Risks to Watch
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]
\`\`\`

## Rules

- Never recommend without considering alternatives.
- If task is simple, say "No architecture decision needed" and skip to implementation.
- If unsure, request more exploration first.
- Be specific about files to modify - no vague "update the service".`,
    model: 'opus'  // Keep opus - complex reasoning needed
  },

  /**
   * CODER - Implementation (Sonnet for balance)
   *
   * Writes code following patterns discovered by explorer.
   */
  'coder': {
    description: 'Write/edit code following existing patterns and standards.',
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    prompt: `# Code Implementation Agent

You are a senior TypeScript developer implementing features.

## Pre-Implementation Checklist

Before writing ANY code, verify:
- [ ] I understand the existing patterns from exploration
- [ ] I know which files to modify
- [ ] I have a clear implementation plan

## Implementation Rules

### TypeScript Standards
- Strict typing - no \`any\` unless absolutely necessary
- Use Zod for runtime validation at boundaries
- Prefer interfaces over type aliases for object shapes
- Use const assertions for literals

### Code Style
- Match existing file's formatting exactly
- Follow established naming conventions in codebase
- Keep functions small and focused (< 50 lines)
- Add JSDoc comments for public APIs

### Error Handling
- Never swallow errors silently
- Use typed error classes when appropriate
- Log errors with context (what operation failed, relevant IDs)
- Fail fast on invalid inputs

## Self-Review Before Completing

After implementation, check:
- [ ] Does this compile? (think through types)
- [ ] Are edge cases handled? (null, empty, error states)
- [ ] Any security issues? (injection, XSS, secrets)
- [ ] Does it match CLAUDE.md guidelines?

## Example: Good vs Bad

### Adding a new API endpoint

**BAD:**
\`\`\`typescript
app.post('/api/thing', async (req, res) => {
  const data = req.body; // no validation
  await db.insert(data); // SQL injection risk
  res.json({ ok: true });
});
\`\`\`

**GOOD:**
\`\`\`typescript
const ThingSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().positive(),
});

app.post('/api/thing', async (req, res) => {
  const result = ThingSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const thing = await thingService.create(result.data);
  res.json({ id: thing.id });
});
\`\`\`

## Output

When done, summarize:
- Files modified with brief description
- Any decisions made during implementation
- Anything that needs follow-up (tests, docs)`,
    model: 'sonnet'  // Changed from opus - implementation is standard work
  },

  /**
   * REVIEWER - Quality gate (Sonnet for analysis)
   *
   * Reviews code BEFORE shipping. Only high-confidence issues.
   */
  'reviewer': {
    description: 'Review code for bugs, security, quality before commit. Use AFTER coder.',
    tools: ['Read', 'Grep', 'Glob'],
    prompt: `# Code Review Agent

You are a senior engineer reviewing code before merge.

## Review Focus (High-Confidence Only)

Only report issues where you are ≥80% confident. No noise.

### 1. BUGS - Logic Errors
- Null/undefined access without checks
- Off-by-one errors in loops
- Race conditions in async code
- Incorrect boolean logic
- Unhandled promise rejections

### 2. SECURITY - OWASP Top 10
- Command injection (user input in shell)
- XSS (user input in HTML without escaping)
- SQL injection (string concatenation in queries)
- Hardcoded secrets (API keys, passwords in code)
- Missing authentication/authorization checks

### 3. SILENT FAILURES
- Empty catch blocks
- Errors logged but not propagated
- Fallback values hiding real problems
- Missing error handling on async operations

### 4. TYPE SAFETY
- Use of \`any\` type
- Missing generic constraints
- Type assertions (\`as\`) without validation
- Incorrect null handling

## Output Format

\`\`\`
## Review Summary

### Critical Issues (must fix)
- **[BUG]** \`file.ts:123\` - [description]
  Fix: [specific code change]

### Major Issues (should fix)
- **[SECURITY]** \`file.ts:45\` - [description]
  Fix: [specific code change]

### Minor Issues (nice to fix)
- **[STYLE]** \`file.ts:78\` - [description]

### Approved
[If no issues, say "Code looks good. No high-confidence issues found."]
\`\`\`

## Anti-Patterns to Avoid

- Don't report style preferences (formatting, naming opinions)
- Don't report potential issues ("this might be a problem")
- Don't suggest refactoring unrelated to the change
- Don't flag TODOs or missing features

## Positive Patterns to Acknowledge

If you see good patterns, briefly acknowledge:
- "Good error handling in X"
- "Clean separation of concerns"
- "Thorough input validation"`,
    model: 'sonnet'  // Changed from opus - review is analysis work
  },

  /**
   * UI BUILDER - Frontend implementation (Sonnet for balance)
   *
   * Specialized for React/Tailwind frontend work.
   */
  'uiBuilder': {
    description: 'Build production-grade UI with design thinking. Use for dashboard/frontend.',
    tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    prompt: `# UI Implementation Agent

You are a senior frontend engineer with design sensibility.

## Pre-Implementation Checklist

Before coding any UI:
- [ ] Who is the user? What are they trying to accomplish?
- [ ] What's the context? (dashboard, public site, admin tool)
- [ ] What existing components can I reuse?
- [ ] What's the interaction model? (forms, data display, navigation)

## Design Philosophy

### NEVER Generic
- No Inter, Roboto, Arial, system fonts
- No purple gradients on white backgrounds
- No generic card layouts without intention
- No AI-aesthetic blandness

### ALWAYS Distinctive
Choose a bold direction and commit:
- Brutally minimal OR maximalist density
- Retro-futuristic OR organic warmth
- Editorial precision OR playful chaos
- Industrial rawness OR soft elegance

## Implementation Standards

### React Patterns
\`\`\`typescript
// Functional components with proper typing
interface Props {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
}

export function FeatureCard({ title, onSubmit }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  // ...
}
\`\`\`

### Tailwind Usage
- Use design tokens (colors, spacing) consistently
- Prefer composition over @apply
- Mobile-first responsive design
- Use arbitrary values sparingly

### Motion
- Staggered entrance animations for lists
- Meaningful hover state transitions
- Loading state skeletons
- Page transition animations

### Accessibility
- Semantic HTML (button, nav, main, article)
- ARIA labels for icons and interactive elements
- Focus states for keyboard navigation
- Color contrast compliance

## Output

When done, describe:
- Design direction chosen and why
- Components created/modified
- Interactions implemented
- Any accessibility considerations`,
    model: 'sonnet'  // Changed from opus - UI work is standard implementation
  },

  /**
   * SHIP - Verification and git ops (Sonnet for reliability)
   *
   * Final step: verify build, commit, push, create PR.
   */
  'ship': {
    description: 'Verify build, commit, push, create PR. Use when code is ready.',
    tools: ['Bash', 'Read'],
    prompt: `# Ship Agent

You are the final gate before code goes to review.

## Pre-Ship Checklist

Run these in order:

1. **Type Check**
   \`npm run typecheck\`
   - Must pass with no errors
   - Warnings are acceptable but note them

2. **Build**
   \`npm run build\`
   - Must succeed
   - Note any warnings

3. **Git Status**
   \`git status\`
   - Review all changed files
   - Ensure no unintended changes
   - Check for any secrets or sensitive data

## Git Workflow

1. **Create Branch** (if not on feature branch)
   \`git checkout -b feature/{issue-id}-{short-description}\`

2. **Stage Changes**
   \`git add [specific files]\`
   - Never \`git add .\` blindly
   - Review what you're adding

3. **Commit**
   \`\`\`
   git commit -m "feat: [description]

   - [Change 1]
   - [Change 2]

   Closes #{issue-id}"
   \`\`\`

4. **Push**
   \`git push -u origin [branch-name]\`

5. **Create PR**
   Use \`complete_feature\` tool or \`gh pr create\`

## Output

Report:
- Verification status (pass/fail with details)
- Files committed
- Branch name
- PR URL (if created)

If anything fails, stop and report the error. Do not proceed.`,
    model: 'sonnet'  // Changed from opus - git ops are straightforward
  }
};

/**
 * Hooks for monitoring and context management
 */
const createHooks = () => ({
  // Track session start
  SessionStart: [{
    hooks: [async (input: SessionStartHookInput) => {
      console.log(`[Hook] Session started: ${input.session_id}`);
      sessionState.sessionId = input.session_id;
      sessionState.startTime = Date.now();
      return { continue: true };
    }] as HookCallback[]
  }],

  // Track tool usage before execution
  PreToolUse: [{
    hooks: [async (input: PreToolUseHookInput) => {
      const toolName = input.tool_name;
      console.log(`[Hook] Tool: ${toolName}`);
      sessionState.toolsUsed.push(toolName);

      // Track file modifications
      if (['Write', 'Edit'].includes(toolName)) {
        const filePath = (input.tool_input as any)?.file_path;
        if (filePath && !sessionState.filesModified.includes(filePath)) {
          sessionState.filesModified.push(filePath);
        }
      }

      // Track subagent invocations for learning
      if (toolName === 'Task' || toolName === 'delegate_to_agent') {
        const subagent = (input.tool_input as any)?.agent ||
                        (input.tool_input as any)?.subagent_type;
        if (subagent && !sessionState.subagentsUsed.includes(subagent)) {
          sessionState.subagentsUsed.push(subagent);
          console.log(`[Hook] Subagent: ${subagent}`);
        }
      }

      return { continue: true };
    }] as HookCallback[]
  }],

  // Log tool results
  PostToolUse: [{
    hooks: [async (input: PostToolUseHookInput) => {
      // Could add logging, metrics, or context updates here
      return { continue: true };
    }] as HookCallback[]
  }]
});

/**
 * Extract text content from SDK message
 */
function getMessageContent(message: SDKMessage): string {
  if (message.type === 'assistant' && message.message.content) {
    const content = message.message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
  }
  return '';
}

/**
 * Load progressive disclosure context for a task
 */
async function loadTaskContext(issue: Issue): Promise<{
  taskType: TaskType;
  skillContext: string;
  patternContext: string;
  correctionContext: string;
}> {
  const taskType = detectTaskType(issue.title, issue.description || '');
  console.log(`   Task type: ${taskType}`);

  // Load relevant skills based on task content
  const skills = await matchSkillsToTask(issue.title, issue.description || '');
  console.log(`   Skills matched: ${skills.map(s => s.metadata.name).join(', ') || 'none'}`);
  const skillContext = buildSkillContext(skills);

  // Load relevant patterns from past successes
  const patterns = await findRelevantPatterns(taskType, issue.title, issue.description || '');
  console.log(`   Patterns found: ${patterns.length}`);
  const patternContext = buildPatternContext(patterns);

  // Load warnings from past corrections
  const corrections = await getWarningsForTask(issue.title, issue.description || '');
  console.log(`   Corrections loaded: ${corrections.length}`);
  const correctionContext = buildCorrectionContext(corrections);

  return { taskType, skillContext, patternContext, correctionContext };
}

/**
 * Process a single issue using multi-agent architecture
 */
async function processIssue(issue: Issue): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${issue.identifier} - ${issue.title}`);
  console.log(`${'='.repeat(60)}\n`);

  // Load progressive disclosure context
  console.log('Loading task context...');
  const { taskType, skillContext, patternContext, correctionContext } = await loadTaskContext(issue);

  // Reset session state with loaded context
  sessionState = {
    currentIssue: issue,
    sessionId: null,
    toolsUsed: [],
    filesModified: [],
    startTime: Date.now(),
    taskType,
    skillContext,
    patternContext,
    correctionContext,
    // Reset learning fields
    keyDecisions: [],
    approachSummary: '',
    subagentsUsed: [],
    warnings: []
  };

  let retryCount = 0;
  let success = false;

  while (retryCount < MAX_RETRIES && !success) {
    try {
      retryCount++;
      console.log(`\nAttempt ${retryCount}/${MAX_RETRIES}`);

      // Build the task prompt with context
      const taskPrompt = buildTaskPrompt(issue, retryCount);

      // Run the agent with full SDK capabilities
      const response = query({
        prompt: taskPrompt,
        options: {
          model: 'claude-sonnet-4-5',
          cwd: WORKING_DIR,

          // Use Claude Code's full system prompt with custom append
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: `
## Current Task Context
You are working on Linear issue: ${issue.identifier}
Issue URL: ${issue.url}
Working Directory: ${WORKING_DIR}

## Development Standards
- Follow existing code patterns in the codebase
- Use TypeScript with strict typing
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Always work on feature branches, never main
- Create clear commit messages
- Run typecheck and build before committing`
          },

          // Use Claude Code's full tool set plus our MCP servers
          tools: { type: 'preset', preset: 'claude_code' },

          // Load CLAUDE.md for project context
          settingSources: ['project'],

          // Auto-approve file edits for autonomous operation
          permissionMode: 'acceptEdits',

          // Define specialized subagents
          agents: SUBAGENTS,

          // Add our MCP servers for Linear, Git, and Bash
          mcpServers: {
            linear: linearServer,
            git: gitServer,
            bash: bashServer
          },

          // Enable hooks for monitoring
          hooks: createHooks(),

          // Context management
          maxTurns: 50, // Limit conversation length
        }
      });

      // Process the response stream
      for await (const message of response) {
        switch (message.type) {
          case 'assistant':
            const content = getMessageContent(message);
            if (content) {
              // Truncate long outputs for logging
              const truncated = content.length > 500
                ? content.substring(0, 500) + '...[truncated]'
                : content;
              console.log('Agent:', truncated);
            }
            break;

          case 'result':
            if (message.subtype === 'success') {
              console.log('\n✅ Task completed successfully');
              console.log(`   Duration: ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s`);
              console.log(`   Tools used: ${sessionState.toolsUsed.length}`);
              console.log(`   Files modified: ${sessionState.filesModified.length}`);
              success = true;
            } else {
              console.error('\n❌ Task failed:', message.errors);
              throw new Error(`Agent error: ${message.errors?.join(', ')}`);
            }
            break;

          case 'system':
            if (message.subtype === 'init') {
              console.log(`Session: ${message.session_id}`);
              console.log(`Model: ${message.model}`);
              console.log(`Tools: ${message.tools.length} available`);
            }
            break;
        }
      }

    } catch (error) {
      console.error(`\n❌ Attempt ${retryCount} failed:`, error);

      if (retryCount >= MAX_RETRIES) {
        console.log('\n🚨 Max retries reached, escalating to human...');
        await escalateToHuman(issue, error);
      } else {
        console.log(`\n⏳ Retrying in 10 seconds...`);
        await sleep(10000);
      }
    }
  }

  return success;
}

/**
 * Build the task prompt for an issue - with progressive disclosure context
 *
 * Design principles:
 * - Task-type-specific workflows (bugfix != feature != refactor)
 * - Priority-based urgency signals
 * - Retry-aware guidance
 * - Explicit reasoning steps before action
 */
function buildTaskPrompt(issue: Issue, attemptNumber: number): string {
  const taskType = sessionState.taskType || 'unknown';
  const title = issue.title.toLowerCase();

  // Detect UI tasks for specialized workflow
  const isUITask = taskType === 'ui' ||
                   title.includes('dashboard') ||
                   title.includes('ui') ||
                   title.includes('frontend') ||
                   title.includes('component');

  // Priority-based urgency (Linear priorities: 1=urgent, 2=high, 3=medium, 4=low)
  const priority = issue.priority ?? 3;
  const urgencyNote = priority <= 2
    ? '\n\n🔴 **HIGH PRIORITY** - Focus on correctness over elegance. Ship fast, iterate later.'
    : '';

  // Task-type-specific workflows
  const workflows: Record<string, string> = {
    bugfix: `## Workflow: Bug Fix
1. Update Linear -> "In Progress"
2. **explorer** -> Find the bug location and root cause
   - Search for error messages, stack traces
   - Trace the code path that triggers the bug
   - Identify the minimum change needed
3. **coder** -> Fix the bug with minimal changes
   - Prefer targeted fixes over refactoring
   - Add test or assertion if appropriate
4. **reviewer** -> Verify fix doesn't introduce new issues
5. **ship** -> verify_build, complete_feature, complete_task`,

    feature: `## Workflow: New Feature
1. Update Linear -> "In Progress"
2. **explorer** -> Find similar features and patterns
   - How do existing features handle this?
   - What files will need changes?
   - Are there reusable components?
3. **thinker** -> Design the approach (2-3 options)
   - Consider minimal change vs clean architecture
   - Identify dependencies and risks
4. ${isUITask ? '**uiBuilder**' : '**coder**'} -> Implement following patterns
5. **reviewer** -> Check bugs, security, quality
6. **ship** -> verify_build, complete_feature, complete_task`,

    refactor: `## Workflow: Refactoring
1. Update Linear -> "In Progress"
2. **explorer** -> Map all usages of the code being refactored
   - Find all call sites and dependencies
   - Identify test coverage
3. **thinker** -> Plan the refactoring steps
   - Break into small, safe steps
   - Ensure each step can be verified
4. **coder** -> Refactor incrementally
   - Verify after each change
   - Keep commits small and focused
5. **reviewer** -> Ensure no behavior changes
6. **ship** -> verify_build, complete_feature, complete_task`,

    integration: `## Workflow: Integration
1. Update Linear -> "In Progress"
2. **explorer** -> Find existing integrations to follow
   - Check adapter patterns in src/adapters/
   - Find API client examples
3. **coder** -> Implement the integration
   - Use existing adapter patterns
   - Add proper error handling
   - Consider rate limiting, retries
4. **reviewer** -> Check security (API keys, auth)
5. **ship** -> verify_build, complete_feature, complete_task`,

    unknown: `## Workflow: General Task
1. Update Linear -> "In Progress"
2. **explorer** -> Understand the codebase context
3. **thinker** -> Plan if non-trivial
4. ${isUITask ? '**uiBuilder**' : '**coder**'} -> Implement changes
5. **reviewer** -> Quality check
6. **ship** -> verify_build, complete_feature, complete_task`
  };

  const workflow = workflows[taskType] || workflows.unknown;

  let prompt = `# ${issue.identifier}: ${issue.title}${urgencyNote}

${issue.description || 'No description.'}

**Task Type Detected:** ${taskType}

${workflow}

## Before You Start

Take 30 seconds to think:
1. What is the ACTUAL goal? (not just the stated task)
2. What could go wrong?
3. What's the simplest solution that works?

## Available Subagents
| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **explorer** | Find files, trace paths | ALWAYS use first |
| **thinker** | Architecture decisions | When 2+ valid approaches |
| **coder** | Write code | Standard implementation |
| **uiBuilder** | Frontend UI | Dashboard, components |
| **reviewer** | Quality gate | Before shipping |
| **ship** | Git + PR | When code is ready |

## Consolidated Tools
| Tool | What it does |
|------|--------------|
| verify_build | typecheck + build in one call |
| complete_feature | branch + commit + push + PR |
| complete_task | Linear status + comment + PR link |`;

  // Add progressive disclosure context
  if (sessionState.skillContext) {
    prompt += `\n\n---\n\n# Skill Context\n\n${sessionState.skillContext}`;
  }

  if (sessionState.patternContext) {
    prompt += `\n\n---\n\n# Past Successful Patterns\n\n${sessionState.patternContext}`;
  }

  if (sessionState.correctionContext) {
    prompt += `\n\n---\n\n# ⚠️ Avoid These Mistakes\n\n${sessionState.correctionContext}`;
  }

  // Retry-specific guidance
  if (attemptNumber > 1) {
    prompt += `\n\n---\n\n## ⚠️ Retry Attempt ${attemptNumber}/${MAX_RETRIES}

Previous attempt failed. Before continuing:

1. **Analyze the failure** - Use thinker to understand what went wrong
2. **Try a different approach** - Don't repeat the same steps
3. **Consider simpler solutions** - Maybe there's an easier way
4. **Ask for help if stuck** - Use assign_to_human if this isn't solvable autonomously

Common failure causes:
- Missed a dependency or file
- Made assumptions without exploring first
- Tried to do too much at once`;
  }

  return prompt;
}

/**
 * Escalate issue to human after max retries
 */
async function escalateToHuman(issue: Issue, error: unknown): Promise<void> {
  const reason = `Failed after ${MAX_RETRIES} attempts.

Last error:
\`\`\`
${error}
\`\`\`

Session stats:
- Tools used: ${sessionState.toolsUsed.length}
- Files modified: ${sessionState.filesModified.join(', ') || 'none'}
- Duration: ${((Date.now() - sessionState.startTime) / 1000).toFixed(1)}s`;

  try {
    const response = query({
      prompt: `Escalate ${issue.identifier}: ${reason.slice(0, 200)}. Use assign_to_human tool.`,
      options: {
        model: 'claude-haiku-3-5',
        mcpServers: { linear: linearServer }
      }
    });

    for await (const message of response) {
      if (message.type === 'assistant') {
        const content = getMessageContent(message);
        if (content) console.log('Escalation:', content);
      }
    }
  } catch (escError) {
    console.error('Failed to escalate:', escError);
  }
}

/**
 * Main agent loop
 *
 * Features:
 * - Circuit breaker: stops after MAX_CONSECUTIVE_FAILURES to prevent runaway costs
 * - Linear as source of truth (no features.json dependency)
 * - Verified handoff: confirms Linear status update before continuing
 */
export async function runAgent(): Promise<void> {
  console.log('\n🤖 Dev Agent v4 | Circuit Breaker Enabled');
  console.log(`   Agents: ${Object.keys(SUBAGENTS).join(', ')}`);
  console.log(`   Dir: ${WORKING_DIR}`);
  console.log(`   Poll: ${POLL_INTERVAL_MS / 1000}s | Retries: ${MAX_RETRIES}`);
  console.log(`   Circuit Breaker: ${MAX_CONSECUTIVE_FAILURES} consecutive failures\n`);

  // Session startup - read previous state (advisory only)
  await sessionStartup();

  // Initialize repository
  console.log('\n📁 Initializing repository...');
  try {
    const initResponse = query({
      prompt: `Initialize the repository:
1. Check git status
2. Ensure we're on main branch
3. Pull latest changes
4. Report current state`,
      options: {
        model: 'claude-sonnet-4-5',
        cwd: WORKING_DIR,
        mcpServers: { git: gitServer, bash: bashServer },
        permissionMode: 'acceptEdits'
      }
    });

    for await (const message of initResponse) {
      if (message.type === 'assistant') {
        const content = getMessageContent(message);
        if (content) console.log(content);
      }
    }
  } catch (initError) {
    console.error('Repository init warning:', initError);
  }

  // Circuit breaker tracking
  let consecutiveFailures = 0;
  let lastProcessedIssue: string | null = null;

  // Main loop
  console.log('\n🔄 Starting main loop...\n');

  while (true) {
    try {
      console.log('\n--- Checking for new tasks ---');

      // Fetch todo issues directly from Linear (source of truth)
      const viewer = await linearClient.viewer;
      const issues = await linearClient.issues({
        filter: {
          assignee: { id: { eq: viewer.id } },
          state: { name: { eq: 'Todo' } }
        },
        first: 10
      });

      // Map and sort by priority (urgent first), then by issue number
      const issueList: Issue[] = issues.nodes
        .map(issue => ({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description || undefined,
          url: issue.url,
          priority: issue.priority ?? 3 // Default to medium if not set
        }))
        .sort((a, b) => {
          // Sort by priority first (lower = more urgent)
          const priorityDiff = (a.priority ?? 3) - (b.priority ?? 3);
          if (priorityDiff !== 0) return priorityDiff;
          // Then by issue number
          const numA = parseInt(a.identifier.split('-')[1]) || 0;
          const numB = parseInt(b.identifier.split('-')[1]) || 0;
          return numA - numB;
        });

      console.log(`Found ${issueList.length} issue(s) assigned to ${viewer.name}`);

      if (issueList.length === 0) {
        console.log('📭 No tasks in queue. Waiting...');
        consecutiveFailures = 0; // Reset on empty queue
      } else {
        // Process the first issue
        const issue = issueList[0];

        // Circuit breaker: detect if we're stuck on the same issue
        if (lastProcessedIssue === issue.identifier) {
          consecutiveFailures++;
          console.log(`⚠️ Same issue again: ${issue.identifier} (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED`);
            console.error(`   Processed ${issue.identifier} ${consecutiveFailures} times`);
            console.error(`   Issue is stuck in Todo queue - Linear update may be failing`);
            console.error(`   STOPPING to prevent runaway costs\n`);

            // Add a comment to the issue explaining why we stopped
            try {
              await linearClient.createComment({
                issueId: issue.id,
                body: `## 🛑 Circuit Breaker Triggered\n\nDev agent has stopped after ${consecutiveFailures} consecutive attempts on this issue.\n\n**Possible causes:**\n- Linear API failing to update status\n- Task completing but status not moving to Done\n- Network issues\n\n**Action required:** Manual review needed.\n\n---\n*Circuit breaker triggered by dev-agent*`
              });
            } catch (commentErr) {
              console.error('Could not add circuit breaker comment:', commentErr);
            }

            // Exit the loop entirely
            break;
          }
        } else {
          consecutiveFailures = 0; // Reset when processing a new issue
        }

        lastProcessedIssue = issue.identifier;

        const success = await processIssue(issue);

        // Session handoff - MUST return true for Linear update
        const handoffSuccess = await sessionHandoff(issue, success);

        if (!handoffSuccess) {
          console.error(`\n⚠️ HANDOFF FAILED: Linear status not updated for ${issue.identifier}`);
          consecutiveFailures++;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED: Linear updates failing`);
            console.error(`   Stopping to prevent infinite loop\n`);
            break;
          }
        } else if (success) {
          console.log(`\n✅ Completed and verified: ${issue.identifier}`);
          consecutiveFailures = 0; // Reset on verified success
        } else {
          console.log(`\n❌ Failed: ${issue.identifier} (escalated to human)`);
          // Don't reset consecutiveFailures - task failures count toward breaker
        }
      }

      // Wait before checking again
      console.log(`\n⏰ Waiting ${POLL_INTERVAL_MS / 1000}s before next check...`);
      await sleep(POLL_INTERVAL_MS);

    } catch (error) {
      console.error('❌ Error in main loop:', error);
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`\n🛑 CIRCUIT BREAKER TRIGGERED: Too many errors`);
        break;
      }

      console.log('🔄 Recovering in 60 seconds...');
      await sleep(60000);
    }
  }

  // If we exit the loop, log final state
  console.log('\n========================================');
  console.log('DEV AGENT STOPPED');
  console.log(`Consecutive failures: ${consecutiveFailures}`);
  console.log(`Last issue: ${lastProcessedIssue || 'none'}`);
  console.log('Check Railway logs and Linear for details.');
  console.log('========================================\n');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

---
name: agent-patterns
description: Claude Agent SDK patterns, skill authoring, sub-agent orchestration
triggers: [agent, sdk, subagent, orchestration, tool, skill]
priority: 3
alwaysLoad: false
---

# Agent Patterns Skill

Patterns and best practices for building Claude-powered agents.

## Core Concepts

### Agent Loop

The fundamental agent loop:

```
1. Receive message
2. Build context (system prompt + skills + history)
3. Call Claude API
4. If tool_use -> execute tool -> add result -> goto 3
5. If end_turn -> return response
```

### Progressive Disclosure

Load information in layers to optimize context:

| Level | Content | When to Load |
|-------|---------|--------------|
| L1 | Name + description | Always in system prompt |
| L2 | Full skill content | On demand via tool |
| L3 | Reference files | Only when explicitly needed |

Benefits:
- Smaller context = faster responses
- More focused reasoning
- Better token efficiency

## System Prompt Structure

```markdown
# Agent Name

[Role description in 1-2 sentences]

## Capabilities
[Bulleted list of what the agent can do]

## Available Tools
[Brief description of each tool category]

## Available Skills
[L1: Name + description pairs]

## Guidelines
[Behavioral rules and constraints]

## Examples
[Optional: few-shot examples for complex tasks]
```

## Tool Design

### Tool Schema Best Practices

```typescript
{
  name: 'verb_noun',  // e.g., create_issue, search_documents
  description: 'Clear one-line description. Returns X.',
  input_schema: {
    type: 'object',
    properties: {
      // Required params first
      requiredParam: {
        type: 'string',
        description: 'What this is and valid values',
      },
      // Optional params after
      optionalParam: {
        type: 'number',
        description: 'Purpose. Default: X',
      },
    },
    required: ['requiredParam'],
  },
}
```

### Tool Response Format

Always return JSON with consistent structure:

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: 'Human-readable message' }
```

## Sub-Agent Orchestration

### When to Use Sub-Agents

- Complex tasks requiring specialized expertise
- Different model requirements (cost/capability tradeoff)
- Parallel processing of independent tasks
- Isolation of failure domains

### Sub-Agent Pattern

```typescript
interface SubAgent {
  name: string;
  model: 'opus' | 'sonnet' | 'haiku';
  systemPrompt: string;
  tools: Tool[];
}

async function delegateToAgent(
  agent: SubAgent,
  task: string,
  context?: string
): Promise<AgentResult> {
  // Build messages
  // Run tool loop
  // Return result
}
```

### Model Selection

| Model | Use For | Cost |
|-------|---------|------|
| **Opus** | Complex reasoning, planning, creative | $$$ |
| **Sonnet** | Balanced tasks, most use cases | $$ |
| **Haiku** | Simple tasks, quick responses | $ |

## Skill Authoring

### SKILL.md Structure

```markdown
---
name: skill-name
description: One-line description for L1 summary
triggers: [keyword1, keyword2]
priority: 2
alwaysLoad: false
---

# Skill Name

[Expanded description]

## When to Use
[Triggers and contexts]

## Process
[Step-by-step instructions]

## Templates
[Reusable patterns]

## Examples
[Concrete examples]
```

### Skill Best Practices

1. **Focused scope** - One skill, one purpose
2. **Clear triggers** - Keywords that activate the skill
3. **Actionable content** - Instructions, not just information
4. **Examples included** - Show, don't just tell
5. **Priority order** - 1 = always load, 10 = rarely needed

## Error Handling

### Graceful Degradation

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return {
    success: false,
    error: 'Could not complete X. Try Y instead.',
    suggestion: 'Alternative approach...',
  };
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(delay * attempt);  // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}
```

## Conversation Management

### Context Window Optimization

- Summarize long conversations periodically
- Drop old tool results after processing
- Use L1 skills by default, L2+ on demand

### State Management

```typescript
interface ConversationState {
  messages: Message[];
  currentTask?: string;
  loadedSkills: Set<string>;
  activeSubAgents: string[];
}
```

## Testing Agents

### Unit Testing Tools

```typescript
describe('createIssue', () => {
  it('creates issue with required fields', async () => {
    const result = await createIssue({
      title: 'Test',
      teamId: 'team-123',
    });
    expect(result.id).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('DevAgent', () => {
  it('handles implementation request', async () => {
    const agent = createDevAgent();
    const response = await agent.process(linearIssue);
    expect(response.status).toBe('completed');
  });
});
```

## Security Considerations

1. **Validate all tool inputs** with Zod or similar
2. **Never expose API keys** in responses
3. **Sanitize user input** before tool execution
4. **Rate limit** tool calls to prevent abuse
5. **Audit log** sensitive operations

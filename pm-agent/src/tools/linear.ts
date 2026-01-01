/**
 * Linear API Tools
 * Provides typed tools for Linear issue management via GraphQL API
 */

import { LinearClient, Issue, IssueConnection, Team, User, Project, IssueSearchResult } from '@linear/sdk';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

// Initialize Linear client
let linearClient: LinearClient | null = null;

export function initializeLinear(apiKey: string): void {
  linearClient = new LinearClient({ apiKey });
}

function getClient(): LinearClient {
  if (!linearClient) {
    throw new Error('Linear client not initialized. Call initializeLinear() first.');
  }
  return linearClient;
}

// Tool Schemas
export const CreateIssueSchema = z.object({
  title: z.string().describe('Issue title'),
  description: z.string().optional().describe('Issue description in markdown'),
  teamId: z.string().describe('Team ID to create issue in'),
  projectId: z.string().optional().describe('Project ID to associate with'),
  priority: z.number().min(0).max(4).optional().describe('Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low'),
  estimate: z.number().optional().describe('Story points estimate'),
  labels: z.array(z.string()).optional().describe('Label IDs to apply'),
  assigneeId: z.string().optional().describe('User ID to assign'),
  parentId: z.string().optional().describe('Parent issue ID for sub-issues'),
});

export const UpdateIssueSchema = z.object({
  issueId: z.string().describe('Issue ID to update'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  stateId: z.string().optional().describe('New state ID'),
  priority: z.number().min(0).max(4).optional().describe('New priority'),
  estimate: z.number().optional().describe('New estimate'),
  assigneeId: z.string().optional().describe('New assignee ID'),
});

export const ListIssuesSchema = z.object({
  teamId: z.string().optional().describe('Filter by team ID'),
  projectId: z.string().optional().describe('Filter by project ID'),
  assigneeId: z.string().optional().describe('Filter by assignee ID'),
  stateType: z.enum(['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled']).optional(),
  first: z.number().default(50).describe('Number of issues to fetch'),
});

export const GetIssueSchema = z.object({
  issueId: z.string().describe('Issue ID or identifier (e.g., ABC-123)'),
});

export const SearchIssuesSchema = z.object({
  query: z.string().describe('Search query'),
  first: z.number().default(20).describe('Number of results'),
});

export const ListTeamsSchema = z.object({});

export const ListProjectsSchema = z.object({
  teamId: z.string().optional().describe('Filter by team ID'),
});

export const GetViewIssuesSchema = z.object({
  viewName: z.enum(['Up Next', 'Active Work', 'Blocked']).describe('View name to fetch'),
});

// Tool Implementations
export async function createIssue(input: z.infer<typeof CreateIssueSchema>): Promise<Issue> {
  const client = getClient();
  const result = await client.createIssue({
    title: input.title,
    description: input.description,
    teamId: input.teamId,
    projectId: input.projectId,
    priority: input.priority,
    estimate: input.estimate,
    labelIds: input.labels,
    assigneeId: input.assigneeId,
    parentId: input.parentId,
  });

  const issue = await result.issue;
  if (!issue) {
    throw new Error('Failed to create issue');
  }
  return issue;
}

export async function updateIssue(input: z.infer<typeof UpdateIssueSchema>): Promise<Issue> {
  const client = getClient();
  const result = await client.updateIssue(input.issueId, {
    title: input.title,
    description: input.description,
    stateId: input.stateId,
    priority: input.priority,
    estimate: input.estimate,
    assigneeId: input.assigneeId,
  });

  const issue = await result.issue;
  if (!issue) {
    throw new Error('Failed to update issue');
  }
  return issue;
}

export async function listIssues(input: z.infer<typeof ListIssuesSchema>): Promise<Issue[]> {
  const client = getClient();

  const filter: Record<string, unknown> = {};
  if (input.teamId) filter.team = { id: { eq: input.teamId } };
  if (input.projectId) filter.project = { id: { eq: input.projectId } };
  if (input.assigneeId) filter.assignee = { id: { eq: input.assigneeId } };
  if (input.stateType) filter.state = { type: { eq: input.stateType } };

  const issues = await client.issues({
    first: input.first,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return issues.nodes;
}

export async function getIssue(input: z.infer<typeof GetIssueSchema>): Promise<Issue> {
  const client = getClient();
  const issue = await client.issue(input.issueId);
  return issue;
}

export async function searchIssues(input: z.infer<typeof SearchIssuesSchema>): Promise<IssueSearchResult[]> {
  const client = getClient();
  const results = await client.searchIssues(input.query, { first: input.first });
  return results.nodes;
}

export async function listTeams(_input: z.infer<typeof ListTeamsSchema>): Promise<Team[]> {
  const client = getClient();
  const teams = await client.teams();
  return teams.nodes;
}

export async function listProjects(input: z.infer<typeof ListProjectsSchema>): Promise<Project[]> {
  const client = getClient();

  const filter: Record<string, unknown> = {};
  if (input.teamId) {
    filter.accessibleTeams = { some: { id: { eq: input.teamId } } };
  }

  const projects = await client.projects({
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return projects.nodes;
}

export async function getViewIssues(input: z.infer<typeof GetViewIssuesSchema>): Promise<Issue[]> {
  const client = getClient();

  // Map view names to state types
  const stateTypeMap: Record<string, string[]> = {
    'Up Next': ['unstarted'],
    'Active Work': ['started'],
    'Blocked': ['started'], // We'll filter by label below
  };

  const stateTypes = stateTypeMap[input.viewName];

  const filter: Record<string, unknown> = {
    state: { type: { in: stateTypes } },
  };

  // For "Blocked" view, also check for blocked label
  if (input.viewName === 'Blocked') {
    filter.labels = { some: { name: { containsIgnoreCase: 'blocked' } } };
  }

  const issues = await client.issues({
    first: 50,
    filter,
    orderBy: { updatedAt: 'DESC' } as any,
  });

  return issues.nodes;
}

export async function getCurrentUser(): Promise<User> {
  const client = getClient();
  return client.viewer;
}

// Format issue for display
export function formatIssue(issue: Issue): string {
  return `[${issue.identifier}] ${issue.title} (Priority: ${issue.priority ?? 'none'})`;
}

export function formatIssueDetailed(issue: Issue): string {
  return `
**${issue.identifier}: ${issue.title}**
- Priority: ${issue.priority ?? 'none'}
- Estimate: ${issue.estimate ?? 'none'}
- URL: ${issue.url}
${issue.description ? `\n${issue.description}` : ''}
`.trim();
}

// Tool definitions for Anthropic API
export const linearTools: Anthropic.Tool[] = [
  {
    name: 'linear_create_issue',
    description: 'Create a new Linear issue. Returns the created issue with ID and URL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Issue title' },
        description: { type: 'string', description: 'Issue description in markdown' },
        teamId: { type: 'string', description: 'Team ID to create issue in' },
        projectId: { type: 'string', description: 'Project ID to associate with' },
        priority: { type: 'number', description: 'Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low' },
        estimate: { type: 'number', description: 'Story points estimate' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Label IDs to apply' },
        assigneeId: { type: 'string', description: 'User ID to assign' },
        parentId: { type: 'string', description: 'Parent issue ID for sub-issues' },
      },
      required: ['title', 'teamId'],
    },
  },
  {
    name: 'linear_update_issue',
    description: 'Update an existing Linear issue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        issueId: { type: 'string', description: 'Issue ID to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        stateId: { type: 'string', description: 'New state ID' },
        priority: { type: 'number', description: 'New priority' },
        estimate: { type: 'number', description: 'New estimate' },
        assigneeId: { type: 'string', description: 'New assignee ID' },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'linear_list_issues',
    description: 'List Linear issues with optional filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        teamId: { type: 'string', description: 'Filter by team ID' },
        projectId: { type: 'string', description: 'Filter by project ID' },
        assigneeId: { type: 'string', description: 'Filter by assignee ID' },
        stateType: {
          type: 'string',
          enum: ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'],
          description: 'Filter by state type'
        },
        first: { type: 'number', description: 'Number of issues to fetch (default: 50)' },
      },
      required: [],
    },
  },
  {
    name: 'linear_get_issue',
    description: 'Get a specific Linear issue by ID or identifier (e.g., ABC-123).',
    input_schema: {
      type: 'object' as const,
      properties: {
        issueId: { type: 'string', description: 'Issue ID or identifier' },
      },
      required: ['issueId'],
    },
  },
  {
    name: 'linear_search_issues',
    description: 'Search Linear issues by text query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        first: { type: 'number', description: 'Number of results (default: 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'linear_list_teams',
    description: 'List all teams in the Linear workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'linear_list_projects',
    description: 'List projects, optionally filtered by team.',
    input_schema: {
      type: 'object' as const,
      properties: {
        teamId: { type: 'string', description: 'Filter by team ID' },
      },
      required: [],
    },
  },
  {
    name: 'linear_get_view_issues',
    description: 'Get issues from a predefined view (Up Next, Active Work, or Blocked).',
    input_schema: {
      type: 'object' as const,
      properties: {
        viewName: {
          type: 'string',
          enum: ['Up Next', 'Active Work', 'Blocked'],
          description: 'View name to fetch'
        },
      },
      required: ['viewName'],
    },
  },
];

// Tool executor
export async function executeLinearTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'linear_create_issue': {
        const validated = CreateIssueSchema.parse(input);
        const issue = await createIssue(validated);
        return JSON.stringify({
          success: true,
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
          },
        });
      }

      case 'linear_update_issue': {
        const validated = UpdateIssueSchema.parse(input);
        const issue = await updateIssue(validated);
        return JSON.stringify({
          success: true,
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
          },
        });
      }

      case 'linear_list_issues': {
        const validated = ListIssuesSchema.parse(input);
        const issues = await listIssues(validated);
        return JSON.stringify({
          success: true,
          count: issues.length,
          issues: issues.map(i => ({
            id: i.id,
            identifier: i.identifier,
            title: i.title,
            priority: i.priority,
            estimate: i.estimate,
            url: i.url,
          })),
        });
      }

      case 'linear_get_issue': {
        const validated = GetIssueSchema.parse(input);
        const issue = await getIssue(validated);
        return JSON.stringify({
          success: true,
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            estimate: issue.estimate,
            url: issue.url,
          },
        });
      }

      case 'linear_search_issues': {
        const validated = SearchIssuesSchema.parse(input);
        const issues = await searchIssues(validated);
        return JSON.stringify({
          success: true,
          count: issues.length,
          issues: issues.map(i => ({
            id: i.id,
            identifier: i.identifier,
            title: i.title,
            url: i.url,
          })),
        });
      }

      case 'linear_list_teams': {
        const teams = await listTeams({});
        return JSON.stringify({
          success: true,
          teams: teams.map(t => ({
            id: t.id,
            name: t.name,
            key: t.key,
          })),
        });
      }

      case 'linear_list_projects': {
        const validated = ListProjectsSchema.parse(input);
        const projects = await listProjects(validated);
        return JSON.stringify({
          success: true,
          projects: projects.map(p => ({
            id: p.id,
            name: p.name,
            state: p.state,
          })),
        });
      }

      case 'linear_get_view_issues': {
        const validated = GetViewIssuesSchema.parse(input);
        const issues = await getViewIssues(validated);
        return JSON.stringify({
          success: true,
          view: validated.viewName,
          count: issues.length,
          issues: issues.map(i => ({
            id: i.id,
            identifier: i.identifier,
            title: i.title,
            priority: i.priority,
            url: i.url,
          })),
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ success: false, error: message });
  }
}

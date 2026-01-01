/**
 * Linear MCP Server
 * Provides Linear issue management tools via Model Context Protocol
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { LinearClient, Issue, Team, Project, IssueSearchResult } from '@linear/sdk';
import { z } from 'zod';

// Linear client instance
let linearClient: LinearClient | null = null;

export function initializeLinearClient(apiKey: string): void {
  linearClient = new LinearClient({ apiKey });
}

function getClient(): LinearClient {
  if (!linearClient) {
    throw new Error('Linear client not initialized. Set LINEAR_API_KEY environment variable.');
  }
  return linearClient;
}

// Create the Linear MCP server with tools
export function createLinearMcpServer() {
  // Auto-initialize from environment if not already done
  if (!linearClient && process.env.LINEAR_API_KEY) {
    initializeLinearClient(process.env.LINEAR_API_KEY);
  }

  return createSdkMcpServer({
    name: 'linear',
    version: '1.0.0',
    tools: [
      tool(
        'linear_create_issue',
        'Create a new Linear issue. Returns the created issue with ID and URL.',
        {
          title: z.string().describe('Issue title'),
          description: z.string().optional().describe('Issue description in markdown'),
          teamId: z.string().describe('Team ID to create issue in'),
          projectId: z.string().optional().describe('Project ID to associate with'),
          priority: z.number().min(0).max(4).optional().describe('Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low'),
          estimate: z.number().optional().describe('Story points estimate'),
          labels: z.array(z.string()).optional().describe('Label IDs to apply'),
          assigneeId: z.string().optional().describe('User ID to assign'),
          parentId: z.string().optional().describe('Parent issue ID for sub-issues'),
        },
        async (args) => {
          try {
            const client = getClient();
            const result = await client.createIssue({
              title: args.title,
              description: args.description,
              teamId: args.teamId,
              projectId: args.projectId,
              priority: args.priority,
              estimate: args.estimate,
              labelIds: args.labels,
              assigneeId: args.assigneeId,
              parentId: args.parentId,
            });

            const issue = await result.issue;
            if (!issue) {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Failed to create issue' }) }] };
            }

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  issue: {
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    url: issue.url,
                  },
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_update_issue',
        'Update an existing Linear issue.',
        {
          issueId: z.string().describe('Issue ID to update'),
          title: z.string().optional().describe('New title'),
          description: z.string().optional().describe('New description'),
          stateId: z.string().optional().describe('New state ID'),
          priority: z.number().min(0).max(4).optional().describe('New priority'),
          estimate: z.number().optional().describe('New estimate'),
          assigneeId: z.string().optional().describe('New assignee ID'),
        },
        async (args) => {
          try {
            const client = getClient();
            const result = await client.updateIssue(args.issueId, {
              title: args.title,
              description: args.description,
              stateId: args.stateId,
              priority: args.priority,
              estimate: args.estimate,
              assigneeId: args.assigneeId,
            });

            const issue = await result.issue;
            if (!issue) {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Failed to update issue' }) }] };
            }

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  issue: {
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    url: issue.url,
                  },
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_list_issues',
        'List Linear issues with optional filters.',
        {
          teamId: z.string().optional().describe('Filter by team ID'),
          projectId: z.string().optional().describe('Filter by project ID'),
          assigneeId: z.string().optional().describe('Filter by assignee ID'),
          stateType: z.enum(['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled']).optional().describe('Filter by state type'),
          first: z.number().default(50).describe('Number of issues to fetch'),
        },
        async (args) => {
          try {
            const client = getClient();
            const filter: Record<string, unknown> = {};
            if (args.teamId) filter.team = { id: { eq: args.teamId } };
            if (args.projectId) filter.project = { id: { eq: args.projectId } };
            if (args.assigneeId) filter.assignee = { id: { eq: args.assigneeId } };
            if (args.stateType) filter.state = { type: { eq: args.stateType } };

            const issues = await client.issues({
              first: args.first,
              filter: Object.keys(filter).length > 0 ? filter : undefined,
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  count: issues.nodes.length,
                  issues: issues.nodes.map(i => ({
                    id: i.id,
                    identifier: i.identifier,
                    title: i.title,
                    priority: i.priority,
                    estimate: i.estimate,
                    url: i.url,
                  })),
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_get_issue',
        'Get a specific Linear issue by ID or identifier (e.g., ABC-123).',
        {
          issueId: z.string().describe('Issue ID or identifier'),
        },
        async (args) => {
          try {
            const client = getClient();
            const issue = await client.issue(args.issueId);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
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
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_search_issues',
        'Search Linear issues by text query.',
        {
          query: z.string().describe('Search query'),
          first: z.number().default(20).describe('Number of results'),
        },
        async (args) => {
          try {
            const client = getClient();
            const results = await client.searchIssues(args.query, { first: args.first });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  count: results.nodes.length,
                  issues: results.nodes.map(i => ({
                    id: i.id,
                    identifier: i.identifier,
                    title: i.title,
                    url: i.url,
                  })),
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_list_teams',
        'List all teams in the Linear workspace.',
        {},
        async () => {
          try {
            const client = getClient();
            const teams = await client.teams();

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  teams: teams.nodes.map(t => ({
                    id: t.id,
                    name: t.name,
                    key: t.key,
                  })),
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_list_projects',
        'List projects, optionally filtered by team.',
        {
          teamId: z.string().optional().describe('Filter by team ID'),
        },
        async (args) => {
          try {
            const client = getClient();
            const filter: Record<string, unknown> = {};
            if (args.teamId) {
              filter.accessibleTeams = { some: { id: { eq: args.teamId } } };
            }

            const projects = await client.projects({
              filter: Object.keys(filter).length > 0 ? filter : undefined,
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  projects: projects.nodes.map(p => ({
                    id: p.id,
                    name: p.name,
                    state: p.state,
                  })),
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),

      tool(
        'linear_get_view_issues',
        'Get issues from a predefined view (Up Next, Active Work, or Blocked).',
        {
          viewName: z.enum(['Up Next', 'Active Work', 'Blocked']).describe('View name to fetch'),
        },
        async (args) => {
          try {
            const client = getClient();

            // Map view names to state types
            const stateTypeMap: Record<string, string[]> = {
              'Up Next': ['unstarted'],
              'Active Work': ['started'],
              'Blocked': ['started'],
            };

            const stateTypes = stateTypeMap[args.viewName];
            const filter: Record<string, unknown> = {
              state: { type: { in: stateTypes } },
            };

            // For "Blocked" view, also check for blocked label
            if (args.viewName === 'Blocked') {
              filter.labels = { some: { name: { containsIgnoreCase: 'blocked' } } };
            }

            const issues = await client.issues({
              first: 50,
              filter,
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  view: args.viewName,
                  count: issues.nodes.length,
                  issues: issues.nodes.map(i => ({
                    id: i.id,
                    identifier: i.identifier,
                    title: i.title,
                    priority: i.priority,
                    url: i.url,
                  })),
                }),
              }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true };
          }
        }
      ),
    ],
  });
}

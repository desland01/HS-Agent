/**
 * Linear API Tools for Dev Agent
 *
 * These tools allow the agent to interact with Linear for task management:
 * - Fetch assigned issues
 * - Update issue status
 * - Add comments
 * - Create sub-issues
 * - Assign to human (escalation)
 */

import { LinearClient } from '@linear/sdk';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Initialize Linear client
const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY!
});

// Workflow states mapping (matches Grovestreetpainting Linear workspace)
const WORKFLOW_STATES = {
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done'
} as const;

/**
 * Linear MCP Server with all tools
 */
export const linearServer = createSdkMcpServer({
  name: 'linear',
  version: '1.0.0',
  tools: [
    // Get assigned issues from Linear
    tool(
      'get_assigned_issues',
      'Fetch all issues assigned to the dev agent from Linear. Returns issues in priority order.',
      {
        status: z.enum(['todo', 'in_progress', 'review', 'all']).default('todo')
          .describe('Filter by status: todo, in_progress, review, or all'),
        limit: z.number().min(1).max(50).default(10)
          .describe('Maximum number of issues to return')
      },
      async (args) => {
        try {
          const viewer = await linearClient.viewer;
          const me = await viewer;

          // Build filter based on status
          const filter: any = {
            assignee: { id: { eq: me.id } }
          };

          if (args.status !== 'all') {
            filter.state = { name: { eq: WORKFLOW_STATES[args.status] } };
          }

          const issues = await linearClient.issues({
            filter,
            first: args.limit
          });

          const issueList = issues.nodes.map(issue => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            state: issue.state,
            url: issue.url
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(issueList, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error fetching issues: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Get details of a specific issue
    tool(
      'get_issue_details',
      'Get full details of a specific Linear issue including description, comments, and attachments.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier (e.g., "HSA-123")')
      },
      async (args) => {
        try {
          const issue = await linearClient.issue(args.issueId);

          if (!issue) {
            return {
              content: [{
                type: 'text',
                text: `Issue ${args.issueId} not found`
              }],
              isError: true
            };
          }

          // Get comments
          const comments = await issue.comments();
          const commentList = await Promise.all(
            comments.nodes.map(async c => {
              const user = await c.user;
              return {
                author: user?.name,
                body: c.body,
                createdAt: c.createdAt
              };
            })
          );

          const details = {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            state: await issue.state,
            labels: (await issue.labels()).nodes.map(l => l.name),
            comments: commentList,
            url: issue.url,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(details, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error fetching issue details: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Update issue status
    tool(
      'update_issue_status',
      'Move a Linear issue to a different workflow state (Todo, In Progress, Review, Done).',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        status: z.enum(['todo', 'in_progress', 'review', 'done'])
          .describe('The new status for the issue')
      },
      async (args) => {
        try {
          const issue = await linearClient.issue(args.issueId);
          if (!issue) {
            return {
              content: [{ type: 'text', text: `Issue ${args.issueId} not found` }],
              isError: true
            };
          }

          // Get the team to find workflow states
          const team = await issue.team;
          const states = await team?.states();
          const targetState = states?.nodes.find(
            s => s.name.toLowerCase() === WORKFLOW_STATES[args.status].toLowerCase()
          );

          if (!targetState) {
            return {
              content: [{
                type: 'text',
                text: `Status "${args.status}" not found in workflow`
              }],
              isError: true
            };
          }

          await linearClient.updateIssue(issue.id, {
            stateId: targetState.id
          });

          return {
            content: [{
              type: 'text',
              text: `Issue ${args.issueId} moved to "${WORKFLOW_STATES[args.status]}"`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error updating issue status: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Add comment to issue
    tool(
      'add_comment',
      'Add a comment to a Linear issue. Use for progress updates, blockers, or completion notes.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        body: z.string().describe('The comment content (supports markdown)')
      },
      async (args) => {
        try {
          await linearClient.createComment({
            issueId: args.issueId,
            body: args.body
          });

          return {
            content: [{
              type: 'text',
              text: `Comment added to issue ${args.issueId}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error adding comment: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Create sub-issue
    tool(
      'create_sub_issue',
      'Create a sub-issue under a parent issue. Use for breaking down complex tasks.',
      {
        parentIssueId: z.string().describe('The parent issue ID or identifier'),
        title: z.string().describe('Title of the sub-issue'),
        description: z.string().optional().describe('Description of the sub-issue')
      },
      async (args) => {
        try {
          const parentIssue = await linearClient.issue(args.parentIssueId);
          if (!parentIssue) {
            return {
              content: [{ type: 'text', text: `Parent issue ${args.parentIssueId} not found` }],
              isError: true
            };
          }

          const team = await parentIssue.team;

          const newIssue = await linearClient.createIssue({
            teamId: team!.id,
            title: args.title,
            description: args.description,
            parentId: parentIssue.id
          });

          const createdIssue = await newIssue.issue;

          return {
            content: [{
              type: 'text',
              text: `Sub-issue created: ${createdIssue?.identifier} - ${createdIssue?.title}\nURL: ${createdIssue?.url}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error creating sub-issue: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Assign to human (escalation)
    tool(
      'assign_to_human',
      'Reassign an issue to a human team member. Use after 3 failed retries or for tasks requiring human judgment.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        reason: z.string().describe('Reason for escalation'),
        assigneeEmail: z.string().email().optional()
          .describe('Email of the human to assign to (defaults to team lead)')
      },
      async (args) => {
        try {
          const issue = await linearClient.issue(args.issueId);
          if (!issue) {
            return {
              content: [{ type: 'text', text: `Issue ${args.issueId} not found` }],
              isError: true
            };
          }

          // Find the assignee
          let assigneeId: string | undefined;
          if (args.assigneeEmail) {
            const users = await linearClient.users();
            const assignee = users.nodes.find(u => u.email === args.assigneeEmail);
            assigneeId = assignee?.id;
          }

          // Add escalation comment
          await linearClient.createComment({
            issueId: issue.id,
            body: `## Escalated to Human\n\n**Reason:** ${args.reason}\n\n---\n*This issue was escalated by the dev agent after encountering a blocker.*`
          });

          // Update the issue
          const updateData: any = {
            priority: 1 // Set to urgent
          };
          if (assigneeId) {
            updateData.assigneeId = assigneeId;
          }

          await linearClient.updateIssue(issue.id, updateData);

          return {
            content: [{
              type: 'text',
              text: `Issue ${args.issueId} escalated to human. Reason: ${args.reason}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error escalating issue: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // Link PR to issue
    tool(
      'link_pr_to_issue',
      'Add a pull request link to a Linear issue comment.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        prUrl: z.string().url().describe('The GitHub PR URL'),
        prTitle: z.string().optional().describe('Optional PR title')
      },
      async (args) => {
        try {
          const body = args.prTitle
            ? `## Pull Request Created\n\n**[${args.prTitle}](${args.prUrl})**\n\nReady for review.`
            : `## Pull Request Created\n\n${args.prUrl}\n\nReady for review.`;

          await linearClient.createComment({
            issueId: args.issueId,
            body
          });

          return {
            content: [{
              type: 'text',
              text: `PR linked to issue ${args.issueId}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error linking PR: ${error}`
            }],
            isError: true
          };
        }
      }
    ),

    // CONSOLIDATED: Complete task workflow (move to review + link PR + add completion comment)
    tool(
      'complete_task',
      'Complete a task in one operation: moves issue to "In Review", links the PR, and adds a completion comment. Use this instead of separate Linear calls when finishing a task.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        prUrl: z.string().url().describe('The GitHub PR URL'),
        prTitle: z.string().describe('Title of the PR'),
        summary: z.string().describe('Brief summary of changes made (2-3 sentences)')
      },
      async (args) => {
        try {
          const issue = await linearClient.issue(args.issueId);
          if (!issue) {
            return {
              content: [{
                type: 'text',
                text: `Issue ${args.issueId} not found. Check the issue ID format (e.g., "GRO-5" or the full UUID).`
              }],
              isError: true
            };
          }

          // Get workflow state for "In Review"
          const team = await issue.team;
          const states = await team?.states();
          const reviewState = states?.nodes.find(
            s => s.name.toLowerCase() === 'in review'
          );

          if (!reviewState) {
            return {
              content: [{
                type: 'text',
                text: `"In Review" status not found in workflow. Available states: ${states?.nodes.map(s => s.name).join(', ')}`
              }],
              isError: true
            };
          }

          // Step 1: Move to "In Review"
          await linearClient.updateIssue(issue.id, {
            stateId: reviewState.id
          });

          // Step 2: Add completion comment with PR link
          const commentBody = `## Task Completed

### Summary
${args.summary}

### Pull Request
**[${args.prTitle}](${args.prUrl})**

---
*Ready for code review.*`;

          await linearClient.createComment({
            issueId: issue.id,
            body: commentBody
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Task ${args.issueId} completed:\n- Moved to "In Review"\n- PR linked: ${args.prUrl}\n- Completion comment added`
            }]
          };
        } catch (error: any) {
          // Provide actionable error message
          let suggestion = '';
          if (error.message?.includes('not found')) {
            suggestion = '\n\n**Fix:** Verify the issue ID using `get_assigned_issues` first.';
          } else if (error.message?.includes('unauthorized')) {
            suggestion = '\n\n**Fix:** Check that LINEAR_API_KEY has write permissions.';
          }

          return {
            content: [{
              type: 'text',
              text: `Error completing task: ${error.message}${suggestion}`
            }],
            isError: true
          };
        }
      }
    ),

    // Structured escalation for detailed blocker reports
    tool(
      'structured_escalation',
      'Create a detailed blocker report with structured context. Use for complex issues requiring human decision or debugging assistance.',
      {
        issueId: z.string().describe('The Linear issue ID or identifier'),
        blockerType: z.enum(['technical', 'requirements', 'security', 'architecture', 'external'])
          .describe('Type of blocker: technical (build/runtime), requirements (unclear spec), security (needs approval), architecture (design decision), external (third-party)'),
        summary: z.string().max(100).describe('One-line summary of the blocker (max 100 chars)'),
        context: z.object({
          attempted: z.array(z.string()).min(1).max(5)
            .describe('List of approaches tried (1-5 items)'),
          errorDetails: z.string().optional()
            .describe('Specific error message or stack trace'),
          filesInvolved: z.array(z.string()).optional()
            .describe('File paths relevant to the issue'),
          hypothesis: z.string().optional()
            .describe('What you think the root cause might be'),
          suggestedNextSteps: z.array(z.string()).optional()
            .describe('Possible solutions with pros/cons')
        }).describe('Structured context for the blocker'),
        urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
          .describe('Urgency: low (not blocking), medium (blocking this task), high (blocking multiple tasks), critical (production issue)')
      },
      async (args) => {
        try {
          const issue = await linearClient.issue(args.issueId);
          if (!issue) {
            return {
              content: [{ type: 'text', text: `Issue ${args.issueId} not found` }],
              isError: true
            };
          }

          // Map urgency to priority
          const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };
          const priority = priorityMap[args.urgency];

          // Build structured markdown comment
          const urgencyEmoji = {
            critical: '!!!',
            high: '!!',
            medium: '!',
            low: '-'
          }[args.urgency];

          let commentBody = `## ${urgencyEmoji} Blocker Report: ${args.blockerType.toUpperCase()}

### Summary
${args.summary}

### What I Tried`;

          args.context.attempted.forEach((attempt, i) => {
            commentBody += `\n${i + 1}. ${attempt}`;
          });

          if (args.context.errorDetails) {
            commentBody += `\n\n### Error Details\n\`\`\`\n${args.context.errorDetails}\n\`\`\``;
          }

          if (args.context.filesInvolved && args.context.filesInvolved.length > 0) {
            commentBody += `\n\n### Files Involved`;
            args.context.filesInvolved.forEach(f => {
              commentBody += `\n- \`${f}\``;
            });
          }

          if (args.context.hypothesis) {
            commentBody += `\n\n### Root Cause Hypothesis\n${args.context.hypothesis}`;
          }

          if (args.context.suggestedNextSteps && args.context.suggestedNextSteps.length > 0) {
            commentBody += `\n\n### Suggested Next Steps`;
            args.context.suggestedNextSteps.forEach((step, i) => {
              commentBody += `\n${i + 1}. ${step}`;
            });
          }

          commentBody += `\n\n### Urgency
- **Level:** ${args.urgency.toUpperCase()}
- **Type:** ${args.blockerType}

---
*Escalated by dev-agent*`;

          // Add the structured comment
          await linearClient.createComment({
            issueId: issue.id,
            body: commentBody
          });

          // Update issue priority
          await linearClient.updateIssue(issue.id, {
            priority
          });

          // Get team to find blocked state if it exists
          const team = await issue.team;
          const states = await team?.states();
          const blockedState = states?.nodes.find(
            s => s.name.toLowerCase().includes('blocked')
          );

          // If blocked state exists, move issue there
          if (blockedState) {
            await linearClient.updateIssue(issue.id, {
              stateId: blockedState.id
            });
          }

          return {
            content: [{
              type: 'text',
              text: `Blocker report created for ${args.issueId}:\n- Type: ${args.blockerType}\n- Urgency: ${args.urgency}\n- Summary: ${args.summary}${blockedState ? '\n- Moved to Blocked state' : ''}`
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: `Error creating blocker report: ${error.message}`
            }],
            isError: true
          };
        }
      }
    ),

    // Search issues (more targeted than list)
    tool(
      'search_issues',
      'Search for issues by keyword, label, or status. More targeted than get_assigned_issues.',
      {
        query: z.string().optional()
          .describe('Search query to match in title or description'),
        labelName: z.string().optional()
          .describe('Filter by label name'),
        status: z.enum(['todo', 'in_progress', 'review', 'done', 'all']).default('all')
          .describe('Filter by status'),
        limit: z.number().min(1).max(20).default(5)
          .describe('Maximum results (default 5 for token efficiency)')
      },
      async (args) => {
        try {
          const viewer = await linearClient.viewer;

          // Build filter
          const filter: any = {
            assignee: { id: { eq: viewer.id } }
          };

          if (args.status !== 'all') {
            filter.state = { name: { eq: WORKFLOW_STATES[args.status] } };
          }

          if (args.labelName) {
            filter.labels = { name: { eq: args.labelName } };
          }

          const issues = await linearClient.issues({
            filter,
            first: args.limit
          });

          // Filter by query if provided
          let filteredIssues = issues.nodes;
          if (args.query) {
            const queryLower = args.query.toLowerCase();
            filteredIssues = filteredIssues.filter(issue =>
              issue.title.toLowerCase().includes(queryLower) ||
              issue.description?.toLowerCase().includes(queryLower)
            );
          }

          // Return concise format
          const results = filteredIssues.map(issue => ({
            id: issue.identifier,
            title: issue.title,
            url: issue.url
          }));

          return {
            content: [{
              type: 'text',
              text: results.length > 0
                ? `Found ${results.length} issue(s):\n${results.map(r => `- ${r.id}: ${r.title}`).join('\n')}`
                : 'No matching issues found.'
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error searching issues: ${error}`
            }],
            isError: true
          };
        }
      }
    )
  ]
});

export type LinearStatus = keyof typeof WORKFLOW_STATES;

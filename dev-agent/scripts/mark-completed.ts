/**
 * Mark completed Priority Zero tasks as Done in Linear
 */

import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const COMPLETED_TASKS = [
  { title: '0.1 Dev Agent Core Setup', description: 'Created dev-agent/ with Claude Agent SDK, package.json, tsconfig.json, Dockerfile, railway.toml' },
  { title: '0.2 Linear API Integration', description: 'Implemented all Linear tools: getAssignedIssues, updateIssueStatus, addComment, createSubIssue, assignToHuman, complete_task' },
  { title: '0.3 Git Tools', description: 'Implemented git tools: git_status, git_create_branch, git_checkout, git_add, git_commit, git_push, create_pull_request, complete_feature' },
  { title: '0.4 Bash Tools', description: 'Implemented bash tools: run_command, verify_build, list_directory, check_file_exists, get_environment' },
  { title: '0.5 Multi-Agent Architecture', description: 'Implemented 4 subagents (explorer, thinker, coder, ship) all using Opus 4.5' },
  { title: '0.6 Session Protocols', description: 'Added features.json, claude-progress.txt, session startup/handoff protocols per Anthropic best practices' },
  { title: '0.7 Railway Deployment', description: 'Deployed dev agent to Railway, running 24/7 with auto-restart' },
];

async function main() {
  const me = await client.viewer;
  const teams = await client.teams();
  const team = teams.nodes[0];

  console.log(`Team: ${team.name}`);

  // Get workflow states
  const states = await team.states();
  const doneState = states.nodes.find(s => s.name.toLowerCase() === 'done');
  const canceledState = states.nodes.find(s =>
    s.name.toLowerCase() === 'canceled' || s.name.toLowerCase() === 'cancelled'
  );

  console.log('Available states:', states.nodes.map(s => s.name).join(', '));

  if (!doneState) {
    console.error('Could not find Done state');
    return;
  }

  console.log('\nCreating Priority Zero tasks as Done...');

  for (const task of COMPLETED_TASKS) {
    const result = await client.createIssue({
      teamId: team.id,
      title: task.title,
      description: `**Priority Zero: Dev Agent**\n\n${task.description}`,
      stateId: doneState.id,
      assigneeId: me.id
    });

    const issue = await result.issue;
    console.log(`Created (Done): ${issue?.identifier} - ${task.title}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Cancel duplicate Phase 1 issues (we have newer versions)
  if (canceledState) {
    const duplicates = ['GRO-5', 'GRO-6', 'GRO-7', 'GRO-8'];
    console.log('\nCanceling duplicate issues...');

    for (const id of duplicates) {
      try {
        const issue = await client.issue(id);
        if (issue) {
          await client.updateIssue(issue.id, { stateId: canceledState.id });
          console.log(`Canceled: ${id}`);
        }
      } catch (e) {
        console.log(`Could not update ${id}: ${e}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);

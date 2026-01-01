/**
 * Create Linear Views for Non-Dev Oversight
 *
 * Creates custom views to help monitor the dev agent's progress
 *
 * Run with: npx tsx scripts/create-views.ts
 */

import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

async function main() {
  console.log('📊 Creating Linear Views for Oversight\n');

  // Get current user and team
  const me = await client.viewer;
  const teams = await client.teams();
  const team = teams.nodes[0];

  console.log(`Team: ${team.name} (${team.key})\n`);

  // Get workflow states for filtering
  const states = await team.states();
  const todoState = states.nodes.find(s => s.name.toLowerCase() === 'todo');
  const inProgressState = states.nodes.find(s => s.name.toLowerCase() === 'in progress');
  const inReviewState = states.nodes.find(s => s.name.toLowerCase() === 'in review');
  const doneState = states.nodes.find(s => s.name.toLowerCase() === 'done');

  // Get labels
  const labels = await client.issueLabels({
    filter: { team: { id: { eq: team.id } } }
  });
  const blockedLabel = labels.nodes.find(l => l.name.toLowerCase() === 'blocked');

  // Check existing views
  const existingViews = await client.customViews();
  const existingViewNames = new Set(existingViews.nodes.map(v => v.name.toLowerCase()));

  const views = [
    {
      name: '🔄 Active Work',
      description: 'Issues currently being worked on by the dev agent. Check daily to see progress.',
      filter: {
        and: [
          { team: { id: { eq: team.id } } },
          {
            or: [
              { state: { id: { eq: inProgressState?.id } } },
              { state: { id: { eq: inReviewState?.id } } }
            ]
          }
        ]
      }
    },
    {
      name: '📋 Up Next',
      description: 'Todo queue organized by project phase. The agent picks tasks from here in order.',
      filter: {
        and: [
          { team: { id: { eq: team.id } } },
          { state: { id: { eq: todoState?.id } } }
        ]
      }
    },
    {
      name: '✅ Completed',
      description: 'Tasks finished by the dev agent. Review PRs in GitHub to merge changes.',
      filter: {
        and: [
          { team: { id: { eq: team.id } } },
          { state: { id: { eq: doneState?.id } } }
        ]
      }
    },
    {
      name: '🚫 Blocked',
      description: 'Tasks the agent could not complete. These need your manual attention.',
      filter: {
        and: [
          { team: { id: { eq: team.id } } },
          { labels: { id: { eq: blockedLabel?.id } } }
        ]
      }
    }
  ];

  console.log('Creating views...\n');

  for (const view of views) {
    // Skip if name already exists (case insensitive check)
    const normalizedName = view.name.toLowerCase();
    if (existingViewNames.has(normalizedName) ||
        existingViewNames.has(normalizedName.replace(/^[^\w]+/, '').trim())) {
      console.log(`   Skip (exists): ${view.name}`);
      continue;
    }

    try {
      await client.createCustomView({
        name: view.name,
        description: view.description,
        filterData: view.filter as any,
        teamId: team.id,
        shared: true
      });
      console.log(`   Created: ${view.name}`);
    } catch (err: any) {
      // Check if it's a duplicate error
      if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
        console.log(`   Skip (exists): ${view.name}`);
      } else {
        console.error(`   Failed: ${view.name} - ${err.message || err}`);
      }
    }
    await sleep(300);
  }

  // Now update project descriptions
  console.log('\n📁 Updating Project Descriptions...\n');

  const projectDescriptions: Record<string, string> = {
    'priority zero: dev agent': 'Core dev agent infrastructure - autonomous coding agent that processes Linear tasks 24/7. COMPLETE.',
    'phase 1: foundation': 'Agent skills framework, tool calling infrastructure, context engineering, response schemas.',
    'phase 2: lead agents': 'SDR, Reminder, and Follow-up agent improvements using skills framework.',
    'phase 3: owner assistant': 'Text-based assistant for business owner - calendar, project status, CompanyCam, daily digest.',
    'phase 4: cmo agent': 'RAG-powered marketing intelligence - FB, Google Ads, YouTube knowledge bases.',
    'phase 5: crm platform': 'Lead database, pipeline management, external CRM sync (GoHighLevel, HubSpot, etc).',
    'phase 6: sales coach': 'Real-time sales guidance - coaching engine, alerts, response templates, analytics.',
    'phase 7: dashboard': 'Next.js web dashboard - auth, lead views, conversations, calendar, settings.',
    'phase 8: launch prep': 'Production infrastructure, security audit, documentation, beta testing.'
  };

  const projects = await client.projects({
    filter: { accessibleTeams: { id: { eq: team.id } } }
  });

  for (const project of projects.nodes) {
    const description = projectDescriptions[project.name.toLowerCase()];
    if (description && project.description !== description) {
      try {
        await client.updateProject(project.id, { description });
        console.log(`   Updated: ${project.name}`);
      } catch (err) {
        console.error(`   Failed: ${project.name}`);
      }
      await sleep(200);
    } else if (description) {
      console.log(`   Skip (already set): ${project.name}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Views and Descriptions Created!\n');
  console.log('Your Linear workspace now has:\n');
  console.log('Views (in sidebar):');
  console.log('   🔄 Active Work - What agent is doing now');
  console.log('   📋 Up Next - Todo queue by project');
  console.log('   ✅ Completed - Finished tasks');
  console.log('   🚫 Blocked - Needs your attention\n');
  console.log('Projects (with descriptions):');
  console.log('   Each phase now has a clear description\n');
  console.log('='.repeat(50));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);

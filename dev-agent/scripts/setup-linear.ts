/**
 * Setup Linear for Non-Dev Oversight
 *
 * Creates:
 * - Projects for each phase (Priority Zero through Phase 8)
 * - Labels for status tracking (blocked, needs-review, agent-completed)
 * - Assigns existing issues to correct projects based on title prefix
 *
 * Run with: npx tsx scripts/setup-linear.ts
 */

import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

// Project definitions
const PROJECTS = [
  { name: 'Priority Zero: Dev Agent', prefix: '0.', state: 'completed' as const },
  { name: 'Phase 1: Foundation', prefix: '1.', state: 'planned' as const },
  { name: 'Phase 2: Lead Agents', prefix: '2.', state: 'planned' as const },
  { name: 'Phase 3: Owner Assistant', prefix: '3.', state: 'planned' as const },
  { name: 'Phase 4: CMO Agent', prefix: '4.', state: 'planned' as const },
  { name: 'Phase 5: CRM Platform', prefix: '5.', state: 'planned' as const },
  { name: 'Phase 6: Sales Coach', prefix: '6.', state: 'planned' as const },
  { name: 'Phase 7: Dashboard', prefix: '7.', state: 'planned' as const },
  { name: 'Phase 8: Launch Prep', prefix: '8.', state: 'planned' as const },
];

// Label definitions
const LABELS = [
  { name: 'blocked', color: '#e5484d', description: 'Agent could not complete this task' },
  { name: 'needs-review', color: '#f5a623', description: 'PR ready for human review' },
  { name: 'agent-completed', color: '#0e7a0d', description: 'Agent finished successfully' },
];

async function main() {
  console.log('🔧 Setting up Linear for Non-Dev Oversight\n');

  // Get current user and team
  const me = await client.viewer;
  const teams = await client.teams();
  const team = teams.nodes[0];

  console.log(`Logged in as: ${me.name} (${me.email})`);
  console.log(`Team: ${team.name} (${team.key})\n`);

  // Step 1: Create Labels
  console.log('📌 Creating Labels...');

  const existingLabels = await client.issueLabels({
    filter: { team: { id: { eq: team.id } } }
  });
  const existingLabelNames = new Set(existingLabels.nodes.map(l => l.name.toLowerCase()));

  for (const label of LABELS) {
    if (existingLabelNames.has(label.name.toLowerCase())) {
      console.log(`   Skip (exists): ${label.name}`);
      continue;
    }

    try {
      await client.createIssueLabel({
        teamId: team.id,
        name: label.name,
        color: label.color,
        description: label.description
      });
      console.log(`   Created: ${label.name}`);
    } catch (err) {
      console.error(`   Failed to create ${label.name}:`, err);
    }
    await sleep(200);
  }

  // Step 2: Create Projects
  console.log('\n📁 Creating Projects...');

  const existingProjects = await client.projects({
    filter: { accessibleTeams: { id: { eq: team.id } } }
  });
  const existingProjectNames = new Set(existingProjects.nodes.map(p => p.name.toLowerCase()));
  const projectMap = new Map<string, string>(); // prefix -> projectId

  for (const project of PROJECTS) {
    if (existingProjectNames.has(project.name.toLowerCase())) {
      const existing = existingProjects.nodes.find(
        p => p.name.toLowerCase() === project.name.toLowerCase()
      );
      if (existing) {
        projectMap.set(project.prefix, existing.id);
        console.log(`   Skip (exists): ${project.name}`);
      }
      continue;
    }

    try {
      const result = await client.createProject({
        teamIds: [team.id],
        name: project.name,
        state: project.state,
        description: `Issues prefixed with ${project.prefix}x`
      });
      const createdProject = await result.project;
      if (createdProject) {
        projectMap.set(project.prefix, createdProject.id);
        console.log(`   Created: ${project.name}`);
      }
    } catch (err) {
      console.error(`   Failed to create ${project.name}:`, err);
    }
    await sleep(200);
  }

  // Refresh project list to get all IDs
  const allProjects = await client.projects({
    filter: { accessibleTeams: { id: { eq: team.id } } }
  });
  for (const p of allProjects.nodes) {
    const matching = PROJECTS.find(proj => proj.name.toLowerCase() === p.name.toLowerCase());
    if (matching) {
      projectMap.set(matching.prefix, p.id);
    }
  }

  // Step 3: Assign Issues to Projects
  console.log('\n🔗 Assigning Issues to Projects...');

  const allIssues = await client.issues({
    filter: { team: { id: { eq: team.id } } },
    first: 200
  });

  let assigned = 0;
  let skipped = 0;

  for (const issue of allIssues.nodes) {
    // Check if already assigned to a project
    const existingProject = await issue.project;
    if (existingProject) {
      skipped++;
      continue;
    }

    // Match prefix to determine project
    let matchedProjectId: string | null = null;

    for (const [prefix, projectId] of projectMap.entries()) {
      // Match patterns like "0.1", "1.2", "2.3", etc. at the start of title
      const pattern = new RegExp(`^${prefix.replace('.', '\\.')}\\d`);
      if (pattern.test(issue.title)) {
        matchedProjectId = projectId;
        break;
      }
    }

    if (matchedProjectId) {
      try {
        await client.updateIssue(issue.id, { projectId: matchedProjectId });
        const projectName = PROJECTS.find(p => projectMap.get(p.prefix) === matchedProjectId)?.name;
        console.log(`   ${issue.identifier}: → ${projectName}`);
        assigned++;
      } catch (err) {
        console.error(`   Failed to assign ${issue.identifier}:`, err);
      }
      await sleep(100);
    }
  }

  console.log(`\n   Assigned: ${assigned} issues`);
  console.log(`   Skipped (already in project): ${skipped} issues`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Linear Setup Complete!\n');
  console.log('Projects created:');
  for (const project of PROJECTS) {
    console.log(`   • ${project.name}`);
  }
  console.log('\nLabels created:');
  for (const label of LABELS) {
    console.log(`   • ${label.name}`);
  }

  console.log('\n📋 NEXT STEP: Create Views in Linear UI\n');
  console.log('Go to Linear and create these custom views:\n');
  console.log('1. "Active Work"');
  console.log('   Filter: State = "In Progress" OR "In Review"\n');
  console.log('2. "Up Next"');
  console.log('   Filter: State = "Todo"');
  console.log('   Group by: Project\n');
  console.log('3. "Completed This Week"');
  console.log('   Filter: State = "Done", completedAt > -7d\n');
  console.log('4. "Blocked"');
  console.log('   Filter: Label = "blocked"\n');
  console.log('='.repeat(50));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);

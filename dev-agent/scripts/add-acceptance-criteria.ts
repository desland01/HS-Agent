/**
 * Add Acceptance Criteria to Linear Issues
 *
 * Updates Linear issues with proper acceptance criteria format:
 * - User story: "As a [user], I want [action] so that [benefit]"
 * - Definition of Done checklist
 * - Security flag if applicable
 *
 * Run with: LINEAR_API_KEY="..." npx tsx scripts/add-acceptance-criteria.ts
 */

import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY! });

// Template for acceptance criteria
const ACCEPTANCE_TEMPLATE = `
---

## Acceptance Criteria

### User Story
As a [user type], I want [action/feature] so that [benefit/outcome].

### Definition of Done
- [ ] Feature works as described
- [ ] Code passes typecheck and build
- [ ] No security checklist violations (see docs/SECURITY.md)
- [ ] PR created with clear description

### Test Cases
- [ ] Happy path works
- [ ] Edge cases handled
- [ ] Error states handled gracefully

---
`;

// Security-sensitive keywords that flag an issue for extra review
const SECURITY_KEYWORDS = [
  'auth', 'login', 'password', 'token', 'api key', 'secret',
  'sms', 'text', 'message', 'tcpa', 'consent',
  'database', 'sql', 'query', 'user input', 'form',
  'webhook', 'api', 'endpoint', 'rate limit',
  'pii', 'personal', 'email', 'phone', 'name'
];

async function main() {
  console.log('📝 Adding Acceptance Criteria to Linear Issues\n');

  // Get team
  const teams = await client.teams();
  const team = teams.nodes[0];
  console.log(`Team: ${team.name} (${team.key})\n`);

  // Get all issues
  const issues = await client.issues({
    filter: { team: { id: { eq: team.id } } },
    first: 200
  });

  let updated = 0;
  let skipped = 0;
  let securityFlagged = 0;

  console.log('Processing issues...\n');

  for (const issue of issues.nodes) {
    // Skip if already has acceptance criteria
    if (issue.description?.includes('## Acceptance Criteria') ||
        issue.description?.includes('Definition of Done')) {
      skipped++;
      continue;
    }

    // Check for security-sensitive content
    const titleLower = issue.title.toLowerCase();
    const descLower = (issue.description || '').toLowerCase();
    const isSecuritySensitive = SECURITY_KEYWORDS.some(
      keyword => titleLower.includes(keyword) || descLower.includes(keyword)
    );

    // Build updated description
    let newDescription = (issue.description || '').trim();

    // Add acceptance criteria template
    newDescription += '\n' + ACCEPTANCE_TEMPLATE;

    // Add security flag if needed
    if (isSecuritySensitive) {
      newDescription += `\n### Security Review Required\n- [ ] Review against docs/SECURITY.md checklist\n- [ ] No PII in logs\n- [ ] Input validation present\n`;
      securityFlagged++;
    }

    try {
      await client.updateIssue(issue.id, {
        description: newDescription
      });
      console.log(`   ✓ ${issue.identifier}: ${issue.title.substring(0, 50)}...`);
      if (isSecuritySensitive) {
        console.log(`     ⚠️  Security review flagged`);
      }
      updated++;
    } catch (err: any) {
      console.error(`   ✗ ${issue.identifier}: ${err.message || err}`);
    }

    // Rate limit
    await sleep(200);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Acceptance Criteria Update Complete!\n');
  console.log(`   Updated: ${updated} issues`);
  console.log(`   Skipped (already had criteria): ${skipped} issues`);
  console.log(`   Security-flagged: ${securityFlagged} issues`);
  console.log('\n' + '='.repeat(50));
  console.log('\nNext steps:');
  console.log('1. Review issues in Linear');
  console.log('2. Fill in specific user stories and test cases');
  console.log('3. Pay extra attention to security-flagged issues');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);

import { BaseAgent, type AgentResponse } from './base.js';
import type { ConversationState, LeadStatus } from '../lib/conversation.js';

/**
 * Follow-up Agent - Post-Estimate Nurturing & Closing
 *
 * Primary responsibilities:
 * 1. Follow up after estimates are sent
 * 2. Handle objections (price, timing, comparing quotes)
 * 3. Re-engage leads who went quiet
 * 4. Close deals without being pushy
 */
export class FollowupAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `You are ${this.config.ownerName}'s follow-up specialist for ${this.config.businessName}.

## Your Role
You follow up with leads after they've received an estimate:
1. Check if they have questions about the proposal
2. Address concerns or objections thoughtfully
3. Help them make a decision
4. Re-engage leads who went quiet

## Conversation Style
- Patient and understanding (buying decisions take time)
- Never pushy or guilt-trippy
- Focus on their needs, not our need to close
- Acknowledge competitors without badmouthing them

## Common Objections & How to Handle

### "The price is higher than expected"
- Acknowledge it's an investment
- Break down what's included (don't just discount)
- Mention our guarantees: ${this.config.guarantees?.join(', ') || 'quality craftsmanship'}
- Offer to review scope if budget is truly limited

### "I'm getting other quotes"
- Totally fine! Encourage them to compare
- Mention what sets us apart: ${this.config.differentiators.slice(0, 2).join(', ')}
- Offer to answer any questions that come up from other quotes

### "I need to think about it / talk to spouse"
- Completely understand - it's a big decision
- Offer to send additional info if helpful
- Ask if they have a timeline in mind
- Set a gentle follow-up: "Mind if I check back in a few days?"

### "We're not ready yet"
- Ask when they're thinking
- Offer to hold the quote (if applicable)
- Let them know they can reach out anytime

### "We went with someone else"
- Thank them sincerely
- Ask if there's feedback that could help us improve
- Leave door open for future projects

## Response Format
Be conversational and empathetic. Add metadata:

---AGENT_METADATA---
status: [follow_up|won|lost]
objection_type: [price|timing|comparing|spouse|not_ready|chose_competitor|none]
next_action: [send_info|schedule_call|update_crm|close_won|close_lost|none]
follow_up_in_days: [number or none]
hand_off_to: [sdr|reminder|none]
---END_METADATA---

## Important Rules
- NEVER discount without consulting ${this.config.ownerName} first - instead offer to discuss options
- If they chose a competitor, be gracious (they might come back for future projects)
- If they're comparing quotes, don't badmouth competitors
- Always leave the door open - "Feel free to reach out anytime"
- Know when to step back (3 follow-ups with no response = mark as dormant, not lost)`;
  }

  protected parseResponse(response: string, state: ConversationState): AgentResponse {
    const metadataMatch = response.match(/---AGENT_METADATA---([\s\S]*?)---END_METADATA---/);
    const customerMessage = response.replace(/---AGENT_METADATA---[\s\S]*?---END_METADATA---/, '').trim();

    const result: AgentResponse = {
      message: customerMessage,
      actions: [],
    };

    if (metadataMatch) {
      const metadata = metadataMatch[1];

      // Parse status
      const statusMatch = metadata.match(/status:\s*(\w+)/);
      if (statusMatch) {
        const status = statusMatch[1] as LeadStatus;
        if (['follow_up', 'won', 'lost'].includes(status)) {
          result.leadUpdates = { status };

          if (status === 'won') {
            result.actions.push({
              type: 'update_crm',
              payload: { status: 'won', event: 'deal_closed' },
            });
          } else if (status === 'lost') {
            result.actions.push({
              type: 'update_crm',
              payload: { status: 'lost', event: 'deal_lost' },
            });
          }
        }
      }

      // Parse objection for analytics
      const objectionMatch = metadata.match(/objection_type:\s*(\w+)/);
      if (objectionMatch && objectionMatch[1] !== 'none') {
        result.actions.push({
          type: 'update_crm',
          payload: {
            event: 'objection_logged',
            objection_type: objectionMatch[1],
          },
        });
      }

      // Parse next action
      const actionMatch = metadata.match(/next_action:\s*(\w+)/);
      if (actionMatch) {
        const action = actionMatch[1];
        if (action === 'schedule_call') {
          result.actions.push({
            type: 'escalate_to_human',
            payload: { reason: 'customer_requested_call' },
          });
        } else if (action === 'send_info') {
          result.actions.push({
            type: 'send_email',
            payload: { template: 'additional_info' },
          });
        }
      }

      // Parse follow-up timing
      const followUpMatch = metadata.match(/follow_up_in_days:\s*(\d+)/);
      if (followUpMatch) {
        result.actions.push({
          type: 'update_crm',
          payload: {
            scheduled_follow_up: new Date(
              Date.now() + parseInt(followUpMatch[1]) * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        });
      }

      // Parse hand-off
      const handoffMatch = metadata.match(/hand_off_to:\s*(\w+)/);
      if (handoffMatch && handoffMatch[1] !== 'none') {
        result.suggestedNextAgent = handoffMatch[1] as 'sdr' | 'reminder' | 'followup';
      }
    }

    return result;
  }

  /**
   * Generate a follow-up message for leads who haven't responded
   */
  async generateFollowUp(
    state: ConversationState,
    daysSinceLastContact: number
  ): Promise<AgentResponse> {
    let trigger: string;

    if (daysSinceLastContact <= 2) {
      trigger = 'It\'s been a couple days since we sent the estimate. Send a brief, friendly check-in.';
    } else if (daysSinceLastContact <= 5) {
      trigger = 'It\'s been almost a week. Send a value-add follow-up (maybe share a relevant tip or mention a current opening).';
    } else if (daysSinceLastContact <= 10) {
      trigger = 'It\'s been over a week. Send a gentle "just checking in" message. Don\'t be pushy.';
    } else {
      trigger = 'It\'s been a while. Send a final low-pressure message letting them know the door is open.';
    }

    return this.generateProactiveMessage(state, trigger);
  }
}

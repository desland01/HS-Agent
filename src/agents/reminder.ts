import { BaseAgent, type AgentResponse } from './base.js';
import type { ConversationState, LeadStatus } from '../lib/conversation.js';

/**
 * Reminder Agent - Appointment Confirmations & Rescheduling
 *
 * Primary responsibilities:
 * 1. Send appointment reminders (24h, 2h before)
 * 2. Handle rescheduling requests
 * 3. Confirm appointment details
 * 4. Provide pre-appointment information
 */
export class ReminderAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `You are ${this.config.ownerName}'s appointment coordinator for ${this.config.businessName}.

## Your Role
You handle appointment logistics:
1. Send friendly reminders before appointments
2. Help reschedule if needed
3. Confirm details and answer logistics questions
4. Make sure the customer is prepared for the estimate

## Conversation Style
- Brief and to-the-point (people are busy)
- Friendly but efficient
- Focus on logistics, not selling
- Make rescheduling easy, not guilt-trippy

## Pre-Appointment Info to Share (when relevant)
- Estimate takes about ${this.config.booking.estimateDuration}
- ${this.config.ownerName} or a team member will meet them
- It helps if they've thought about colors/styles they like
- No need to prepare anything special - just be home

## When to Hand Off
- If they want to cancel entirely → hand to Follow-up Agent
- If they have questions about our services/pricing → hand back to SDR
- If everything is confirmed → stay with them until after the appointment

## Response Format
Keep messages SHORT. Then add metadata:

---AGENT_METADATA---
status: [appointment_scheduled|cancelled|rescheduled]
appointment_confirmed: [yes|no|pending]
next_action: [send_reminder|reschedule|update_crm|none]
hand_off_to: [sdr|followup|none]
---END_METADATA---

## Important Rules
- If they need to reschedule, be flexible and understanding
- Don't make them feel bad about rescheduling
- If cancelling, ask if there's a better time (but respect a firm no)
- Always confirm the appointment date/time in your messages`;
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
        const status = statusMatch[1];
        if (status === 'cancelled') {
          result.leadUpdates = { status: 'follow_up' as LeadStatus };
          result.suggestedNextAgent = 'followup';
        } else if (status === 'rescheduled') {
          result.actions.push({
            type: 'update_crm',
            payload: { event: 'appointment_rescheduled' },
          });
        }
      }

      // Parse confirmation
      const confirmedMatch = metadata.match(/appointment_confirmed:\s*(\w+)/);
      if (confirmedMatch && confirmedMatch[1] === 'yes') {
        result.actions.push({
          type: 'update_crm',
          payload: { appointment_confirmed: true },
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
   * Generate reminder messages for specific triggers
   */
  async generateReminder(
    state: ConversationState,
    reminderType: '24h' | '2h' | 'day_of'
  ): Promise<AgentResponse> {
    const triggers: Record<string, string> = {
      '24h': 'Send a friendly reminder that their estimate appointment is tomorrow.',
      '2h': 'Send a quick heads-up that you\'ll be there in about 2 hours.',
      'day_of': 'Good morning message confirming today\'s appointment time.',
    };

    return this.generateProactiveMessage(state, triggers[reminderType]);
  }
}

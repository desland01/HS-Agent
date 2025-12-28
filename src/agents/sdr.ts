import { BaseAgent, type AgentResponse, type AgentAction } from './base.js';
import type { ConversationState, LeadInfo, LeadStatus } from '../lib/conversation.js';

/**
 * SDR Agent - Lead Qualification & Appointment Booking
 *
 * Primary responsibilities:
 * 1. Respond quickly to new leads
 * 2. Qualify leads (service needed, timeline, location)
 * 3. Capture contact information
 * 4. Book estimate appointments
 * 5. Hand off to Reminder agent once booked
 */
export class SDRAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return `You are ${this.config.ownerName}'s AI assistant for ${this.config.businessName}, a ${this.config.businessType} company in ${this.config.serviceArea.primary}.

## Your Role
You're the first point of contact for potential customers. Your job is to:
1. Respond warmly and quickly
2. Understand what they need
3. Qualify if we can help them (right service, right area)
4. Capture their contact info
5. Book an estimate appointment

## Conversation Style
- Be friendly and conversational, like texting with a helpful person
- Keep messages SHORT (2-3 sentences max)
- Don't be salesy or pushy
- Ask one question at a time
- Use their name once you know it

## Qualification Questions (ask naturally, not as a checklist)
- What project are they thinking about?
- Where is the property located? (verify we service their area)
- What's their timeline?
- Have they gotten other quotes? (just to understand where they are in the process)

## Booking an Estimate
Once qualified, offer to schedule an in-home estimate. Mention:
- It's free and takes about ${this.config.booking.estimateDuration}
- ${this.config.ownerName} or a team member will come see the space
- They'll get a detailed quote on the spot or within 24 hours

## When to Hand Off
- Once appointment is booked → Reminder Agent takes over
- If they're not ready yet → stay with them, don't push
- If they have complex questions about pricing/process → you can answer generally but offer to have ${this.config.ownerName} call them

## Response Format
Respond naturally as if you're texting them. At the end of your message, add this metadata block (the customer won't see this):

---AGENT_METADATA---
status: [new|contacted|qualified|appointment_scheduled]
collected_info:
  name: [if learned]
  phone: [if learned]
  email: [if learned]
  city: [if learned]
  service: [if learned]
  timeline: [if learned]
next_action: [update_crm|schedule_appointment|none]
hand_off_to: [reminder|followup|none]
---END_METADATA---

## Important Rules
- NEVER make up information about pricing - say "I'd need to have someone come out to give you an accurate quote"
- NEVER guarantee specific availability - say "Let me check on that" and offer to call them
- If they're outside our service area (${this.config.serviceArea.cities.join(', ')}), politely let them know
- Always be honest if you don't know something`;
  }

  protected parseResponse(response: string, state: ConversationState): AgentResponse {
    // Split response from metadata
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
        if (['new', 'contacted', 'qualified', 'appointment_scheduled'].includes(status)) {
          result.leadUpdates = { ...result.leadUpdates, status };

          if (status !== state.lead.status) {
            result.actions.push({
              type: 'update_crm',
              payload: { status },
            });
          }
        }
      }

      // Parse collected info
      const infoPatterns = [
        { key: 'name', pattern: /name:\s*(.+?)(?:\n|$)/ },
        { key: 'phone', pattern: /phone:\s*(.+?)(?:\n|$)/ },
        { key: 'email', pattern: /email:\s*(.+?)(?:\n|$)/ },
        { key: 'city', pattern: /city:\s*(.+?)(?:\n|$)/ },
        { key: 'serviceInterest', pattern: /service:\s*(.+?)(?:\n|$)/ },
        { key: 'timeline', pattern: /timeline:\s*(.+?)(?:\n|$)/ },
      ];

      for (const { key, pattern } of infoPatterns) {
        const match = metadata.match(pattern);
        if (match && match[1].trim() && !match[1].includes('[if learned]')) {
          result.leadUpdates = result.leadUpdates || {};
          (result.leadUpdates as Record<string, string>)[key] = match[1].trim();
        }
      }

      // Parse next action
      const actionMatch = metadata.match(/next_action:\s*(\w+)/);
      if (actionMatch && actionMatch[1] !== 'none') {
        if (actionMatch[1] === 'schedule_appointment') {
          result.actions.push({
            type: 'schedule_appointment',
            payload: { leadId: state.leadId },
          });
        }
      }

      // Parse hand-off
      const handoffMatch = metadata.match(/hand_off_to:\s*(\w+)/);
      if (handoffMatch && handoffMatch[1] !== 'none') {
        result.suggestedNextAgent = handoffMatch[1] as 'sdr' | 'reminder' | 'followup';
      }
    }

    return result;
  }
}

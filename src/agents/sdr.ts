import { BaseAgent, type AgentResponse, type AgentAction } from './base.js';
import type { ConversationState, LeadInfo, LeadStatus, LeadTemperature } from '../lib/conversation.js';
import {
  FIRST_MESSAGE_TEMPLATES,
  PHONE_TRANSITION_TEMPLATE,
  BUDGET_PREFRAME_TEMPLATE,
  AUTHORITY_CHECK_TEMPLATE,
  populateTemplate,
  type LeadSource,
} from '../core/templates/messages.js';
import { AI_TELLS_PROMPT_SECTION } from '../core/templates/ai-rules.js';
import { scoreByTimeline, parseTimelineToMonths } from '../core/scoring/lead-scoring.js';

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
    const salesProcess = this.config.salesProcess;
    const phoneCallDuration = salesProcess?.phoneCallDuration ?? 10;
    const consultationType = salesProcess?.consultationType ?? 'in-home';

    return `You are ${this.config.ownerName}'s AI assistant for ${this.config.businessName}, a ${this.config.businessType} company in ${this.config.serviceArea.primary}.

## Your Role
You're the first point of contact for potential customers. Your job is to:
1. Respond warmly and quickly (under 60 seconds)
2. Understand what they need (discovery)
3. Qualify using BANT: Needs → Authority → Timeline → Budget
4. Get their phone number
5. Transition to a ${phoneCallDuration}-minute phone call
6. Then book a free ${consultationType} design consultation

## Sales Workflow
Chat → Phone Call → ${consultationType} Consultation → Proposal

## Conversation Style
- Be friendly and conversational, like texting with a helpful person
- Keep messages SHORT (2-3 sentences max)
- Don't be salesy or pushy
- Ask one question at a time
- Use their name once you know it
- Match the customer's energy level

${AI_TELLS_PROMPT_SECTION}

## Qualification Flow (BANT - ask naturally, not as a checklist)

1. **Needs** (Discovery):
   - What project are they thinking about?
   - What's the main frustration with current space?
   - What would their ideal space look like?

2. **Authority** (Decision-maker check):
   - "Will you be making this call together with your spouse/partner?"

3. **Timeline** (Scoring):
   - "When would you ideally want this completed?"
   - HOT: 0-3 months (fast-track to consultation)
   - WARM: 3-6 months (nurture, follow up)
   - COOL: 6+ months (add to drip, check quarterly)

4. **Budget** (Pre-frame, don't ask directly):
   - Educate on typical ranges, confirm alignment

## Phone Transition
When qualified (right timeline + authority), ask for phone:
"It sounds like we'd be a great fit. The next step is a quick ${phoneCallDuration}-minute phone call to learn more about your vision and schedule your free consultation. What's the best number to reach you?"

If they hesitate:
"I totally understand. Would you prefer we email you some photos of similar projects first?"

## Booking Consultation
On the phone call, book the ${consultationType} consultation:
- It's free and takes about ${this.config.booking.estimateDuration}
- ${this.config.ownerName} or a team member will come see the space
- They'll get a detailed proposal, no obligation
- If both decision-makers are required, mention this

## When to Hand Off
- Once appointment is booked → Reminder Agent takes over
- If they're not ready yet → stay with them, don't push
- If they have complex pricing questions → offer to have ${this.config.ownerName} call them

## Response Format
Respond naturally as if you're texting them. At the end of your message, add this metadata block (the customer won't see this):

---AGENT_METADATA---
status: [new|contacted|qualified|appointment_scheduled]
temperature: [hot|warm|cool]
collected_info:
  name: [if learned]
  phone: [if learned]
  email: [if learned]
  city: [if learned]
  service: [if learned]
  timeline: [if learned]
  decision_maker: [yes|no|unknown]
next_action: [update_crm|schedule_appointment|schedule_phone_call|none]
hand_off_to: [reminder|followup|none]
---END_METADATA---

## Important Rules
- NEVER make up information about pricing, just educate on typical ranges
- NEVER guarantee specific availability
- If they're outside our service area (${this.config.serviceArea.cities.join(', ')}), politely let them know
- Always be honest if you don't know something`;
  }

  /**
   * Get the first message based on lead source
   */
  getSourceAwareFirstMessage(
    source: LeadSource,
    leadData: Record<string, string | undefined> = {}
  ): string {
    const template = FIRST_MESSAGE_TEMPLATES[source] || FIRST_MESSAGE_TEMPLATES.unknown;
    return populateTemplate(template, this.config, leadData);
  }

  /**
   * Get the phone transition message
   */
  getPhoneTransitionMessage(leadData: Record<string, string | undefined> = {}): string {
    return populateTemplate(PHONE_TRANSITION_TEMPLATE, this.config, leadData);
  }

  /**
   * Get the budget pre-frame message for a service
   */
  getBudgetPreframeMessage(serviceName: string): string {
    const service = this.config.services.find(
      s => s.name.toLowerCase().includes(serviceName.toLowerCase())
    );
    const priceRange = service?.typicalPriceRange ?? 'varies based on scope';

    return populateTemplate(BUDGET_PREFRAME_TEMPLATE, this.config, {
      service_type: serviceName,
      price_range: priceRange,
    });
  }

  /**
   * Score a lead based on their timeline
   */
  scoreLead(timelineText: string): LeadTemperature {
    const months = parseTimelineToMonths(timelineText);
    return scoreByTimeline(months, this.config);
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

      // Parse temperature
      const temperatureMatch = metadata.match(/temperature:\s*(\w+)/);
      if (temperatureMatch) {
        const temperature = temperatureMatch[1] as LeadTemperature;
        if (['hot', 'warm', 'cool'].includes(temperature)) {
          result.leadUpdates = { ...result.leadUpdates, temperature };
        }
      }

      // Parse decision_maker
      const decisionMakerMatch = metadata.match(/decision_maker:\s*(\w+)/);
      if (decisionMakerMatch) {
        const dm = decisionMakerMatch[1].toLowerCase();
        if (['yes', 'no', 'unknown'].includes(dm)) {
          result.leadUpdates = {
            ...result.leadUpdates,
            decisionMaker: dm as 'yes' | 'no' | 'unknown',
          };
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

import type { BusinessConfig } from '../config/business.schema.js';
import type { Platform, LeadInfo, AgentType } from './conversation.js';
import {
  createConversation,
  getConversationByLead,
  addMessage,
  updateLead,
  switchAgent,
} from './conversation.js';
import { createAgent, selectAgent, type AgentResponse } from '../agents/index.js';
import { createCrmAdapter, type BaseCrmAdapter } from '../adapters/crm/index.js';
import { sendText, type MessagePurpose } from '../adapters/channels/index.js';

/**
 * Agent Orchestrator
 *
 * Central coordinator that:
 * 1. Routes messages to the right agent
 * 2. Manages conversation state
 * 3. Updates CRM
 * 4. Handles agent hand-offs
 */
export class AgentOrchestrator {
  private config: BusinessConfig;
  private crm: BaseCrmAdapter;

  constructor(config: BusinessConfig) {
    this.config = config;
    this.crm = createCrmAdapter(config.crm);
  }

  /**
   * Handle a new lead (form submission, FB lead ad, etc.)
   */
  async handleNewLead(
    platform: Platform,
    leadInfo: Partial<LeadInfo>
  ): Promise<AgentResponse> {
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create conversation
    const state = await createConversation(leadId, platform, leadInfo);

    // Create contact in CRM
    await this.crm.upsertContact(state.lead);

    // Generate initial response
    const agent = createAgent('sdr', this.config);
    const response = await agent.generateProactiveMessage(
      state,
      'New lead just submitted a form. Send a warm, quick greeting and ask about their project.'
    );

    // Store the response
    if (response.message) {
      await addMessage(state.id, 'assistant', response.message);
    }

    // Process any actions
    await this.processActions(state.id, response);

    // Include leadId in response for web chat
    return {
      ...response,
      leadUpdates: { ...response.leadUpdates, id: leadId },
    };
  }

  /**
   * Handle an incoming message from a lead
   */
  async handleMessage(
    leadId: string,
    message: string,
    platform: Platform
  ): Promise<AgentResponse> {
    // Get or create conversation
    let state = await getConversationByLead(leadId);

    if (!state) {
      // New conversation from unknown lead
      state = await createConversation(leadId, platform);
    }

    // Add user message
    await addMessage(state.id, 'user', message);

    // Determine which agent should handle this
    const agentType = selectAgent(state.lead.status);

    // Switch agent if needed
    if (agentType !== state.currentAgent) {
      await switchAgent(state.id, agentType);
      state = (await getConversationByLead(leadId))!;
    }

    // Get response from agent
    const agent = createAgent(state.currentAgent, this.config);
    const response = await agent.processMessage(message, state);

    // Store assistant response
    if (response.message) {
      await addMessage(state.id, 'assistant', response.message);
    }

    // Process actions
    await this.processActions(state.id, response);

    // Handle agent hand-off
    if (response.suggestedNextAgent && response.suggestedNextAgent !== state.currentAgent) {
      await switchAgent(state.id, response.suggestedNextAgent);
    }

    return response;
  }

  /**
   * Handle a platform event (appointment confirmed, reminder due, etc.)
   */
  async handleEvent(
    leadId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<AgentResponse | null> {
    const state = await getConversationByLead(leadId);
    if (!state) {
      console.warn(`No conversation found for lead ${leadId}`);
      return null;
    }

    // Determine which agent handles this event
    let agentType: AgentType;
    let trigger: string;

    switch (eventType) {
      case 'appointment_reminder_24h':
        agentType = 'reminder';
        trigger = "Send 24-hour appointment reminder.";
        break;
      case 'appointment_reminder_2h':
        agentType = 'reminder';
        trigger = "Send 2-hour heads-up that you'll be arriving soon.";
        break;
      case 'estimate_sent':
        agentType = 'followup';
        trigger = "Estimate was just sent. Send a quick note to let them know.";
        break;
      case 'follow_up_due':
        agentType = 'followup';
        const days = eventData.daysSinceLastContact as number || 3;
        trigger = `It's been ${days} days. Send an appropriate follow-up.`;
        break;
      default:
        console.warn(`Unknown event type: ${eventType}`);
        return null;
    }

    // Switch to appropriate agent
    if (agentType !== state.currentAgent) {
      await switchAgent(state.id, agentType);
    }

    // Generate proactive message
    const agent = createAgent(agentType, this.config);
    const response = await agent.generateProactiveMessage(state, trigger);

    // Store response
    if (response.message) {
      await addMessage(state.id, 'assistant', response.message);
    }

    // Process actions
    await this.processActions(state.id, response);

    return response;
  }

  /**
   * Process agent actions (CRM updates, etc.)
   */
  private async processActions(
    conversationId: string,
    response: AgentResponse
  ): Promise<void> {
    const state = await getConversationByLead(conversationId);

    // Update lead info if provided
    if (response.leadUpdates) {
      await updateLead(conversationId, response.leadUpdates);

      // Sync to CRM
      const updatedState = await getConversationByLead(conversationId);
      if (updatedState) {
        await this.crm.upsertContact(updatedState.lead);
      }
    }

    // Process explicit actions
    for (const action of response.actions) {
      try {
        switch (action.type) {
          case 'update_crm':
            if (state?.lead) {
              const status = (action.payload.status as string) || state.lead.status;
              await this.crm.updateStatus(state.lead.id, status);
            }
            break;

          case 'schedule_appointment':
            // TODO: Implement calendar integration
            console.log('Schedule appointment:', action.payload);
            break;

          case 'send_email':
            // TODO: Implement email sending
            console.log('Send email:', action.payload);
            break;

          case 'send_sms':
            if (state?.lead?.phone && state?.lead?.textingConsent) {
              const result = await sendText(this.config, {
                to: state.lead.phone,
                body: action.payload.body as string,
                purpose: (action.payload.purpose as MessagePurpose) || 'transactional',
                leadId: state.lead.id,
                conversationId: state.id,
              });

              if (result) {
                // Log result to CRM
                const statusMsg = result.status === 'sent'
                  ? `SMS sent: ${(action.payload.body as string).slice(0, 50)}...`
                  : `SMS ${result.status}: ${result.error || result.scheduledFor?.toISOString() || 'unknown'}`;
                await this.crm.addNote(state.lead.id, statusMsg);
              }
            } else if (state?.lead && !state.lead.textingConsent) {
              console.log(`[Orchestrator] Cannot send SMS - no consent for lead ${state.lead.id}`);
            } else if (state?.lead && !state.lead.phone) {
              console.log(`[Orchestrator] Cannot send SMS - no phone for lead ${state.lead.id}`);
            }
            break;

          case 'escalate_to_human':
            console.log('Escalate to human:', action.payload);
            if (state?.lead) {
              await this.crm.addNote(
                state.lead.id,
                `AI escalated to human: ${JSON.stringify(action.payload)}`
              );
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to process action ${action.type}:`, error);
      }
    }
  }

  /**
   * Get the CRM adapter for direct access
   */
  getCrm(): BaseCrmAdapter {
    return this.crm;
  }
}

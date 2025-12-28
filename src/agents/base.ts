import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import type { BusinessConfig } from '../config/business.schema.js';
import type { ConversationState, LeadInfo } from '../lib/conversation.js';
import { buildConversationContext } from '../lib/conversation.js';

/**
 * Base Agent Class
 *
 * All specialized agents (SDR, Reminder, Follow-up) extend this.
 * Handles common functionality: Claude API calls, context building, response parsing.
 */

export interface AgentResponse {
  message: string;
  actions: AgentAction[];
  suggestedNextAgent?: 'sdr' | 'reminder' | 'followup';
  leadUpdates?: Partial<LeadInfo>;
}

export interface AgentAction {
  type: 'update_crm' | 'schedule_appointment' | 'send_email' | 'send_sms' | 'escalate_to_human';
  payload: Record<string, unknown>;
}

export abstract class BaseAgent {
  protected client: Anthropic;
  protected config: BusinessConfig;
  protected model: string = 'claude-sonnet-4-20250514';

  constructor(config: BusinessConfig) {
    this.client = new Anthropic();
    this.config = config;
  }

  /**
   * Each agent implements its own system prompt
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Each agent can define its own response parsing logic
   */
  protected abstract parseResponse(response: string, state: ConversationState): AgentResponse;

  /**
   * Build the full context for the agent
   */
  protected buildContext(state: ConversationState): string {
    const businessContext = this.buildBusinessContext();
    const conversationContext = buildConversationContext(state);

    return `${businessContext}\n\n${conversationContext}`;
  }

  /**
   * Build business-specific context
   */
  protected buildBusinessContext(): string {
    const { config } = this;

    let context = `## Business Information\n`;
    context += `- **Company**: ${config.businessName}\n`;
    context += `- **Owner**: ${config.ownerName}\n`;
    context += `- **Phone**: ${config.phone}\n`;
    context += `- **Website**: ${config.website}\n`;
    context += `- **Service Area**: ${config.serviceArea.primary} (${config.serviceArea.cities.join(', ')})\n`;

    context += `\n## Services Offered\n`;
    for (const service of config.services) {
      context += `- **${service.name}**: ${service.description}`;
      if (service.typicalPriceRange) {
        context += ` (Typical: ${service.typicalPriceRange})`;
      }
      context += `\n`;
    }

    context += `\n## What Makes Us Different\n`;
    for (const diff of config.differentiators) {
      context += `- ${diff}\n`;
    }

    if (config.guarantees && config.guarantees.length > 0) {
      context += `\n## Our Guarantees\n`;
      for (const guarantee of config.guarantees) {
        context += `- ${guarantee}\n`;
      }
    }

    context += `\n## Booking Information\n`;
    context += `- Estimates take about ${config.booking.estimateDuration}\n`;
    context += `- We need at least ${config.booking.minLeadTime} notice to schedule\n`;
    if (config.booking.requiresDeposit) {
      context += `- Deposit: ${config.booking.depositAmount}\n`;
    }

    context += `\n## Brand Voice\n`;
    context += `- Tone: ${config.personality.tone}\n`;
    if (config.personality.keyPhrases) {
      context += `- Naturally use phrases like: ${config.personality.keyPhrases.join(', ')}\n`;
    }
    if (config.personality.avoidPhrases) {
      context += `- NEVER use: ${config.personality.avoidPhrases.join(', ')}\n`;
    }

    return context;
  }

  /**
   * Process a message from the customer
   */
  async processMessage(
    userMessage: string,
    state: ConversationState
  ): Promise<AgentResponse> {
    const systemPrompt = this.getSystemPrompt();
    const context = this.buildContext(state);

    // Build messages array with context
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: `${context}\n\n---\n\nCustomer's new message: "${userMessage}"\n\nRespond naturally as if you're texting/chatting with them. Keep it conversational and helpful.`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      // Extract text response
      const textContent = response.content.find((c) => c.type === 'text');
      const responseText = textContent?.text || '';

      return this.parseResponse(responseText, state);
    } catch (error) {
      console.error('Agent error:', error);
      return {
        message: `I apologize, but I'm having trouble right now. Please call us directly at ${this.config.phone} and we'll help you right away!`,
        actions: [
          {
            type: 'escalate_to_human',
            payload: { reason: 'agent_error', error: String(error) },
          },
        ],
      };
    }
  }

  /**
   * Generate a proactive message (for follow-ups, reminders)
   */
  async generateProactiveMessage(
    state: ConversationState,
    trigger: string
  ): Promise<AgentResponse> {
    const systemPrompt = this.getSystemPrompt();
    const context = this.buildContext(state);

    const messages: MessageParam[] = [
      {
        role: 'user',
        content: `${context}\n\n---\n\nTrigger: ${trigger}\n\nGenerate a friendly, natural follow-up message to send to this customer. Keep it brief and conversational.`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system: systemPrompt,
        messages,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const responseText = textContent?.text || '';

      return this.parseResponse(responseText, state);
    } catch (error) {
      console.error('Proactive message error:', error);
      return {
        message: '',
        actions: [],
      };
    }
  }
}

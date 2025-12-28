import type { BusinessConfig } from '../config/business.schema.js';
import type { AgentType } from '../lib/conversation.js';
import { SDRAgent } from './sdr.js';
import { ReminderAgent } from './reminder.js';
import { FollowupAgent } from './followup.js';
import { BaseAgent } from './base.js';

export { BaseAgent, SDRAgent, ReminderAgent, FollowupAgent };
export type { AgentResponse, AgentAction } from './base.js';

/**
 * Agent Factory
 *
 * Creates the right agent based on conversation state.
 */
export function createAgent(type: AgentType, config: BusinessConfig): BaseAgent {
  switch (type) {
    case 'sdr':
      return new SDRAgent(config);
    case 'reminder':
      return new ReminderAgent(config);
    case 'followup':
      return new FollowupAgent(config);
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

/**
 * Determine which agent should handle a conversation
 * based on lead status
 */
export function selectAgent(status: string): AgentType {
  switch (status) {
    case 'new':
    case 'contacted':
    case 'qualified':
      return 'sdr';
    case 'appointment_scheduled':
      return 'reminder';
    case 'estimate_sent':
    case 'follow_up':
      return 'followup';
    default:
      return 'sdr';
  }
}

import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';

/**
 * Conversation State Management
 *
 * Tracks conversation history, lead info, and routing context.
 * In production, replace in-memory storage with Redis or PostgreSQL.
 */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'won'
  | 'lost';

export type AgentType = 'sdr' | 'reminder' | 'followup';
export type Platform = 'web' | 'facebook' | 'sms' | 'email';

export interface LeadInfo {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  serviceInterest?: string;
  projectDetails?: string;
  timeline?: string;
  budget?: string;
  status: LeadStatus;
  source: Platform;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationState {
  id: string;
  leadId: string;
  lead: LeadInfo;
  messages: MessageParam[];
  currentAgent: AgentType;
  platform: Platform;
  createdAt: Date;
  lastMessageAt: Date;
  metadata: Record<string, unknown>;
}

// In-memory storage (replace with Redis/Postgres in production)
const conversations = new Map<string, ConversationState>();
const leadToConversation = new Map<string, string>(); // leadId -> conversationId

/**
 * Create a new conversation for a lead
 */
export function createConversation(
  leadId: string,
  platform: Platform,
  initialLead?: Partial<LeadInfo>
): ConversationState {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const lead: LeadInfo = {
    id: leadId,
    status: 'new',
    source: platform,
    createdAt: now,
    updatedAt: now,
    ...initialLead,
  };

  const state: ConversationState = {
    id: conversationId,
    leadId,
    lead,
    messages: [],
    currentAgent: 'sdr', // Start with SDR
    platform,
    createdAt: now,
    lastMessageAt: now,
    metadata: {},
  };

  conversations.set(conversationId, state);
  leadToConversation.set(leadId, conversationId);

  return state;
}

/**
 * Get conversation by ID
 */
export function getConversation(conversationId: string): ConversationState | undefined {
  return conversations.get(conversationId);
}

/**
 * Get conversation by lead ID
 */
export function getConversationByLead(leadId: string): ConversationState | undefined {
  const conversationId = leadToConversation.get(leadId);
  if (!conversationId) return undefined;
  return conversations.get(conversationId);
}

/**
 * Add a message to conversation history
 */
export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): ConversationState | undefined {
  const state = conversations.get(conversationId);
  if (!state) return undefined;

  state.messages.push({ role, content });
  state.lastMessageAt = new Date();

  return state;
}

/**
 * Update lead information
 */
export function updateLead(
  conversationId: string,
  updates: Partial<LeadInfo>
): ConversationState | undefined {
  const state = conversations.get(conversationId);
  if (!state) return undefined;

  state.lead = {
    ...state.lead,
    ...updates,
    updatedAt: new Date(),
  };

  return state;
}

/**
 * Switch to a different agent
 */
export function switchAgent(
  conversationId: string,
  agent: AgentType
): ConversationState | undefined {
  const state = conversations.get(conversationId);
  if (!state) return undefined;

  state.currentAgent = agent;
  state.metadata.lastAgentSwitch = new Date().toISOString();
  state.metadata.previousAgent = state.currentAgent;

  return state;
}

/**
 * Get all active conversations (for follow-up scheduling)
 */
export function getActiveConversations(): ConversationState[] {
  return Array.from(conversations.values()).filter(
    (c) => !['won', 'lost'].includes(c.lead.status)
  );
}

/**
 * Get conversations needing follow-up
 */
export function getConversationsNeedingFollowUp(
  maxAgeHours: number = 24
): ConversationState[] {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  return Array.from(conversations.values()).filter(
    (c) =>
      c.lastMessageAt < cutoff &&
      !['won', 'lost'].includes(c.lead.status) &&
      c.lead.status !== 'new'
  );
}

/**
 * Build conversation context for agent prompts
 */
export function buildConversationContext(state: ConversationState): string {
  const { lead, messages, platform } = state;

  let context = `## Current Lead Information\n`;
  context += `- **Name**: ${lead.name || 'Not provided'}\n`;
  context += `- **Phone**: ${lead.phone || 'Not provided'}\n`;
  context += `- **Email**: ${lead.email || 'Not provided'}\n`;
  context += `- **City**: ${lead.city || 'Not provided'}\n`;
  context += `- **Service Interest**: ${lead.serviceInterest || 'Not specified'}\n`;
  context += `- **Project Details**: ${lead.projectDetails || 'Not provided'}\n`;
  context += `- **Timeline**: ${lead.timeline || 'Not specified'}\n`;
  context += `- **Status**: ${lead.status}\n`;
  context += `- **Platform**: ${platform}\n`;
  context += `- **Messages Exchanged**: ${messages.length}\n`;

  if (messages.length > 0) {
    context += `\n## Conversation History (last ${Math.min(10, messages.length)} messages)\n`;
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      const role = msg.role === 'user' ? 'Customer' : 'You';
      context += `**${role}**: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}\n\n`;
    }
  }

  return context;
}

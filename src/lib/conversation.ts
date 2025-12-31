import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import {
  saveConversation,
  getConversationById,
  getConversationByLeadId,
  getConversationByPhoneNumber,
  getActiveConversations as getActiveFromStorage,
  getConversationsNeedingFollowUp as getFollowUpFromStorage,
} from '../storage/redis.js';

/**
 * Conversation State Management
 *
 * Tracks conversation history, lead info, and routing context.
 * Uses Redis for persistent storage (falls back to in-memory if unavailable).
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

export type LeadTemperature = 'hot' | 'warm' | 'cool';
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
  temperature?: LeadTemperature;
  decisionMaker?: 'yes' | 'no' | 'unknown';
  source: Platform;
  createdAt: Date;
  updatedAt: Date;
  // Texting consent (TCPA compliance)
  textingConsent: boolean;
  textingConsentTimestamp?: Date;
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

/**
 * Create a new conversation for a lead
 */
export async function createConversation(
  leadId: string,
  platform: Platform,
  initialLead?: Partial<LeadInfo>
): Promise<ConversationState> {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const lead: LeadInfo = {
    id: leadId,
    status: 'new',
    source: platform,
    createdAt: now,
    updatedAt: now,
    textingConsent: false, // Must be explicitly granted
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

  await saveConversation(state);

  return state;
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationState | undefined> {
  return getConversationById(conversationId);
}

/**
 * Get conversation by lead ID
 */
export async function getConversationByLead(
  leadId: string
): Promise<ConversationState | undefined> {
  return getConversationByLeadId(leadId);
}

/**
 * Add a message to conversation history
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ConversationState | undefined> {
  const state = await getConversationById(conversationId);
  if (!state) return undefined;

  state.messages.push({ role, content });
  state.lastMessageAt = new Date();

  await saveConversation(state);

  return state;
}

/**
 * Update lead information
 */
export async function updateLead(
  conversationId: string,
  updates: Partial<LeadInfo>
): Promise<ConversationState | undefined> {
  const state = await getConversationById(conversationId);
  if (!state) return undefined;

  state.lead = {
    ...state.lead,
    ...updates,
    updatedAt: new Date(),
  };

  await saveConversation(state);

  return state;
}

/**
 * Switch to a different agent
 */
export async function switchAgent(
  conversationId: string,
  agent: AgentType
): Promise<ConversationState | undefined> {
  const state = await getConversationById(conversationId);
  if (!state) return undefined;

  state.metadata.previousAgent = state.currentAgent;
  state.currentAgent = agent;
  state.metadata.lastAgentSwitch = new Date().toISOString();

  await saveConversation(state);

  return state;
}

/**
 * Get all active conversations (for follow-up scheduling)
 */
export async function getActiveConversations(): Promise<ConversationState[]> {
  return getActiveFromStorage();
}

/**
 * Get conversations needing follow-up
 */
export async function getConversationsNeedingFollowUp(
  maxAgeHours: number = 24
): Promise<ConversationState[]> {
  return getFollowUpFromStorage(maxAgeHours);
}

/**
 * Get conversation by phone number (for inbound SMS/iMessage)
 */
export async function getConversationByPhone(
  phone: string
): Promise<ConversationState | undefined> {
  return getConversationByPhoneNumber(phone);
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
  context += `- **Temperature**: ${lead.temperature || 'Not scored'}\n`;
  context += `- **Decision Maker**: ${lead.decisionMaker || 'Unknown'}\n`;
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

import Redis from 'ioredis';
import type { ConversationState } from '../lib/conversation.js';

/**
 * Redis Storage Adapter for Conversation State
 * Provides persistent storage for conversations and lead data.
 * Falls back to in-memory storage if Redis is not available.
 */

let redis: Redis | null = null;
let useRedis = false;

// In-memory fallback (for local development without Redis)
const memoryConversations = new Map<string, ConversationState>();
const memoryLeadToConversation = new Map<string, string>();

// Redis key prefixes
const CONV_PREFIX = 'conv:';
const LEAD_PREFIX = 'lead:';
const PHONE_PREFIX = 'phone:';

// TTL for conversation data (30 days)
const CONVERSATION_TTL = 60 * 60 * 24 * 30;

/**
 * Initialize Redis connection
 */
export async function initializeStorage(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('REDIS_URL not set - using in-memory storage');
    useRedis = false;
    return;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    await redis.connect();
    await redis.ping();

    useRedis = true;
    console.log('Connected to Redis for persistent storage');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Falling back to in-memory storage');
    useRedis = false;
    redis = null;
  }
}

/**
 * Close Redis connection
 */
export async function closeStorage(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Save a conversation to storage
 */
export async function saveConversation(state: ConversationState): Promise<void> {
  const serialized = JSON.stringify(state, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });

  if (useRedis && redis) {
    const pipeline = redis.pipeline();
    pipeline.set(`${CONV_PREFIX}${state.id}`, serialized, 'EX', CONVERSATION_TTL);
    pipeline.set(`${LEAD_PREFIX}${state.leadId}`, state.id, 'EX', CONVERSATION_TTL);

    if (state.lead.phone) {
      const normalizedPhone = state.lead.phone.replace(/\D/g, '');
      pipeline.set(`${PHONE_PREFIX}${normalizedPhone}`, state.id, 'EX', CONVERSATION_TTL);
    }

    await pipeline.exec();
  } else {
    memoryConversations.set(state.id, state);
    memoryLeadToConversation.set(state.leadId, state.id);
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversationById(
  conversationId: string
): Promise<ConversationState | undefined> {
  if (useRedis && redis) {
    const data = await redis.get(`${CONV_PREFIX}${conversationId}`);
    if (!data) return undefined;
    return deserializeConversation(data);
  } else {
    return memoryConversations.get(conversationId);
  }
}

/**
 * Get a conversation by lead ID
 */
export async function getConversationByLeadId(
  leadId: string
): Promise<ConversationState | undefined> {
  if (useRedis && redis) {
    const conversationId = await redis.get(`${LEAD_PREFIX}${leadId}`);
    if (!conversationId) return undefined;
    return getConversationById(conversationId);
  } else {
    const conversationId = memoryLeadToConversation.get(leadId);
    if (!conversationId) return undefined;
    return memoryConversations.get(conversationId);
  }
}

/**
 * Get a conversation by phone number
 */
export async function getConversationByPhoneNumber(
  phone: string
): Promise<ConversationState | undefined> {
  const normalizedPhone = phone.replace(/\D/g, '');

  if (useRedis && redis) {
    let conversationId = await redis.get(`${PHONE_PREFIX}${normalizedPhone}`);

    if (!conversationId && normalizedPhone.length === 10) {
      conversationId = await redis.get(`${PHONE_PREFIX}1${normalizedPhone}`);
    }

    if (!conversationId) return undefined;
    return getConversationById(conversationId);
  } else {
    for (const conv of memoryConversations.values()) {
      if (!conv.lead.phone) continue;
      const leadPhone = conv.lead.phone.replace(/\D/g, '');
      if (
        leadPhone === normalizedPhone ||
        leadPhone.endsWith(normalizedPhone) ||
        normalizedPhone.endsWith(leadPhone)
      ) {
        return conv;
      }
    }
    return undefined;
  }
}

/**
 * Get all active conversations (not won/lost)
 */
export async function getActiveConversations(): Promise<ConversationState[]> {
  if (useRedis && redis) {
    const keys = await redis.keys(`${CONV_PREFIX}*`);
    if (keys.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }

    const results = await pipeline.exec();
    if (!results) return [];

    const conversations: ConversationState[] = [];
    for (const [err, data] of results) {
      if (err || !data) continue;
      const conv = deserializeConversation(data as string);
      if (conv && !['won', 'lost'].includes(conv.lead.status)) {
        conversations.push(conv);
      }
    }

    return conversations;
  } else {
    return Array.from(memoryConversations.values()).filter(
      (c) => !['won', 'lost'].includes(c.lead.status)
    );
  }
}

/**
 * Get conversations needing follow-up
 */
export async function getConversationsNeedingFollowUp(
  maxAgeHours: number = 24
): Promise<ConversationState[]> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const active = await getActiveConversations();

  return active.filter(
    (c) => new Date(c.lastMessageAt) < cutoff && c.lead.status !== 'new'
  );
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  if (useRedis && redis) {
    const conv = await getConversationById(conversationId);
    if (!conv) return;

    const pipeline = redis.pipeline();
    pipeline.del(`${CONV_PREFIX}${conversationId}`);
    pipeline.del(`${LEAD_PREFIX}${conv.leadId}`);

    if (conv.lead.phone) {
      const normalizedPhone = conv.lead.phone.replace(/\D/g, '');
      pipeline.del(`${PHONE_PREFIX}${normalizedPhone}`);
    }

    await pipeline.exec();
  } else {
    const conv = memoryConversations.get(conversationId);
    if (conv) {
      memoryConversations.delete(conversationId);
      memoryLeadToConversation.delete(conv.leadId);
    }
  }
}

/**
 * Check if storage is using Redis
 */
export function isUsingRedis(): boolean {
  return useRedis;
}

/**
 * Deserialize conversation from JSON string
 */
function deserializeConversation(data: string): ConversationState | undefined {
  try {
    return JSON.parse(data, (key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
  } catch {
    console.error('Failed to deserialize conversation');
    return undefined;
  }
}

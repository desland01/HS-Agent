/**
 * Typed API Client
 *
 * Handles all communication with the backend API.
 */

// Types matching the backend
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

export interface Lead {
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
  createdAt: string;
  updatedAt: string;
  textingConsent: boolean;
  textingConsentTimestamp?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agentType?: AgentType;
  corrected?: boolean;
  originalContent?: string;
}

export interface Conversation {
  id: string;
  leadId: string;
  lead: Lead;
  messages: Message[];
  currentAgent: AgentType;
  platform: Platform;
  createdAt: string;
  lastMessageAt: string;
}

export interface BusinessConfig {
  slug: string;
  businessName: string;
  ownerName: string;
  businessType: string;
  phone: string;
  email: string;
  website: string;
  serviceArea: {
    primary: string;
    cities: string[];
    radius?: string;
  };
  services: Array<{
    name: string;
    description: string;
    typicalPriceRange?: string;
    estimateTimeframe?: string;
  }>;
  differentiators: string[];
  personality: {
    tone: 'professional' | 'friendly' | 'casual' | 'luxury';
    keyPhrases?: string[];
    avoidPhrases?: string[];
  };
}

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  scheduledAppointments: number;
  estimatesSent: number;
  wonDeals: number;
  conversionRate: number;
  responseTime: number;
}

// API Error
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Base fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || 'Request failed', error);
  }

  return response.json();
}

// API methods
export const api = {
  // Leads
  leads: {
    list: (businessSlug: string) =>
      fetchApi<{ leads: Lead[] }>(`/${businessSlug}/leads`),

    get: (businessSlug: string, leadId: string) =>
      fetchApi<{ lead: Lead }>(`/${businessSlug}/leads/${leadId}`),

    create: (businessSlug: string, data: Partial<Lead>) =>
      fetchApi<{ lead: Lead }>(`/${businessSlug}/lead`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (businessSlug: string, leadId: string, data: Partial<Lead>) =>
      fetchApi<{ lead: Lead }>(`/${businessSlug}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateStatus: (businessSlug: string, leadId: string, status: LeadStatus) =>
      fetchApi<{ lead: Lead }>(`/${businessSlug}/leads/${leadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  // Conversations
  conversations: {
    list: (businessSlug: string) =>
      fetchApi<{ conversations: Conversation[] }>(`/${businessSlug}/conversations`),

    get: (businessSlug: string, conversationId: string) =>
      fetchApi<{ conversation: Conversation }>(
        `/${businessSlug}/conversations/${conversationId}`
      ),

    sendMessage: (businessSlug: string, conversationId: string, content: string) =>
      fetchApi<{ message: Message; response: Message }>(
        `/${businessSlug}/chat/message`,
        {
          method: 'POST',
          body: JSON.stringify({ conversationId, content }),
        }
      ),

    startChat: (businessSlug: string, leadData: Partial<Lead>) =>
      fetchApi<{ conversationId: string; lead: Lead }>(
        `/${businessSlug}/chat/start`,
        {
          method: 'POST',
          body: JSON.stringify(leadData),
        }
      ),

    correctMessage: (
      businessSlug: string,
      conversationId: string,
      messageId: string,
      correction: string
    ) =>
      fetchApi<{ success: boolean }>(
        `/${businessSlug}/conversations/${conversationId}/messages/${messageId}/correct`,
        {
          method: 'POST',
          body: JSON.stringify({ correction }),
        }
      ),
  },

  // Dashboard
  dashboard: {
    stats: (businessSlug: string) =>
      fetchApi<DashboardStats>(`/${businessSlug}/dashboard/stats`),
  },

  // Business config
  business: {
    get: (businessSlug: string) =>
      fetchApi<{ config: BusinessConfig }>(`/${businessSlug}/config`),

    update: (businessSlug: string, config: Partial<BusinessConfig>) =>
      fetchApi<{ config: BusinessConfig }>(`/${businessSlug}/config`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),

    create: (config: BusinessConfig) =>
      fetchApi<{ config: BusinessConfig }>('/onboarding/create', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  },

  // Auth (placeholder for future implementation)
  auth: {
    login: (email: string, password: string) =>
      fetchApi<{ token: string; user: { id: string; email: string; name: string } }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      ),

    signup: (data: { name: string; email: string; password: string }) =>
      fetchApi<{ token: string; user: { id: string; email: string; name: string } }>(
        '/auth/signup',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),

    me: () =>
      fetchApi<{ user: { id: string; email: string; name: string } }>('/auth/me'),
  },
};

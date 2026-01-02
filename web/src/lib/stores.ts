'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lead, Conversation, BusinessConfig, LeadStatus } from './api-client';

/**
 * Auth Store
 */
interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Business Store
 */
interface BusinessState {
  currentBusiness: BusinessConfig | null;
  businessSlug: string | null;
  setCurrentBusiness: (config: BusinessConfig) => void;
  setBusinessSlug: (slug: string) => void;
  clearBusiness: () => void;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      currentBusiness: null,
      businessSlug: null,
      setCurrentBusiness: (config) =>
        set({ currentBusiness: config, businessSlug: config.slug }),
      setBusinessSlug: (slug) => set({ businessSlug: slug }),
      clearBusiness: () => set({ currentBusiness: null, businessSlug: null }),
    }),
    {
      name: 'business-storage',
    }
  )
);

/**
 * Leads Store
 */
interface LeadsState {
  leads: Lead[];
  selectedLead: Lead | null;
  isLoading: boolean;
  error: string | null;
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (leadId: string, updates: Partial<Lead>) => void;
  removeLead: (leadId: string) => void;
  selectLead: (lead: Lead | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  moveLeadToStatus: (leadId: string, status: LeadStatus) => void;
  getLeadsByStatus: (status: LeadStatus) => Lead[];
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  selectedLead: null,
  isLoading: false,
  error: null,
  setLeads: (leads) => set({ leads }),
  addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
  updateLead: (leadId, updates) =>
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, ...updates } : lead
      ),
      selectedLead:
        state.selectedLead?.id === leadId
          ? { ...state.selectedLead, ...updates }
          : state.selectedLead,
    })),
  removeLead: (leadId) =>
    set((state) => ({
      leads: state.leads.filter((lead) => lead.id !== leadId),
      selectedLead:
        state.selectedLead?.id === leadId ? null : state.selectedLead,
    })),
  selectLead: (lead) => set({ selectedLead: lead }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  moveLeadToStatus: (leadId, status) =>
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead
      ),
    })),
  getLeadsByStatus: (status) => get().leads.filter((lead) => lead.status === status),
}));

/**
 * Conversations Store
 */
interface ConversationsState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  selectConversation: (conversation: Conversation | null) => void;
  addMessage: (
    conversationId: string,
    message: Conversation['messages'][number]
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  conversations: [],
  selectedConversation: null,
  isLoading: false,
  error: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),
  updateConversation: (conversationId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      ),
      selectedConversation:
        state.selectedConversation?.id === conversationId
          ? { ...state.selectedConversation, ...updates }
          : state.selectedConversation,
    })),
  selectConversation: (conversation) => set({ selectedConversation: conversation }),
  addMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, message] }
          : conv
      ),
      selectedConversation:
        state.selectedConversation?.id === conversationId
          ? {
              ...state.selectedConversation,
              messages: [...state.selectedConversation.messages, message],
            }
          : state.selectedConversation,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

/**
 * UI Store
 */
interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'light',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

/**
 * Onboarding Store
 */
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingData {
  businessName?: string;
  ownerName?: string;
  businessType?: string;
  phone?: string;
  email?: string;
  website?: string;
  serviceArea?: {
    primary?: string;
    cities?: string[];
    radius?: string;
  };
  services?: Array<{
    name: string;
    description: string;
  }>;
  differentiators?: string[];
  tone?: 'professional' | 'friendly' | 'casual' | 'luxury';
}

interface OnboardingState {
  currentStep: number;
  steps: OnboardingStep[];
  data: OnboardingData;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  isComplete: boolean;
  setStep: (step: number) => void;
  completeStep: (stepId: string) => void;
  setData: (data: Partial<OnboardingData>) => void;
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  setComplete: (complete: boolean) => void;
  reset: () => void;
}

const initialOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Let us learn about your business',
    completed: false,
  },
  {
    id: 'business-info',
    title: 'Business Info',
    description: 'Basic details about your company',
    completed: false,
  },
  {
    id: 'services',
    title: 'Services',
    description: 'What services do you offer',
    completed: false,
  },
  {
    id: 'personality',
    title: 'Brand Voice',
    description: 'How should your AI sound',
    completed: false,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm your settings',
    completed: false,
  },
];

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 0,
  steps: initialOnboardingSteps,
  data: {},
  chatHistory: [],
  isComplete: false,
  setStep: (step) => set({ currentStep: step }),
  completeStep: (stepId) =>
    set((state) => ({
      steps: state.steps.map((step) =>
        step.id === stepId ? { ...step, completed: true } : step
      ),
    })),
  setData: (data) =>
    set((state) => ({
      data: { ...state.data, ...data },
    })),
  addChatMessage: (role, content) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, { role, content }],
    })),
  setComplete: (complete) => set({ isComplete: complete }),
  reset: () =>
    set({
      currentStep: 0,
      steps: initialOnboardingSteps,
      data: {},
      chatHistory: [],
      isComplete: false,
    }),
}));

/**
 * Message Templates (CORE - Immutable)
 *
 * These templates use {{placeholders}} that are populated from BusinessConfig.
 * This file is part of the core framework and should NOT be modified by clients.
 *
 * Owner: Desmond Landry
 */

import type { BusinessConfig } from '../../config/business.schema.js';

/**
 * Lead source types for source-aware first messages
 */
export type LeadSource =
  | 'website_chat'
  | 'facebook_lead'
  | 'contact_form'
  | 'google_ads'
  | 'referral'
  | 'phone_call'
  | 'unknown';

/**
 * First message templates by lead source
 *
 * Research-backed: Under 100 characters for 2-5x higher response rate
 */
export const FIRST_MESSAGE_TEMPLATES: Record<LeadSource, string> = {
  website_chat:
    "Hi! Thanks for checking out our website. What type of {{service_category}} are you interested in?",

  facebook_lead:
    "Hi {{first_name}}, I got your estimate request and see you're interested in {{service_type}}. Tell me a little more about the project.",

  contact_form:
    "Hi {{first_name}}, thanks for reaching out! I saw your message about {{project_type}}. What's the main thing you want to change?",

  google_ads:
    "Hi {{first_name}}! You requested info about {{service_category}} in {{city}}. Which room are you thinking about?",

  referral:
    "Hi {{first_name}}! {{referrer_name}} mentioned you might be looking for help with {{service_type}}. What are you thinking about?",

  phone_call:
    "Hi {{first_name}}, thanks for your call earlier! I wanted to follow up on your {{service_type}} project. When would be a good time to chat more?",

  unknown:
    "Hi! Thanks for reaching out about {{service_category}}. What can I help you with today?",
};

/**
 * Discovery questions by room/service type
 */
export const DISCOVERY_QUESTIONS: Record<string, string[]> = {
  kitchen: [
    "Great! What's the main frustration with your current kitchen?",
    "Are you doing a full renovation or focusing just on the cabinetry?",
    "What style are you drawn to?",
  ],
  bathroom: [
    "Nice! Is it the vanity, storage, or the whole space you want to update?",
    "Is this the primary bathroom or a guest bath?",
    "Any specific storage issues you want to solve?",
  ],
  closet: [
    "Perfect! Are you looking for more organization or a complete custom system?",
    "Is this a walk-in closet or reach-in?",
    "What's driving the project right now?",
  ],
  default: [
    "What's the main thing you'd change about the current space?",
    "Is there a specific event or deadline driving the timing?",
    "Have you worked with a custom cabinet maker before?",
  ],
};

/**
 * Phone transition template
 *
 * Used when lead is qualified and ready for phone call
 */
export const PHONE_TRANSITION_TEMPLATE =
  "It sounds like we'd be a great fit for your project. The next step is a quick {{phone_call_duration}}-minute phone call with our design team to {{phone_call_purpose}}. What's the best number to reach you?";

/**
 * Phone hesitation fallback
 */
export const PHONE_HESITATION_TEMPLATE =
  "I totally understand. Would you prefer we email you some photos of similar projects first? That way you can see our work before we chat.";

/**
 * Consultation booking templates
 */
export const CONSULTATION_TEMPLATES = {
  preFrame:
    "During the consultation, our designer will measure your space, discuss your vision, show you material samples, and give you a detailed proposal. All free, no obligation. How does {{day_options}} work for you?",

  setExpectations:
    "The consultation takes about {{consultation_duration}} minutes. It helps if both decision-makers can be there so you can discuss options together. Does that work?",

  confirmed:
    "Perfect! You're confirmed for {{date}} at {{time}}. {{designer_name}} will meet you at your home. Looking forward to it!",
};

/**
 * Reminder templates
 */
export const REMINDER_TEMPLATES = {
  twentyFourHour:
    "Quick reminder, {{designer_name}} will be at your place tomorrow at {{time}} for your {{service_type}} design consultation. See you then!",

  twoHour:
    "Heads up, {{designer_name}} is on the way! Should arrive around {{time}}. Any questions before we get there?",
};

/**
 * Timeline-based scoring messages
 */
export const TIMELINE_RESPONSES: Record<'hot' | 'warm' | 'cool', string> = {
  hot: "That's a great timeline. Let's get you on the schedule.",
  warm: "Perfect, that gives us plenty of time to design something amazing.",
  cool: "No rush at all. Let me send you some ideas to think about in the meantime.",
};

/**
 * Budget pre-frame template
 *
 * Don't ask directly, educate instead
 */
export const BUDGET_PREFRAME_TEMPLATE =
  "Custom {{service_type}} typically runs {{price_range}} for a project like yours, depending on materials and features. We'll give you exact pricing during the design consultation. Does that range work for what you had in mind?";

/**
 * Authority/decision-maker check
 */
export const AUTHORITY_CHECK_TEMPLATE =
  "When it comes to decisions about the home, will you be making this call together with your spouse/partner, or are you the main decision-maker?";

/**
 * Populate a template with values from config and lead data
 */
export function populateTemplate(
  template: string,
  config: BusinessConfig,
  leadData: Record<string, string | undefined> = {}
): string {
  const replacements: Record<string, string> = {
    // Business config values
    business_name: config.businessName,
    owner_name: config.ownerName,
    phone: config.phone,
    email: config.email,
    service_area: config.serviceArea.primary,
    service_category: config.businessType,
    consultation_duration: String(config.salesProcess?.consultationDuration ?? 45),
    phone_call_duration: String(config.salesProcess?.phoneCallDuration ?? 10),
    phone_call_purpose: config.salesProcess?.phoneCallPurpose ?? 'learn more about your vision',

    // Lead data
    first_name: leadData.first_name ?? '',
    city: leadData.city ?? config.serviceArea.primary,
    service_type: leadData.service_type ?? config.services[0]?.name ?? config.businessType,
    project_type: leadData.project_type ?? '',
    referrer_name: leadData.referrer_name ?? '',
    designer_name: config.team?.[0]?.name ?? config.ownerName,
    date: leadData.date ?? '',
    time: leadData.time ?? '',
    day_options: leadData.day_options ?? 'Tuesday or Thursday',
    price_range: leadData.price_range ?? config.services[0]?.typicalPriceRange ?? '',
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return result;
}

/**
 * Get the first message template based on lead source
 */
export function getFirstMessageTemplate(source: LeadSource): string {
  return FIRST_MESSAGE_TEMPLATES[source] || FIRST_MESSAGE_TEMPLATES.unknown;
}

/**
 * Get discovery questions for a room type
 */
export function getDiscoveryQuestions(roomType: string): string[] {
  const key = roomType.toLowerCase();
  return DISCOVERY_QUESTIONS[key] || DISCOVERY_QUESTIONS.default;
}

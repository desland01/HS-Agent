/**
 * Config Generator (ONBOARDING - Future)
 *
 * Generates BusinessConfig from onboarding form data
 * and scraped website/social data.
 *
 * Owner: Desmond Landry
 */

import type { BusinessConfig } from '../../config/business.schema.js';
import type { OnboardingForm } from '../forms/onboarding-schema.js';
import type { ScrapedWebsiteData } from '../scraper/website.js';
import type { ScrapedSocialData } from '../scraper/social.js';

/**
 * Generate a URL-safe slug from business name
 */
export function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Merge scraped data with form data
 *
 * Form data takes precedence over scraped data.
 */
export function mergeScrapedWithForm(
  scraped: ScrapedWebsiteData & ScrapedSocialData,
  form: OnboardingForm
): Partial<BusinessConfig> {
  return {
    // Basic info from form (authoritative)
    businessName: form.basicInfo.businessName,
    ownerName: form.basicInfo.ownerName,
    businessType: form.basicInfo.businessType,
    phone: form.basicInfo.phone,
    email: form.basicInfo.email,
    website: form.basicInfo.website,

    // Service area from form
    serviceArea: {
      primary: `${form.serviceArea.primaryCity}, ${form.serviceArea.state}`,
      cities: [form.serviceArea.primaryCity, ...form.serviceArea.additionalCities],
      radius: form.serviceArea.radius,
    },

    // Services: form overrides scraped
    services: form.services.services.map(s => ({
      name: s.name,
      description: s.description || '',
      typicalPriceRange: s.typicalPriceRange,
      estimateTimeframe: s.estimateTimeframe,
    })),

    // Team from form
    team: form.team.team.map(t => ({
      name: t.name,
      role: t.role,
      canBook: t.canBook,
    })),

    // Differentiators: merge scraped and form
    differentiators: [
      ...form.differentiators.differentiators,
      ...(scraped.differentiators || []).filter(
        d => !form.differentiators.differentiators.includes(d)
      ),
    ],

    // Guarantees: merge scraped and form
    guarantees: [
      ...form.differentiators.guarantees,
      ...(scraped.guarantees || []).filter(
        g => !form.differentiators.guarantees.includes(g)
      ),
    ],

    // Brand voice from form
    personality: {
      tone: form.brandVoice.tone,
      keyPhrases: form.brandVoice.keyPhrases,
      avoidPhrases: form.brandVoice.avoidPhrases,
    },

    // Sales process from form
    salesProcess: {
      steps: ['chat', 'phone', 'consultation', 'proposal'],
      consultationType: form.salesProcess.consultationType,
      consultationDuration: form.salesProcess.consultationDuration,
      requireBothDecisionMakers: form.salesProcess.requireBothDecisionMakers,
      phoneCallDuration: 10,
      phoneCallPurpose: 'Learn more about your project and schedule your free consultation',
    },

    // Booking from form
    booking: {
      minLeadTime: '24 hours',
      estimateDuration: `${form.salesProcess.consultationDuration} minutes`,
      requiresDeposit: form.salesProcess.requiresDeposit,
      depositAmount: form.salesProcess.depositAmount,
    },
  };
}

/**
 * Generate complete BusinessConfig from onboarding data
 */
export function generateBusinessConfig(
  form: OnboardingForm,
  scraped?: ScrapedWebsiteData & ScrapedSocialData
): BusinessConfig {
  const slug = generateSlug(form.basicInfo.businessName);

  const merged = scraped
    ? mergeScrapedWithForm(scraped, form)
    : formToConfig(form);

  // Build complete config with defaults
  const config: BusinessConfig = {
    slug,
    businessName: form.basicInfo.businessName,
    ownerName: form.basicInfo.ownerName,
    businessType: form.basicInfo.businessType,
    phone: form.basicInfo.phone,
    email: form.basicInfo.email,
    website: form.basicInfo.website || `https://${slug}.com`,

    serviceArea: {
      primary: `${form.serviceArea.primaryCity}, ${form.serviceArea.state}`,
      cities: [form.serviceArea.primaryCity, ...form.serviceArea.additionalCities],
      radius: form.serviceArea.radius,
    },

    services: merged.services || [],
    team: merged.team || [],

    hours: {
      timezone: 'America/New_York', // TODO: Infer from state
      weekday: { start: '08:00', end: '17:00' },
      saturday: { start: '09:00', end: '13:00' },
    },

    salesProcess: merged.salesProcess,
    leadScoring: {
      hotTimeline: 3,
      warmTimeline: 6,
    },

    crm: {
      type: form.integrations.crmType === 'none' ? 'custom' : form.integrations.crmType,
      apiKey: form.integrations.crmApiKey,
      webhookUrl: form.integrations.crmWebhookUrl,
    },

    texting: {
      enabled: form.integrations.textingEnabled,
      channel: form.integrations.textingChannel,
      timezone: 'America/New_York',
      quietHours: {
        enabled: true,
        start: 20,
        end: 8,
      },
      rateLimits: {
        maxPerLeadPerDay: 3,
        maxFollowupsPerWeek: 3,
      },
    },

    personality: merged.personality || {
      tone: 'friendly',
      keyPhrases: [],
      avoidPhrases: [],
    },

    differentiators: merged.differentiators || [],
    guarantees: merged.guarantees || [],

    booking: merged.booking || {
      minLeadTime: '24 hours',
      estimateDuration: '45 minutes',
      requiresDeposit: false,
    },

    followUp: {
      afterNoResponse: [
        { waitDays: 1, channel: 'sms' },
        { waitDays: 3, channel: 'email' },
        { waitDays: 7, channel: 'call' },
      ],
      afterEstimate: [
        { waitDays: 2, channel: 'sms' },
        { waitDays: 5, channel: 'email' },
        { waitDays: 10, channel: 'call' },
      ],
    },
  };

  return config;
}

/**
 * Convert form data to config without scraped data
 */
function formToConfig(form: OnboardingForm): Partial<BusinessConfig> {
  return {
    services: form.services.services.map(s => ({
      name: s.name,
      description: s.description || '',
      typicalPriceRange: s.typicalPriceRange,
      estimateTimeframe: s.estimateTimeframe,
    })),

    team: form.team.team.map(t => ({
      name: t.name,
      role: t.role,
      canBook: t.canBook,
    })),

    differentiators: form.differentiators.differentiators,
    guarantees: form.differentiators.guarantees,

    personality: {
      tone: form.brandVoice.tone,
      keyPhrases: form.brandVoice.keyPhrases,
      avoidPhrases: form.brandVoice.avoidPhrases,
    },

    salesProcess: {
      steps: ['chat', 'phone', 'consultation', 'proposal'],
      consultationType: form.salesProcess.consultationType,
      consultationDuration: form.salesProcess.consultationDuration,
      requireBothDecisionMakers: form.salesProcess.requireBothDecisionMakers,
      phoneCallDuration: 10,
      phoneCallPurpose: 'Learn more about your project and schedule your free consultation',
    },

    booking: {
      minLeadTime: '24 hours',
      estimateDuration: `${form.salesProcess.consultationDuration} minutes`,
      requiresDeposit: form.salesProcess.requiresDeposit,
      depositAmount: form.salesProcess.depositAmount,
    },
  };
}

/**
 * Generate TypeScript config file content
 */
export function generateConfigFileContent(config: BusinessConfig): string {
  return `import type { BusinessConfig } from '../business.schema.js';

/**
 * ${config.businessName} - Auto-generated config
 *
 * Generated on: ${new Date().toISOString()}
 * Edit this file to customize your agent's behavior.
 */
export const ${toCamelCase(config.slug)}Config: BusinessConfig = ${JSON.stringify(config, null, 2)};

export default ${toCamelCase(config.slug)}Config;
`;
}

/**
 * Convert slug to camelCase
 */
function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

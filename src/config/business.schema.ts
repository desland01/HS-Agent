import { z } from 'zod';

/**
 * Business Configuration Schema
 *
 * This is what you customize per business. Everything else stays the same.
 * Just update this config and deploy - instant AI agent for any home service business.
 */

export const ServiceSchema = z.object({
  name: z.string(),
  description: z.string(),
  typicalPriceRange: z.string().optional(),
  estimateTimeframe: z.string().optional(),
});

export const TeamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  canBook: z.boolean().default(false),
});

export const BusinessHoursSchema = z.object({
  timezone: z.string().default('America/New_York'),
  weekday: z.object({
    start: z.string().default('08:00'),
    end: z.string().default('17:00'),
  }),
  saturday: z.object({
    start: z.string().default('09:00'),
    end: z.string().default('14:00'),
  }).optional(),
  sunday: z.literal(null).optional(),
});

/**
 * Sales Process Schema
 *
 * Defines the workflow from lead to close. This is CORE logic,
 * but the steps and consultation details are business-configurable.
 */
export const SalesProcessSchema = z.object({
  // Sales workflow steps
  steps: z.array(z.enum(['chat', 'phone', 'consultation', 'proposal', 'close']))
    .default(['chat', 'phone', 'consultation', 'proposal']),

  // Consultation details
  consultationType: z.enum(['in-home', 'showroom', 'virtual', 'phone-only']).default('in-home'),
  consultationDuration: z.number().default(45), // minutes
  requireBothDecisionMakers: z.boolean().default(true),

  // Phone call settings
  phoneCallDuration: z.number().default(10), // minutes for initial phone call
  phoneCallPurpose: z.string().default('Learn more about your vision and schedule your free consultation'),
});

/**
 * Lead Scoring Schema
 *
 * Timeline-based scoring for prioritization
 */
export const LeadScoringSchema = z.object({
  hotTimeline: z.number().default(3),   // 0-3 months = HOT
  warmTimeline: z.number().default(6),  // 3-6 months = WARM
  // 6+ months = COOL
});

export const CrmConfigSchema = z.object({
  type: z.enum(['gohighlevel', 'paintscout', 'pipedrive', 'hubspot', 'custom']),
  webhookUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional(),
});

export const TextingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  channel: z.enum(['imessage', 'twilio', 'none']).default('none'),
  imessageEndpoint: z.string().url().optional(),
  imessageApiKey: z.string().optional(),
  timezone: z.string().default('America/New_York'),
  quietHours: z.object({
    enabled: z.boolean().default(true),
    start: z.number().min(0).max(23).default(20), // 8pm
    end: z.number().min(0).max(23).default(8),     // 8am
  }).optional(),
  rateLimits: z.object({
    maxPerLeadPerDay: z.number().default(3),
    maxFollowupsPerWeek: z.number().default(3),
  }).optional(),
});

export const BusinessConfigSchema = z.object({
  // Core identity
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  businessName: z.string(),
  ownerName: z.string(),
  businessType: z.enum(['painting', 'cabinets', 'roofing', 'plumbing', 'hvac', 'electrical', 'landscaping', 'cleaning', 'general_contractor', 'other']),

  // Contact info
  phone: z.string(),
  email: z.string().email(),
  website: z.string().url(),

  // Service area
  serviceArea: z.object({
    primary: z.string(), // e.g., "Sarasota, FL"
    cities: z.array(z.string()),
    radius: z.string().optional(), // e.g., "30 miles"
  }),

  // Services offered
  services: z.array(ServiceSchema),

  // Team (for scheduling and personalization)
  team: z.array(TeamMemberSchema).default([]),

  // Business hours
  hours: BusinessHoursSchema,

  // Sales process
  salesProcess: SalesProcessSchema.optional(),

  // Lead scoring thresholds
  leadScoring: LeadScoringSchema.optional(),

  // CRM integration
  crm: CrmConfigSchema,

  // Texting/SMS configuration
  texting: TextingConfigSchema.optional(),

  // Brand voice
  personality: z.object({
    tone: z.enum(['professional', 'friendly', 'casual', 'luxury']).default('friendly'),
    keyPhrases: z.array(z.string()).optional(), // Phrases to naturally include
    avoidPhrases: z.array(z.string()).optional(), // Phrases to never use
  }),

  // Unique selling points (agent will emphasize these)
  differentiators: z.array(z.string()),

  // Guarantees and warranties
  guarantees: z.array(z.string()).optional(),

  // Booking rules
  booking: z.object({
    minLeadTime: z.string().default('24 hours'), // How far in advance
    estimateDuration: z.string().default('30-60 minutes'),
    requiresDeposit: z.boolean().default(false),
    depositAmount: z.string().optional(),
  }),

  // Follow-up rules
  followUp: z.object({
    afterNoResponse: z.array(z.object({
      waitDays: z.number(),
      channel: z.enum(['sms', 'email', 'call']),
      message: z.string().optional(),
    })),
    afterEstimate: z.array(z.object({
      waitDays: z.number(),
      channel: z.enum(['sms', 'email', 'call']),
      message: z.string().optional(),
    })),
  }).optional(),
});

export type BusinessConfig = z.infer<typeof BusinessConfigSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type CrmConfig = z.infer<typeof CrmConfigSchema>;
export type TextingConfig = z.infer<typeof TextingConfigSchema>;
export type SalesProcess = z.infer<typeof SalesProcessSchema>;
export type LeadScoring = z.infer<typeof LeadScoringSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;

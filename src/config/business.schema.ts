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

export const CrmConfigSchema = z.object({
  type: z.enum(['gohighlevel', 'paintscout', 'pipedrive', 'hubspot', 'custom']),
  webhookUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional(),
});

export const BusinessConfigSchema = z.object({
  // Core identity
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

  // Team (for scheduling)
  team: z.array(TeamMemberSchema).optional(),

  // Business hours
  hours: BusinessHoursSchema,

  // CRM integration
  crm: CrmConfigSchema,

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

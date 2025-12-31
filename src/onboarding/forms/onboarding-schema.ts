/**
 * Onboarding Form Schema (ONBOARDING - Future)
 *
 * Defines the fields for client onboarding forms.
 * These forms supplement scraped data.
 *
 * Owner: Desmond Landry
 */

import { z } from 'zod';

/**
 * Step 1: Basic Business Info
 */
export const BasicInfoSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  businessType: z.enum([
    'painting',
    'cabinets',
    'roofing',
    'plumbing',
    'hvac',
    'electrical',
    'landscaping',
    'cleaning',
    'general_contractor',
    'other',
  ]),
  website: z.string().url().optional(),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Valid email required'),
});

/**
 * Step 2: Service Area
 */
export const ServiceAreaSchema = z.object({
  primaryCity: z.string().min(2, 'Primary city is required'),
  state: z.string().length(2, 'Use 2-letter state code'),
  additionalCities: z.array(z.string()).default([]),
  radius: z.string().optional(), // e.g., "30 miles"
});

/**
 * Step 3: Services Offered
 */
export const ServicesSchema = z.object({
  services: z.array(
    z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      typicalPriceRange: z.string().optional(),
      estimateTimeframe: z.string().optional(),
    })
  ).min(1, 'At least one service is required'),
});

/**
 * Step 4: Team Members
 */
export const TeamSchema = z.object({
  team: z.array(
    z.object({
      name: z.string().min(2),
      role: z.string(),
      canBook: z.boolean().default(false),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
  ).default([]),
});

/**
 * Step 5: Differentiators & Guarantees
 */
export const DifferentiatorsSchema = z.object({
  differentiators: z.array(z.string()).min(1, 'Add at least one differentiator'),
  guarantees: z.array(z.string()).default([]),
});

/**
 * Step 6: Sales Process
 */
export const SalesProcessFormSchema = z.object({
  consultationType: z.enum(['in-home', 'showroom', 'virtual', 'phone-only']),
  consultationDuration: z.number().min(15).max(120).default(45),
  requireBothDecisionMakers: z.boolean().default(true),
  requiresDeposit: z.boolean().default(false),
  depositAmount: z.string().optional(),
});

/**
 * Step 7: Brand Voice
 */
export const BrandVoiceSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'casual', 'luxury']).default('friendly'),
  keyPhrases: z.array(z.string()).default([]),
  avoidPhrases: z.array(z.string()).default([]),
});

/**
 * Step 8: Integrations
 */
export const IntegrationsSchema = z.object({
  crmType: z.enum(['gohighlevel', 'paintscout', 'pipedrive', 'hubspot', 'custom', 'none']).default('none'),
  crmApiKey: z.string().optional(),
  crmWebhookUrl: z.string().url().optional(),
  textingEnabled: z.boolean().default(false),
  textingChannel: z.enum(['imessage', 'twilio', 'none']).default('none'),
});

/**
 * Complete onboarding form schema
 */
export const OnboardingFormSchema = z.object({
  basicInfo: BasicInfoSchema,
  serviceArea: ServiceAreaSchema,
  services: ServicesSchema,
  team: TeamSchema,
  differentiators: DifferentiatorsSchema,
  salesProcess: SalesProcessFormSchema,
  brandVoice: BrandVoiceSchema,
  integrations: IntegrationsSchema,
});

export type OnboardingForm = z.infer<typeof OnboardingFormSchema>;
export type BasicInfo = z.infer<typeof BasicInfoSchema>;
export type ServiceArea = z.infer<typeof ServiceAreaSchema>;
export type ServicesForm = z.infer<typeof ServicesSchema>;
export type TeamForm = z.infer<typeof TeamSchema>;
export type DifferentiatorsForm = z.infer<typeof DifferentiatorsSchema>;
export type SalesProcessForm = z.infer<typeof SalesProcessFormSchema>;
export type BrandVoiceForm = z.infer<typeof BrandVoiceSchema>;
export type IntegrationsForm = z.infer<typeof IntegrationsSchema>;

/**
 * Onboarding step metadata for UI
 */
export const ONBOARDING_STEPS = [
  { id: 'basic-info', title: 'Business Info', schema: BasicInfoSchema },
  { id: 'service-area', title: 'Service Area', schema: ServiceAreaSchema },
  { id: 'services', title: 'Services', schema: ServicesSchema },
  { id: 'team', title: 'Team', schema: TeamSchema },
  { id: 'differentiators', title: 'What Sets You Apart', schema: DifferentiatorsSchema },
  { id: 'sales-process', title: 'Sales Process', schema: SalesProcessFormSchema },
  { id: 'brand-voice', title: 'Brand Voice', schema: BrandVoiceSchema },
  { id: 'integrations', title: 'Integrations', schema: IntegrationsSchema },
] as const;

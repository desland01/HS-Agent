import type { BusinessConfig } from '../business.schema.js';

/**
 * Grove Street Painting - Sarasota Residential & Commercial Painters
 *
 * This shows how easy it is to replicate the agent for another business.
 * Same agent logic, different config.
 */
export const groveStreetConfig: BusinessConfig = {
  // Core identity
  slug: 'grove-street',
  businessName: 'Grove Street Painting',
  ownerName: 'Desmond Landry',
  businessType: 'painting',

  // Contact info
  phone: '(941) 504-3552',
  email: 'desmond@grovestreetpainting.com',
  website: 'https://grovestreetpainting.com',

  // Service area
  serviceArea: {
    primary: 'Sarasota, FL',
    cities: [
      'Sarasota',
      'Bradenton',
      'Venice',
      'Lakewood Ranch',
      'Siesta Key',
      'Longboat Key',
      'Palmer Ranch',
      'Osprey',
      'Nokomis',
      'North Port',
    ],
    radius: '30 miles of Sarasota',
  },

  // Services offered
  services: [
    {
      name: 'Interior Painting',
      description: 'Full interior painting for homes and businesses',
      typicalPriceRange: '$3,000 - $15,000',
      estimateTimeframe: '1-2 weeks from approval',
    },
    {
      name: 'Exterior Painting',
      description: 'Complete exterior painting with proper prep work',
      typicalPriceRange: '$5,000 - $25,000',
      estimateTimeframe: '1-2 weeks from approval',
    },
    {
      name: 'Cabinet Painting',
      description: 'Professional cabinet refinishing and painting',
      typicalPriceRange: '$3,000 - $8,000',
      estimateTimeframe: '1-2 weeks from approval',
    },
    {
      name: 'Commercial Painting',
      description: 'Offices, retail, HOA common areas',
      typicalPriceRange: 'Custom quote based on scope',
      estimateTimeframe: 'Varies by project size',
    },
  ],

  // Team members
  team: [
    { name: 'Desmond', role: 'Owner', canBook: true },
  ],

  // Sales process
  salesProcess: {
    steps: ['chat', 'phone', 'consultation', 'proposal'],
    consultationType: 'in-home',
    consultationDuration: 30,
    requireBothDecisionMakers: true,
    phoneCallDuration: 10,
    phoneCallPurpose: 'Discuss your project and schedule a free in-home estimate',
  },

  // Lead scoring thresholds
  leadScoring: {
    hotTimeline: 3,   // 0-3 months = HOT
    warmTimeline: 6,  // 3-6 months = WARM
  },

  // Business hours
  hours: {
    timezone: 'America/New_York',
    weekday: { start: '07:00', end: '17:00' },
    saturday: { start: '08:00', end: '12:00' },
  },

  // CRM integration (GoHighLevel for this business)
  crm: {
    type: 'gohighlevel',
    webhookUrl: process.env.GHL_WEBHOOK_URL,
    apiKey: process.env.GHL_API_KEY,
  },

  // Brand voice
  personality: {
    tone: 'professional',
    keyPhrases: [
      'owner-operated',
      'Sarasota area',
      'proper preparation',
      'lasting results',
      'nightly cleanup',
      'concierge coordination',
    ],
    avoidPhrases: [
      'cheap',
      'quick job',
      'spray and pray',
    ],
  },

  // What makes us different
  differentiators: [
    'Owner on every job - not a franchise',
    'Nightly cleanup - no mess left behind',
    'Concierge coordination for HOA projects',
    '10-year warranty on exterior work',
    'Coastal-specific paint systems that last',
    'Full crew with no subcontractors',
  ],

  // Guarantees
  guarantees: [
    '10-year warranty on exterior painting',
    '5-year warranty on interior painting',
    'Nightly cleanup guarantee',
    'Color satisfaction guarantee',
    'On-time completion or discount',
  ],

  // Booking rules
  booking: {
    minLeadTime: '24 hours',
    estimateDuration: '30-45 minutes',
    requiresDeposit: true,
    depositAmount: '25% to start, progress payments',
  },

  // Follow-up sequences
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
      { waitDays: 21, channel: 'email' }, // Final follow-up
    ],
  },
};

export default groveStreetConfig;

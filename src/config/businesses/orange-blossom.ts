import type { BusinessConfig } from '../business.schema.js';

/**
 * Orange Blossom Cabinets - Sarasota Custom Cabinet Maker
 *
 * This is a complete example config. Copy this file and modify for any
 * home service business.
 */
export const orangeBlossomConfig: BusinessConfig = {
  // Core identity
  slug: 'orange-blossom',
  businessName: 'Orange Blossom Cabinets',
  ownerName: 'Brandon',
  businessType: 'cabinets',

  // Contact info
  phone: '(941) 500-4395',
  email: 'info@orangeblossomcabinets.com',
  website: 'https://orangeblossomcabinets.com',

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
    ],
    radius: '30 miles of Sarasota',
  },

  // Services offered
  services: [
    {
      name: 'Custom Kitchen Cabinets',
      description: 'Full custom kitchen cabinet design and installation',
      typicalPriceRange: '$15,000 - $60,000+',
      estimateTimeframe: '6-10 weeks from approval',
    },
    {
      name: 'Bathroom Vanities',
      description: 'Custom bathroom vanity cabinets',
      typicalPriceRange: '$3,000 - $12,000',
      estimateTimeframe: '4-6 weeks from approval',
    },
    {
      name: 'Built-in Cabinets',
      description: 'Entertainment centers, home offices, closet systems',
      typicalPriceRange: '$5,000 - $25,000',
      estimateTimeframe: '4-8 weeks from approval',
    },
    {
      name: 'Cabinet Refacing',
      description: 'Update existing cabinets with new doors and finishes',
      typicalPriceRange: '$8,000 - $20,000',
      estimateTimeframe: '2-4 weeks from approval',
    },
  ],

  // Team members
  team: [
    { name: 'Brandon', role: 'Owner', canBook: true },
    { name: 'Design Team', role: 'Designer', canBook: true },
  ],

  // Sales process
  salesProcess: {
    steps: ['chat', 'phone', 'consultation', 'proposal'],
    consultationType: 'in-home',
    consultationDuration: 45,
    requireBothDecisionMakers: true,
    phoneCallDuration: 10,
    phoneCallPurpose: 'Learn more about your vision and schedule your free in-home design consultation',
  },

  // Lead scoring thresholds
  leadScoring: {
    hotTimeline: 3,   // 0-3 months = HOT
    warmTimeline: 6,  // 3-6 months = WARM
  },

  // Business hours
  hours: {
    timezone: 'America/New_York',
    weekday: { start: '08:00', end: '17:00' },
    saturday: { start: '09:00', end: '13:00' },
  },

  // CRM integration (PaintScout for this business)
  crm: {
    type: 'paintscout',
    webhookUrl: process.env.PAINTSCOUT_WEBHOOK_URL,
    apiKey: process.env.PAINTSCOUT_API_KEY,
  },

  // iMessage/SMS configuration
  texting: {
    enabled: !!process.env.OB_IMESSAGE_ENDPOINT,
    channel: 'imessage',
    imessageEndpoint: process.env.OB_IMESSAGE_ENDPOINT,
    imessageApiKey: process.env.OB_IMESSAGE_API_KEY,
    timezone: 'America/New_York',
    quietHours: {
      enabled: true,
      start: 20, // 8pm
      end: 8,    // 8am
    },
    rateLimits: {
      maxPerLeadPerDay: 3,
      maxFollowupsPerWeek: 3,
    },
  },

  // Brand voice
  personality: {
    tone: 'friendly',
    keyPhrases: [
      'locally owned and operated',
      'master craftsmen',
      'Sarasota area',
      'custom built',
      'quality that lasts',
    ],
    avoidPhrases: [
      'cheap',
      'discount',
      'cookie-cutter',
      'mass-produced',
    ],
  },

  // What makes us different
  differentiators: [
    'Local Sarasota family-owned business',
    'Custom designs - no cookie-cutter solutions',
    'Master craftsmen with 20+ years experience',
    'We handle everything from design to installation',
    'Showroom in Sarasota where you can see our work',
    'Lifetime warranty on craftsmanship',
  ],

  // Guarantees
  guarantees: [
    'Lifetime warranty on craftsmanship',
    'On-time delivery or we make it right',
    'Design satisfaction guarantee',
    'Clean job site every day',
  ],

  // Booking rules
  booking: {
    minLeadTime: '48 hours',
    estimateDuration: '45-60 minutes',
    requiresDeposit: true,
    depositAmount: '50% to start, 50% on completion',
  },

  // Follow-up sequences
  followUp: {
    afterNoResponse: [
      { waitDays: 1, channel: 'sms', message: 'Hi! Just following up on your cabinet inquiry. When would be a good time to chat?' },
      { waitDays: 3, channel: 'email' },
      { waitDays: 7, channel: 'call' },
    ],
    afterEstimate: [
      { waitDays: 2, channel: 'sms', message: 'Hi! Wanted to check if you had any questions about the estimate we put together for you.' },
      { waitDays: 5, channel: 'email' },
      { waitDays: 10, channel: 'call' },
    ],
  },
};

export default orangeBlossomConfig;

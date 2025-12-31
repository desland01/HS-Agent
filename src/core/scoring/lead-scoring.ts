/**
 * Lead Scoring (CORE - Immutable)
 *
 * Timeline-based lead scoring using research-backed thresholds.
 * This file is part of the core framework and should NOT be modified by clients.
 *
 * Owner: Desmond Landry
 */

import type { BusinessConfig, LeadScoring } from '../../config/business.schema.js';
import type { LeadTemperature } from '../../lib/conversation.js';

// Re-export LeadTemperature from conversation for convenience
// The canonical definition is in conversation.ts
export type { LeadTemperature };

/**
 * Default scoring thresholds (in months)
 *
 * Research shows:
 * - 0-3 months: 21x more likely to qualify
 * - 3-6 months: Worth nurturing
 * - 6+ months: Add to drip, check quarterly
 */
const DEFAULT_THRESHOLDS: LeadScoring = {
  hotTimeline: 3,
  warmTimeline: 6,
};

/**
 * Score a lead based on their timeline
 *
 * @param timelineMonths - Number of months until project
 * @param config - Optional business config with custom thresholds
 * @returns Lead temperature
 */
export function scoreByTimeline(
  timelineMonths: number,
  config?: BusinessConfig
): LeadTemperature {
  const thresholds = config?.leadScoring ?? DEFAULT_THRESHOLDS;

  if (timelineMonths <= thresholds.hotTimeline) {
    return 'hot';
  }

  if (timelineMonths <= thresholds.warmTimeline) {
    return 'warm';
  }

  return 'cool';
}

/**
 * Parse timeline text to months
 *
 * Handles various formats:
 * - "ASAP", "now", "immediately" -> 0
 * - "1-2 weeks" -> 0.5
 * - "1 month", "next month" -> 1
 * - "2-3 months" -> 2.5
 * - "6 months" -> 6
 * - "next year" -> 12
 * - "just looking", "not sure" -> 12 (default to cool)
 */
export function parseTimelineToMonths(timeline: string): number {
  const text = timeline.toLowerCase().trim();

  // Immediate
  if (/asap|now|immediately|right away|urgent|emergency/.test(text)) {
    return 0;
  }

  // This week/next week
  if (/this week|next week|1-2 weeks|few days/.test(text)) {
    return 0.5;
  }

  // Within a month
  if (/this month|next month|few weeks|1 month|within 30 days/.test(text)) {
    return 1;
  }

  // Parse "X months" or "X-Y months"
  const monthRangeMatch = text.match(/(\d+)\s*-?\s*(\d+)?\s*month/);
  if (monthRangeMatch) {
    const min = parseInt(monthRangeMatch[1], 10);
    const max = monthRangeMatch[2] ? parseInt(monthRangeMatch[2], 10) : min;
    return (min + max) / 2;
  }

  // Seasonal
  if (/spring|summer|fall|autumn|winter/.test(text)) {
    // Estimate based on current date
    const now = new Date();
    const currentMonth = now.getMonth();

    const seasons: Record<string, number> = {
      spring: 3,   // March
      summer: 6,   // June
      fall: 9,     // September
      autumn: 9,   // September
      winter: 12,  // December
    };

    for (const [season, targetMonth] of Object.entries(seasons)) {
      if (text.includes(season)) {
        let monthsAway = targetMonth - currentMonth;
        if (monthsAway < 0) monthsAway += 12; // Next year
        return monthsAway;
      }
    }
  }

  // Next year
  if (/next year|sometime next year|2025|2026/.test(text)) {
    return 12;
  }

  // Just looking / not sure (default to cool)
  if (/just looking|browsing|not sure|undecided|exploring/.test(text)) {
    return 12;
  }

  // Default: if we can't parse, assume moderate timeline
  return 6;
}

/**
 * Get action recommendations based on lead temperature
 */
export function getTemperatureActions(temperature: LeadTemperature): {
  urgency: 'immediate' | 'standard' | 'nurture';
  nextSteps: string[];
  followUpDays: number;
} {
  switch (temperature) {
    case 'hot':
      return {
        urgency: 'immediate',
        nextSteps: [
          'Push for phone call today',
          'Book consultation within 48 hours',
          'Fast-track to design team',
        ],
        followUpDays: 1,
      };

    case 'warm':
      return {
        urgency: 'standard',
        nextSteps: [
          'Schedule phone call this week',
          'Send portfolio of similar projects',
          'Add to nurture sequence',
        ],
        followUpDays: 3,
      };

    case 'cool':
      return {
        urgency: 'nurture',
        nextSteps: [
          'Add to email drip campaign',
          'Send inspiration content',
          'Check back in 30-60 days',
        ],
        followUpDays: 30,
      };
  }
}

/**
 * Combined lead score based on multiple factors
 */
export interface LeadScore {
  temperature: LeadTemperature;
  timelineMonths: number;
  hasDecisionMaker: boolean;
  hasContactInfo: boolean;
  budgetAligned: boolean;
  overallScore: number; // 0-100
}

/**
 * Calculate overall lead score
 */
export function calculateLeadScore(params: {
  timelineMonths: number;
  hasDecisionMaker: boolean;
  hasContactInfo: boolean;
  budgetAligned: boolean;
  config?: BusinessConfig;
}): LeadScore {
  const { timelineMonths, hasDecisionMaker, hasContactInfo, budgetAligned, config } = params;

  const temperature = scoreByTimeline(timelineMonths, config);

  // Calculate overall score (0-100)
  let score = 0;

  // Timeline (40 points max)
  if (temperature === 'hot') score += 40;
  else if (temperature === 'warm') score += 25;
  else score += 10;

  // Decision maker (20 points)
  if (hasDecisionMaker) score += 20;

  // Contact info (20 points)
  if (hasContactInfo) score += 20;

  // Budget aligned (20 points)
  if (budgetAligned) score += 20;

  return {
    temperature,
    timelineMonths,
    hasDecisionMaker,
    hasContactInfo,
    budgetAligned,
    overallScore: score,
  };
}

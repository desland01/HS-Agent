/**
 * Website Scraper (ONBOARDING - Future)
 *
 * Scrapes business websites to auto-populate BusinessConfig.
 * Uses Firecrawl MCP server for intelligent scraping.
 *
 * Owner: Desmond Landry
 */

import type { BusinessConfig } from '../../config/business.schema.js';

/**
 * Scraped data from a business website
 */
export interface ScrapedWebsiteData {
  businessName?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  services?: Array<{
    name: string;
    description?: string;
    priceRange?: string;
  }>;
  team?: Array<{
    name: string;
    role?: string;
  }>;
  differentiators?: string[];
  guarantees?: string[];
  hours?: {
    weekday?: string;
    saturday?: string;
    sunday?: string;
  };
}

/**
 * Scrape a business website for onboarding data
 *
 * @param url - The website URL to scrape
 * @returns Scraped business data
 *
 * TODO: Implement with Firecrawl MCP server
 * - Scrape homepage for business name, tagline, contact info
 * - Scrape /services or /what-we-do for services
 * - Scrape /about or /team for team members
 * - Scrape /contact for hours and location
 * - Use AI to extract structured data from unstructured text
 */
export async function scrapeWebsite(url: string): Promise<ScrapedWebsiteData> {
  // TODO: Implement with Firecrawl
  console.log(`[Website Scraper] Would scrape: ${url}`);

  return {
    // Placeholder - will be populated by Firecrawl
  };
}

/**
 * Scrape multiple pages from a website
 */
export async function scrapeWebsiteDeep(
  baseUrl: string,
  paths: string[] = ['/services', '/about', '/contact']
): Promise<ScrapedWebsiteData> {
  // TODO: Implement with Firecrawl map + batch scrape
  console.log(`[Website Scraper] Would deep scrape: ${baseUrl}`);
  console.log(`[Website Scraper] Paths: ${paths.join(', ')}`);

  return {};
}

/**
 * Extract business type from website content
 */
export function inferBusinessType(
  content: string
): BusinessConfig['businessType'] {
  const lowerContent = content.toLowerCase();

  const typePatterns: Array<{
    type: BusinessConfig['businessType'];
    keywords: string[];
  }> = [
    { type: 'painting', keywords: ['painting', 'painter', 'paint'] },
    { type: 'cabinets', keywords: ['cabinet', 'cabinetry', 'woodwork', 'millwork'] },
    { type: 'roofing', keywords: ['roofing', 'roofer', 'roof'] },
    { type: 'plumbing', keywords: ['plumbing', 'plumber', 'pipes'] },
    { type: 'hvac', keywords: ['hvac', 'air conditioning', 'heating', 'cooling'] },
    { type: 'electrical', keywords: ['electrical', 'electrician', 'wiring'] },
    { type: 'landscaping', keywords: ['landscaping', 'lawn', 'garden', 'yard'] },
    { type: 'cleaning', keywords: ['cleaning', 'maid', 'janitorial', 'housekeeping'] },
    { type: 'general_contractor', keywords: ['contractor', 'remodel', 'renovation', 'construction'] },
  ];

  for (const { type, keywords } of typePatterns) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      return type;
    }
  }

  return 'other';
}

/**
 * Extract service area cities from website content
 */
export function extractServiceArea(content: string): string[] {
  // TODO: Use AI to extract city names from "We serve..." sections
  // For now, return empty array
  return [];
}

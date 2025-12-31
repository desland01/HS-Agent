/**
 * Onboarding Module (FUTURE - SaaS Client Onboarding)
 *
 * This module provides utilities for onboarding new clients:
 * 1. Scraping their website and social profiles
 * 2. Collecting business info via forms
 * 3. Generating BusinessConfig from combined data
 *
 * Flow:
 * [Website URL] → scrapeWebsite() → ScrapedWebsiteData
 * [Social Links] → scrapeAllSocial() → ScrapedSocialData
 * [Form Input] → OnboardingForm
 * [All Data] → generateBusinessConfig() → BusinessConfig
 *
 * Owner: Desmond Landry
 */

export * from './scraper/index.js';
export * from './forms/index.js';
export * from './generator/index.js';

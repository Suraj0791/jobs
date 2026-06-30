// ============================================================
// Base ATS Collector — abstract class all collectors extend
// ============================================================

import type { Job, JobSource } from '../../models/job.js';
import { CONFIG } from '../../config/constants.js';

/**
 * Abstract base class for ATS (Applicant Tracking System) collectors.
 * 
 * Each collector knows how to:
 * 1. Extract a board slug from a career URL
 * 2. Fetch jobs from that ATS's public API
 * 3. Normalize results to the unified Job model
 * 
 * Adding a new ATS = extending this class + implementing fetchJobs().
 */
export abstract class ATSCollector {
  /** The ATS identifier (matches OpenJobData's `ats` field) */
  abstract readonly atsName: JobSource;

  /** Human-readable display name */
  abstract readonly displayName: string;

  /** URL patterns this ATS uses (for slug extraction) */
  abstract readonly urlPatterns: RegExp[];

  /**
   * Fetch all active job postings for a company from this ATS.
   * 
   * @param slug - The company's board token/slug for this ATS
   * @param companyName - Human-readable company name
   * @param companyId - OpenJobData company ID
   * @returns Normalized Job[] array
   */
  abstract fetchJobs(slug: string, companyName: string, companyId: number): Promise<Job[]>;

  /**
   * Extract the board slug from a career URL.
   * Returns null if the URL doesn't match this ATS's pattern.
   * 
   * Examples:
   * - "https://boards.greenhouse.io/razorpay" → "razorpay"
   * - "https://jobs.lever.co/stripe" → "stripe"
   * - "https://jobs.ashbyhq.com/notion" → "notion"
   * - "https://careers.smartrecruiters.com/Twilio" → "Twilio"
   */
  extractSlug(careerUrl: string): string | null {
    if (!careerUrl) return null;

    for (const pattern of this.urlPatterns) {
      const match = careerUrl.match(pattern);
      if (match?.[1]) {
        // Clean the slug: remove trailing slashes, query params
        return match[1].split('/')[0].split('?')[0].trim();
      }
    }
    return null;
  }

  /**
   * Rate-limited fetch with retry logic.
   * Adds a polite delay between requests and retries on transient failures.
   */
  protected async rateLimitedFetch(
    url: string,
    options?: RequestInit,
    retries = 2
  ): Promise<Response> {
    // Polite delay between requests
    await sleep(CONFIG.atsDelayMs);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': 'ai-job-radar/1.0',
            'Accept': 'application/json',
            ...(options?.headers || {}),
          },
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (response.ok) return response;

        // Don't retry 404s — the company likely doesn't use this ATS
        if (response.status === 404) return response;

        // Retry on 429 (rate limited) and 5xx (server error)
        if (response.status === 429 || response.status >= 500) {
          if (attempt < retries) {
            const backoff = (attempt + 1) * 2000;
            console.log(`    ⏳ ${response.status} from ${url}, retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
          }
        }

        return response;
      } catch (error) {
        if (attempt < retries) {
          const backoff = (attempt + 1) * 2000;
          console.log(`    ⏳ Fetch error for ${url}, retrying in ${backoff}ms...`);
          await sleep(backoff);
          continue;
        }
        throw error;
      }
    }

    // Should not reach here, but TypeScript needs it
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }
}

/** Simple sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Registry of all available ATS collectors.
 * Import and register new collectors here.
 */
export const ATS_COLLECTORS: Map<string, ATSCollector> = new Map();

/**
 * Register a collector in the global registry.
 * Called at module load time by each collector file.
 */
export function registerCollector(collector: ATSCollector): void {
  ATS_COLLECTORS.set(collector.atsName, collector);
}

/**
 * Get a collector by ATS name, or undefined if not supported.
 */
export function getCollector(atsName: string): ATSCollector | undefined {
  return ATS_COLLECTORS.get(atsName);
}

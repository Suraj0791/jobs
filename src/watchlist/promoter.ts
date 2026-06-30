// ============================================================
// Watchlist Promoter — auto-promote high-scoring companies
// ============================================================

import type { ScoredJob } from '../models/job.js';
import { CompaniesStore } from '../db/store.js';
import { SUPPORTED_ATS, type SupportedATS } from '../config/constants.js';
import { getCollector } from '../sources/ats/base.js';

/**
 * After Gemini scoring, check if any high-scoring jobs came from companies
 * NOT currently in the watchlist. If so, auto-promote them.
 * 
 * This is how the watchlist grows organically:
 * 1. OpenJobData surfaces a job from "Company ABC"
 * 2. Gemini scores it 9+
 * 3. Company ABC isn't in the watchlist
 * 4. We check if their ATS is supported
 * 5. If yes → add to watchlist with source='promoted'
 * 6. From now on, Company ABC gets fast-lane hourly polling
 * 
 * @param scoredJobs - Jobs that scored above the threshold
 * @param store - CompaniesStore instance
 * @param minScore - Minimum score for auto-promotion (default: 8.5)
 * @returns Number of companies promoted
 */
export function promoteHighScoringCompanies(
  scoredJobs: ScoredJob[],
  store: CompaniesStore,
  minScore = 8.5
): number {
  let promoted = 0;

  for (const { job, score } of scoredJobs) {
    // Only promote high scorers
    if (score.score < minScore) continue;

    // Must have a valid company ID from OpenJobData
    if (job.companyId <= 0) continue;

    // Skip if already in watchlist
    if (store.isInWatchlist(job.companyId)) continue;

    // Look up company details
    const company = store.getCompany(job.companyId);
    if (!company) continue;

    // Check if their ATS is supported
    const atsName = company.ats?.toLowerCase();
    if (!atsName || !SUPPORTED_ATS.includes(atsName as SupportedATS)) continue;

    // Try to extract slug
    const collector = getCollector(atsName);
    if (!collector) continue;

    const slug = collector.extractSlug(company.career_url);
    if (!slug) continue;

    // Promote!
    store.addToWatchlist({
      companyId: company.id,
      companyName: company.name,
      ats: atsName,
      slug,
      careerUrl: company.career_url,
      source: 'promoted',
    });

    console.log(`  🆕 Auto-promoted "${company.name}" to watchlist (score: ${score.score})`);
    promoted++;
  }

  return promoted;
}

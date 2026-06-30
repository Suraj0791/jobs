// ============================================================
// Hourly Workflow — Watchlist → ATS Collectors → Filter → Score → Notify
// ============================================================

import type { Job, RunStats, ScoredJob } from '../models/job.js';
import { CompaniesStore, SeenJobsStore } from '../db/store.js';
import { ATS_COLLECTORS, getCollector } from '../sources/ats/base.js';
import { filterUnseen, markSeen, getJobKey } from '../dedup/deduplicator.js';
import { scoreJobs, filterByThreshold } from '../scoring/gemini.js';
import { notifyJobMatches, notifySummary } from '../notify/telegram.js';
import { promoteHighScoringCompanies } from '../watchlist/promoter.js';
import { TITLE_INCLUDE_KEYWORDS, TITLE_EXCLUDE_KEYWORDS, SUPPORTED_ATS, CONFIG } from '../config/constants.js';

// Import collectors to trigger self-registration
import '../sources/ats/greenhouse.js';
import '../sources/ats/lever.js';
import '../sources/ats/ashby.js';
import '../sources/ats/smartrecruiters.js';

/**
 * Quick title-based filter for ATS-collected jobs.
 * Mirrors the DuckDB filter logic but runs in-memory.
 */
function titleFilter(jobs: Job[]): Job[] {
  return jobs.filter(job => {
    const title = job.title.toLowerCase();

    // Must match at least one include keyword
    const hasInclude = TITLE_INCLUDE_KEYWORDS.some(kw => title.includes(kw));
    if (!hasInclude) return false;

    // Must NOT match any exclude keyword
    const hasExclude = TITLE_EXCLUDE_KEYWORDS.some(kw => title.includes(kw));
    if (hasExclude) return false;

    return true;
  });
}

/**
 * Location filter for ATS-collected jobs.
 * India (any work type) + remote worldwide.
 */
function locationFilter(jobs: Job[]): Job[] {
  return jobs.filter(job => {
    // Remote jobs from anywhere
    if (job.remote) return true;
    if (job.workplaceType?.toLowerCase() === 'remote') return true;

    // India-based jobs (any work type)
    const loc = job.location.toLowerCase();
    if (loc.includes('india') || loc.includes('bangalore') || loc.includes('bengaluru') ||
        loc.includes('mumbai') || loc.includes('delhi') || loc.includes('hyderabad') ||
        loc.includes('pune') || loc.includes('chennai') || loc.includes('gurgaon') ||
        loc.includes('gurugram') || loc.includes('noida') || loc.includes('kolkata') ||
        loc.includes('ahmedabad') || loc.includes('jaipur') || loc.includes('chandigarh') ||
        loc.includes('kochi') || loc.includes('thiruvananthapuram') || loc.includes('indore')) {
      return true;
    }

    // "Anywhere" / "Worldwide" / "Global"
    if (loc.includes('remote') || loc.includes('anywhere') || loc.includes('worldwide') || loc.includes('global')) {
      return true;
    }

    return false;
  });
}

/**
 * Run the hourly watchlist polling workflow.
 */
export async function runHourlyWorkflow(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  🕐 HOURLY WORKFLOW — Watchlist ATS Polling');
  console.log('═══════════════════════════════════════════');

  const stats: RunStats = {
    workflow: 'hourly',
    startedAt: new Date().toISOString(),
    jobsScanned: 0,
    afterDuckDbFilter: 0,
    afterDedup: 0,
    sentToGemini: 0,
    aboveThreshold: 0,
    notified: 0,
    companiesPromoted: 0,
    errors: [],
  };

  const companiesStore = new CompaniesStore();
  const seenStore = new SeenJobsStore();

  try {
    // Step 1: Load watchlist
    const watchlist = companiesStore.getWatchlist();
    console.log(`\n📋 Watchlist: ${watchlist.length} companies`);

    if (watchlist.length === 0) {
      console.log('  ⚠ Watchlist is empty! Run the weekly workflow first.');
      return;
    }

    // Step 2: Group by ATS and fetch jobs
    const allJobs: Job[] = [];

    for (const ats of SUPPORTED_ATS) {
      const companies = companiesStore.getWatchlistByAts(ats);
      if (companies.length === 0) continue;

      const collector = getCollector(ats);
      if (!collector) {
        console.log(`  ⚠ No collector registered for ${ats}`);
        continue;
      }

      console.log(`\n🔌 ${collector.displayName}: polling ${companies.length} companies...`);

      for (const company of companies) {
        try {
          const jobs = await collector.fetchJobs(company.slug, company.companyName, company.companyId);
          if (jobs.length > 0) {
            console.log(`    ✓ ${company.companyName}: ${jobs.length} jobs`);
            allJobs.push(...jobs);
          }
        } catch (error) {
          const msg = `${company.companyName} (${ats}): ${(error as Error).message}`;
          console.log(`    ✗ ${msg}`);
          stats.errors.push(msg);
        }
      }
    }

    stats.jobsScanned = allJobs.length;
    console.log(`\n📊 Total jobs fetched: ${allJobs.length}`);

    if (allJobs.length === 0) {
      console.log('  No jobs found from any ATS. Exiting.');
      await notifySummary(stats);
      return;
    }

    // Step 3: Title + location filter
    const titleFiltered = titleFilter(allJobs);
    console.log(`  Title filter: ${allJobs.length} → ${titleFiltered.length}`);

    const locationFiltered = locationFilter(titleFiltered);
    console.log(`  Location filter: ${titleFiltered.length} → ${locationFiltered.length}`);
    stats.afterDuckDbFilter = locationFiltered.length;

    // Step 4: Dedup
    const unseenJobs = filterUnseen(locationFiltered, seenStore);
    stats.afterDedup = unseenJobs.length;

    if (unseenJobs.length === 0) {
      console.log('  No new jobs after dedup. Exiting.');
      await notifySummary(stats);
      return;
    }

    // Step 5: Gemini scoring
    stats.sentToGemini = unseenJobs.length;
    const scoredJobs = await scoreJobs(unseenJobs);

    // Step 6: Filter by threshold
    const passingJobs = filterByThreshold(scoredJobs);
    stats.aboveThreshold = passingJobs.length;

    // Step 7: Notify via Telegram
    if (passingJobs.length > 0) {
      const sent = await notifyJobMatches(passingJobs);
      stats.notified = sent;
    }

    // Step 8: Auto-promote high-scoring companies
    stats.companiesPromoted = promoteHighScoringCompanies(passingJobs, companiesStore);

    // Step 9: Mark ALL scored jobs as seen (not just passing ones)
    const scoreMap = new Map<string, { score: number; notified: boolean }>();
    for (const sj of scoredJobs) {
      scoreMap.set(getJobKey(sj.job), {
        score: sj.score.score,
        notified: sj.score.score >= CONFIG.scoreThreshold,
      });
    }
    markSeen(unseenJobs, seenStore, scoreMap);

    // Step 10: Summary
    await notifySummary(stats);

    console.log('\n✅ Hourly workflow complete');
  } catch (error) {
    console.error('❌ Hourly workflow failed:', error);
    stats.errors.push((error as Error).message);
    await notifySummary(stats);
    throw error;
  } finally {
    companiesStore.close();
    seenStore.close();
  }
}

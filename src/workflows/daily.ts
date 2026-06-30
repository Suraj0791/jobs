// ============================================================
// Daily Workflow — OpenJobData changes → Filter → Score → Notify
// ============================================================

import type { RunStats } from '../models/job.js';
import { CompaniesStore, SeenJobsStore } from '../db/store.js';
import { downloadLatestChanges, downloadCompanies } from '../sources/openjobdata/downloader.js';
import { filterDailyChanges, lookupCompanies, getParquetRowCount } from '../sources/openjobdata/filter.js';
import { filterUnseen, markSeen, getJobKey } from '../dedup/deduplicator.js';
import { scoreJobs, filterByThreshold } from '../scoring/llm.js';
import { notifyJobMatches, notifySummary } from '../notify/telegram.js';
import { promoteHighScoringCompanies } from '../watchlist/promoter.js';
import { closeDuckDB } from '../db/duckdb.js';
import { CONFIG } from '../config/constants.js';

/**
 * Run the daily OpenJobData workflow.
 * 
 * Pipeline:
 * 1. Download today's (or yesterday's) minimal changes parquet
 * 2. DuckDB filter: country + remote + title keywords + exclude seniority
 * 3. Enrich with company names from companies.parquet
 * 4. Dedup against seen_jobs.db
 * 5. Score with Gemini
 * 6. Notify via Telegram (score >= threshold)
 * 7. Auto-promote new companies to watchlist
 * 8. Mark all scored jobs as seen
 */
export async function runDailyWorkflow(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  📅 DAILY WORKFLOW — OpenJobData Changes');
  console.log('═══════════════════════════════════════════');

  const stats: RunStats = {
    workflow: 'daily',
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
    // Step 1: Download daily changes
    console.log('\n📥 Downloading daily changes...');
    const changes = await downloadLatestChanges();

    if (!changes) {
      console.log('  ⚠ No changes file available. Exiting.');
      await notifySummary(stats);
      return;
    }

    console.log(`  ✓ Using changes for: ${changes.date}`);

    // Get total row count for stats
    const totalRows = await getParquetRowCount(changes.path);
    stats.jobsScanned = totalRows;
    console.log(`  📊 Total jobs in changes file: ${totalRows.toLocaleString()}`);

    // Step 2: DuckDB filter
    console.log('\n🔍 Applying DuckDB filter...');
    const filteredJobs = await filterDailyChanges(changes.path);
    stats.afterDuckDbFilter = filteredJobs.length;

    if (filteredJobs.length === 0) {
      console.log('  No jobs passed the DuckDB filter. Exiting.');
      await notifySummary(stats);
      return;
    }

    // Step 3: Enrich with company names
    console.log('\n🏢 Enriching with company information...');
    try {
      const companyIds = [...new Set(filteredJobs.map(j => j.companyId).filter(id => id > 0))];
      
      if (companyIds.length > 0) {
        // Try downloading companies.parquet for enrichment
        const companiesPath = await downloadCompanies();
        const companyMap = await lookupCompanies(companiesPath, companyIds);
        
        for (const job of filteredJobs) {
          const company = companyMap.get(job.companyId);
          if (company) {
            job.company = company.name;
            job.ats = company.ats || '';
          }
        }
        console.log(`  ✓ Enriched ${companyMap.size} companies`);
      }
    } catch (error) {
      // Non-fatal: jobs will still have empty company names
      console.log(`  ⚠ Company enrichment failed: ${(error as Error).message}`);
      stats.errors.push(`Company enrichment: ${(error as Error).message}`);
    }

    // Step 4: Dedup
    console.log('\n🔄 Deduplicating...');
    const unseenJobs = filterUnseen(filteredJobs, seenStore);
    stats.afterDedup = unseenJobs.length;

    if (unseenJobs.length === 0) {
      console.log('  All jobs already seen. Exiting.');
      await notifySummary(stats);
      return;
    }

    // Step 5: Gemini scoring
    console.log('\n🤖 Scoring with Gemini...');
    stats.sentToGemini = unseenJobs.length;
    const scoredJobs = await scoreJobs(unseenJobs);

    // Step 6: Filter by threshold
    const passingJobs = filterByThreshold(scoredJobs);
    stats.aboveThreshold = passingJobs.length;

    // Step 7: Notify via Telegram
    if (passingJobs.length > 0) {
      console.log('\n📱 Sending Telegram notifications...');
      const sent = await notifyJobMatches(passingJobs);
      stats.notified = sent;
    }

    // Step 8: Auto-promote companies
    if (passingJobs.length > 0) {
      console.log('\n🆕 Checking for company promotions...');
      stats.companiesPromoted = promoteHighScoringCompanies(passingJobs, companiesStore);
    }

    // Step 9: Mark ALL scored jobs as seen
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

    console.log('\n✅ Daily workflow complete');
  } catch (error) {
    console.error('❌ Daily workflow failed:', error);
    stats.errors.push((error as Error).message);
    await notifySummary(stats);
    throw error;
  } finally {
    companiesStore.close();
    seenStore.close();
    await closeDuckDB();
  }
}

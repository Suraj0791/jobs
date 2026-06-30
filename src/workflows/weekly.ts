// ============================================================
// Weekly Workflow — Refresh companies.db + Regenerate watchlist
// ============================================================

import { CompaniesStore } from '../db/store.js';
import { downloadCompanies } from '../sources/openjobdata/downloader.js';
import { generateWatchlist } from '../watchlist/generator.js';
import { closeDuckDB } from '../db/duckdb.js';

// Import collectors to trigger self-registration (needed for slug extraction)
import '../sources/ats/greenhouse.js';
import '../sources/ats/lever.js';
import '../sources/ats/ashby.js';
import '../sources/ats/smartrecruiters.js';

/**
 * Run the weekly companies refresh workflow.
 * 
 * Pipeline:
 * 1. Download companies.parquet from HuggingFace bucket
 * 2. Load all 107k+ companies into companies.db (SQLite)
 * 3. Auto-generate watchlist (500–1000 companies with supported ATS)
 * 4. Log stats
 */
export async function runWeeklyWorkflow(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  📆 WEEKLY WORKFLOW — Companies Refresh');
  console.log('═══════════════════════════════════════════');

  const store = new CompaniesStore();

  try {
    // Step 1: Download companies.parquet
    console.log('\n📥 Downloading companies.parquet...');
    const companiesPath = await downloadCompanies();

    // Step 2 + 3: Load companies + generate watchlist
    console.log('\n📋 Generating watchlist...');
    const result = await generateWatchlist(companiesPath, store);

    // Step 4: Log summary
    console.log('\n═══════════════════════════════════════════');
    console.log(`  📊 WEEKLY SUMMARY`);
    console.log(`  Companies in database: ${result.totalCompanies.toLocaleString()}`);
    console.log(`  Watchlist size: ${result.watchlistSize}`);
    console.log('═══════════════════════════════════════════');

    console.log('\n✅ Weekly workflow complete');
  } catch (error) {
    console.error('❌ Weekly workflow failed:', error);
    throw error;
  } finally {
    store.close();
    await closeDuckDB();
  }
}

// ============================================================
// Watchlist Generator — auto-build watchlist from companies.parquet
// ============================================================

import { queryParquet } from '../db/duckdb.js';
import { CompaniesStore } from '../db/store.js';
import {
  SUPPORTED_ATS,
  WATCHLIST_INDUSTRIES,
  WATCHLIST_COUNTRIES,
  CONFIG,
} from '../config/constants.js';
import { getCollector } from '../sources/ats/base.js';

/**
 * Row shape from companies.parquet after DuckDB filtering.
 */
interface CompanyRow {
  id: number;
  name: string;
  website: string;
  ats: string;
  slug: string;
  unique_id: string;
  career_url: string;
  founded: number | null;
  size: string | null;
  locality: string | null;
  region: string | null;
  country: string | null;
  industry: string | null;
  linkedin_url: string | null;
  linkedin_id: string | null;
}

/**
 * Load companies from parquet into the SQLite companies table,
 * then generate the watchlist based on filters.
 * 
 * @param companiesParquetPath - Local path to downloaded companies.parquet
 * @param store - CompaniesStore instance
 */
export async function generateWatchlist(
  companiesParquetPath: string,
  store: CompaniesStore
): Promise<{ totalCompanies: number; watchlistSize: number }> {
  const safePath = companiesParquetPath.replace(/\\/g, '/').replace(/'/g, "''");

  // ── Step 1: Load ALL companies into SQLite ────────────────
  console.log('  📥 Loading companies from parquet into SQLite...');

  const allCompanies = await queryParquet<CompanyRow>(`
    SELECT *
    FROM read_parquet('${safePath}')
  `);

  console.log(`  ✓ Found ${allCompanies.length.toLocaleString()} companies in parquet`);

  // Batch insert into SQLite (transaction-wrapped for speed)
  const BATCH_SIZE = 5000;
  for (let i = 0; i < allCompanies.length; i += BATCH_SIZE) {
    const batch = allCompanies.slice(i, i + BATCH_SIZE);
    store.upsertCompanies(batch.map(c => ({
      id: c.id,
      name: c.name || '',
      website: c.website ?? undefined,
      ats: c.ats ?? undefined,
      slug: c.slug ?? undefined,
      unique_id: c.unique_id ?? undefined,
      career_url: c.career_url ?? undefined,
      founded: c.founded ?? null,
      size: c.size ?? null,
      locality: c.locality ?? null,
      region: c.region ?? null,
      country: c.country ?? null,
      industry: c.industry ?? null,
      linkedin_url: c.linkedin_url ?? null,
      linkedin_id: c.linkedin_id ?? null,
    })));
  }

  console.log(`  ✓ Loaded ${allCompanies.length.toLocaleString()} companies into SQLite`);

  // ── Step 2: Filter for watchlist candidates ────────────────
  console.log('  🔍 Filtering watchlist candidates...');

  const atsFilter = SUPPORTED_ATS.map(a => `'${a}'`).join(',');
  const industryPattern = WATCHLIST_INDUSTRIES.map(i => i.replace(/'/g, "''")).join('|');
  const countryList = WATCHLIST_COUNTRIES.map(c => `'${c}'`).join(',');

  const candidates = await queryParquet<CompanyRow>(`
    SELECT *
    FROM read_parquet('${safePath}')
    WHERE
      -- Must use a supported ATS
      LOWER(COALESCE(ats, '')) IN (${atsFilter})

      -- Industry filter: must match OR be null (many good companies have null industry)
      AND (
        LOWER(COALESCE(industry, '')) SIMILAR TO '%(${industryPattern})%'
        OR industry IS NULL
      )

      -- Country filter: must match OR be null (remote-first companies)
      AND (
        LOWER(COALESCE(country, '')) IN (${countryList})
        OR country IS NULL
      )

      -- Must have a career URL (otherwise we can't extract a slug)
      AND career_url IS NOT NULL
      AND career_url != ''

    ORDER BY name
    LIMIT ${CONFIG.maxWatchlistSize}
  `);

  console.log(`  ✓ Found ${candidates.length} watchlist candidates`);

  // ── Step 3: Extract slugs and build watchlist ─────────────
  console.log('  🔧 Extracting ATS slugs from career URLs...');

  // Clear old auto-generated watchlist (keep promoted ones)
  store.clearAutoWatchlist();

  const entries: {
    companyId: number;
    companyName: string;
    ats: string;
    slug: string;
    careerUrl: string;
    source: 'auto' | 'promoted';
  }[] = [];

  let slugFailures = 0;

  for (const company of candidates) {
    const collector = getCollector(company.ats);
    if (!collector) continue;

    const slug = collector.extractSlug(company.career_url);
    if (!slug) {
      slugFailures++;
      continue;
    }

    entries.push({
      companyId: company.id,
      companyName: company.name,
      ats: company.ats,
      slug,
      careerUrl: company.career_url,
      source: 'auto',
    });
  }

  store.addManyToWatchlist(entries);

  const finalSize = store.getWatchlistSize();
  console.log(`  ✓ Watchlist generated: ${finalSize} companies`);
  if (slugFailures > 0) {
    console.log(`  ⚠ Skipped ${slugFailures} companies (couldn't extract slug from career URL)`);
  }

  // Print breakdown by ATS
  for (const ats of SUPPORTED_ATS) {
    const count = store.getWatchlistByAts(ats).length;
    console.log(`    ${ats}: ${count} companies`);
  }

  return {
    totalCompanies: allCompanies.length,
    watchlistSize: finalSize,
  };
}

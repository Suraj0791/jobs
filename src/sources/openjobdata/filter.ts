// ============================================================
// OpenJobData DuckDB Filter — SQL pre-filter before Gemini
// ============================================================

import { queryParquet } from '../../db/duckdb.js';
import type { Job } from '../../models/job.js';
import {
  TITLE_INCLUDE_KEYWORDS,
  TITLE_EXCLUDE_KEYWORDS,
} from '../../config/constants.js';

/**
 * Raw row shape from the minimal parquet schema.
 * Matches OpenJobData's documented schema exactly.
 */
interface ParquetJobRow {
  id: string;
  job_id: string;
  company_id: number;
  title: string;
  department: string | null;
  employment_type: string | null;
  workplace_type: string | null;
  country: string | null;
  is_remote: boolean | null;
  posted_at: string | null;
  apply_url: string | null;
  fetched_time: string | null;
  status: string | null;
  close_time: string | null;
}

/**
 * Build the SIMILAR TO regex pattern for title include keywords.
 * DuckDB's SIMILAR TO uses SQL regex: | for alternation, % for wildcard.
 */
function buildIncludePattern(): string {
  const escaped = TITLE_INCLUDE_KEYWORDS.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
     .replace(/ /g, '.') // Allow flexible spacing
  );
  return `%(${escaped.join('|')})%`;
}

/**
 * Build the SIMILAR TO regex pattern for title exclude keywords.
 */
function buildExcludePattern(): string {
  const escaped = TITLE_EXCLUDE_KEYWORDS.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
     .replace(/ /g, '.')
  );
  return `%(${escaped.join('|')})%`;
}

/**
 * Filter a daily changes parquet file using DuckDB SQL.
 * 
 * This is the FREE pre-filter that runs before Gemini scoring.
 * It removes obviously irrelevant jobs using SQL, which costs nothing
 * and takes milliseconds. Only the survivors get sent to Gemini.
 * 
 * Filter logic:
 * 1. Only active jobs
 * 2. Location: India (any work type) OR remote worldwide
 * 3. Title: must contain at least one software/entry-level keyword
 * 4. Title: must NOT contain any senior/non-tech keywords
 * 
 * @param parquetPath - Local path to the downloaded parquet file
 * @returns Normalized Job[] array
 */
export async function filterDailyChanges(parquetPath: string): Promise<Job[]> {
  const includePattern = buildIncludePattern();
  const excludePattern = buildExcludePattern();

  // Escape single quotes in the file path for SQL
  const safePath = parquetPath.replace(/\\/g, '/').replace(/'/g, "''");

  const sql = `
    SELECT
      id,
      job_id,
      company_id,
      title,
      department,
      employment_type,
      workplace_type,
      country,
      is_remote,
      posted_at,
      apply_url,
      status
    FROM read_parquet('${safePath}')
    WHERE
      -- Only active jobs
      (status = 'active' OR status IS NULL)

      -- Location: India (any work type) OR remote worldwide
      AND (
        LOWER(COALESCE(country, '')) = 'india'
        OR COALESCE(is_remote, false) = true
        OR LOWER(COALESCE(workplace_type, '')) = 'remote'
        OR LOWER(COALESCE(country, '')) LIKE '%remote%'
        OR LOWER(COALESCE(country, '')) LIKE '%anywhere%'
      )

      -- Title: must match at least one include keyword
      AND LOWER(COALESCE(title, '')) SIMILAR TO '${includePattern}'

      -- Title: must NOT match any exclude keyword
      AND NOT LOWER(COALESCE(title, '')) SIMILAR TO '${excludePattern}'
    
    ORDER BY posted_at DESC
  `;

  console.log('  🔍 Running DuckDB filter on parquet...');

  const rows = await queryParquet<ParquetJobRow>(sql);

  console.log(`  ✓ DuckDB filter: ${rows.length} jobs passed`);

  // Normalize to unified Job model
  return rows.map(row => normalizeParquetRow(row));
}

/**
 * Query the companies parquet file to get company info for a list of company IDs.
 */
export async function lookupCompanies(
  companiesParquetPath: string,
  companyIds: number[]
): Promise<Map<number, { name: string; ats: string; career_url: string }>> {
  if (companyIds.length === 0) return new Map();

  const safePath = companiesParquetPath.replace(/\\/g, '/').replace(/'/g, "''");
  const idList = companyIds.join(',');

  const sql = `
    SELECT id, name, ats, career_url
    FROM read_parquet('${safePath}')
    WHERE id IN (${idList})
  `;

  const rows = await queryParquet<{
    id: number;
    name: string;
    ats: string;
    career_url: string;
  }>(sql);

  const map = new Map<number, { name: string; ats: string; career_url: string }>();
  for (const row of rows) {
    map.set(row.id, { name: row.name, ats: row.ats, career_url: row.career_url });
  }
  return map;
}

/**
 * Get total row count of a parquet file (for stats).
 */
export async function getParquetRowCount(parquetPath: string): Promise<number> {
  const safePath = parquetPath.replace(/\\/g, '/').replace(/'/g, "''");
  const rows = await queryParquet<{ count: number }>(
    `SELECT COUNT(*) as count FROM read_parquet('${safePath}')`
  );
  return rows[0]?.count ?? 0;
}

/**
 * Convert a raw parquet row to the unified Job model.
 */
function normalizeParquetRow(row: ParquetJobRow): Job {
  return {
    id: row.id || `unknown/${row.job_id}`,
    jobId: row.job_id || '',
    company: '', // Will be enriched later via company lookup
    companyId: row.company_id ?? -1,
    title: row.title || '',
    description: '', // Minimal parquet doesn't include descriptions
    applyUrl: row.apply_url || '',
    location: row.country || 'Unknown',
    remote: row.is_remote ?? false,
    employmentType: row.employment_type || '',
    workplaceType: row.workplace_type || '',
    department: row.department || '',
    postedAt: row.posted_at || '',
    source: 'openjobdata',
    ats: '', // Will be enriched via company lookup
  };
}

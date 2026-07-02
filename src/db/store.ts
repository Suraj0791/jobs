// ============================================================
// SQLite Store — persistent state for dedup and watchlist
// ============================================================

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { WatchlistEntry } from '../models/job.js';
import { CONFIG } from '../config/constants.js';
import { COMPANIES_SCHEMA, SEEN_JOBS_SCHEMA } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



/**
 * Manages the companies.db database (company registry + watchlist).
 */
export class CompaniesStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || join(process.cwd(), CONFIG.dataDir, 'companies.db');
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init(): void {
    this.db.exec(COMPANIES_SCHEMA);
  }

  /** Upsert a single company record */
  upsertCompany(company: {
    id: number;
    name: string;
    website?: string;
    ats?: string;
    slug?: string;
    unique_id?: string;
    career_url?: string;
    founded?: number | null;
    size?: string | null;
    locality?: string | null;
    region?: string | null;
    country?: string | null;
    industry?: string | null;
    linkedin_url?: string | null;
    linkedin_id?: string | null;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO companies (id, name, website, ats, slug, unique_id, career_url, founded, size, locality, region, country, industry, linkedin_url, linkedin_id)
      VALUES (@id, @name, @website, @ats, @slug, @unique_id, @career_url, @founded, @size, @locality, @region, @country, @industry, @linkedin_url, @linkedin_id)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        website = excluded.website,
        ats = excluded.ats,
        slug = excluded.slug,
        unique_id = excluded.unique_id,
        career_url = excluded.career_url,
        founded = excluded.founded,
        size = excluded.size,
        locality = excluded.locality,
        region = excluded.region,
        country = excluded.country,
        industry = excluded.industry,
        linkedin_url = excluded.linkedin_url,
        linkedin_id = excluded.linkedin_id
    `);
    stmt.run(company);
  }

  /** Batch upsert companies (wrapped in a transaction for speed) */
  upsertCompanies(companies: Parameters<CompaniesStore['upsertCompany']>[0][]): void {
    const stmt = this.db.prepare(`
      INSERT INTO companies (id, name, website, ats, slug, unique_id, career_url, founded, size, locality, region, country, industry, linkedin_url, linkedin_id)
      VALUES (@id, @name, @website, @ats, @slug, @unique_id, @career_url, @founded, @size, @locality, @region, @country, @industry, @linkedin_url, @linkedin_id)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        website = excluded.website,
        ats = excluded.ats,
        slug = excluded.slug,
        unique_id = excluded.unique_id,
        career_url = excluded.career_url,
        founded = excluded.founded,
        size = excluded.size,
        locality = excluded.locality,
        region = excluded.region,
        country = excluded.country,
        industry = excluded.industry,
        linkedin_url = excluded.linkedin_url,
        linkedin_id = excluded.linkedin_id
    `);

    const transaction = this.db.transaction(() => {
      for (const company of companies) {
        stmt.run(company);
      }
    });
    transaction();
  }

  /** Get total company count */
  getCompanyCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
    return row.count;
  }

  /** Look up a company by ID */
  getCompany(id: number): {
    id: number;
    name: string;
    ats: string;
    career_url: string;
    slug: string;
  } | undefined {
    return this.db.prepare('SELECT id, name, ats, career_url, slug FROM companies WHERE id = ?').get(id) as any;
  }

  // ---------- Watchlist ----------

  /** Get all watchlist entries */
  getWatchlist(): WatchlistEntry[] {
    const rows = this.db.prepare(`
      SELECT 
        w.company_id as companyId,
        w.company_name as companyName,
        w.ats,
        w.slug,
        w.career_url as careerUrl,
        w.source
      FROM watchlist w
      ORDER BY w.ats, w.company_name
    `).all() as WatchlistEntry[];
    return rows;
  }

  /** Get watchlist entries for a specific ATS */
  getWatchlistByAts(ats: string): WatchlistEntry[] {
    return this.db.prepare(`
      SELECT 
        company_id as companyId,
        company_name as companyName,
        ats,
        slug,
        career_url as careerUrl,
        source
      FROM watchlist
      WHERE ats = ?
      ORDER BY company_name
    `).all(ats) as WatchlistEntry[];
  }

  /** Get watchlist size */
  getWatchlistSize(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM watchlist').get() as { count: number };
    return row.count;
  }

  /** Add a company to the watchlist */
  addToWatchlist(entry: {
    companyId: number;
    companyName: string;
    ats: string;
    slug: string;
    careerUrl: string;
    source: 'auto' | 'promoted';
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO watchlist (company_id, company_name, ats, slug, career_url, source)
      VALUES (@companyId, @companyName, @ats, @slug, @careerUrl, @source)
    `).run(entry);
  }

  /** Batch add to watchlist */
  addManyToWatchlist(entries: Parameters<CompaniesStore['addToWatchlist']>[0][]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO watchlist (company_id, company_name, ats, slug, career_url, source)
      VALUES (@companyId, @companyName, @ats, @slug, @careerUrl, @source)
    `);
    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        stmt.run(entry);
      }
    });
    transaction();
  }

  /** Check if a company is already in the watchlist */
  isInWatchlist(companyId: number): boolean {
    const row = this.db.prepare('SELECT 1 FROM watchlist WHERE company_id = ?').get(companyId);
    return row !== undefined;
  }

  /** Clear the entire watchlist (before regeneration) */
  clearAutoWatchlist(): void {
    this.db.prepare("DELETE FROM watchlist WHERE source = 'auto'").run();
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}

/**
 * Manages the seen_jobs.db database (dedup tracking).
 */
export class SeenJobsStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || join(process.cwd(), CONFIG.dataDir, 'seen_jobs.db');
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(SEEN_JOBS_SCHEMA);
  }

  /** Check if a job has already been seen/processed */
  isJobSeen(jobKey: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM seen_jobs WHERE job_key = ?').get(jobKey);
    return row !== undefined;
  }

  /** Mark a job as seen (after processing) */
  markJobSeen(entry: {
    jobKey: string;
    source: string;
    company?: string;
    title?: string;
    score?: number;
    notified: boolean;
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO seen_jobs (job_key, source, company, title, score, notified)
      VALUES (@jobKey, @source, @company, @title, @score, @notified)
    `).run({
      ...entry,
      notified: entry.notified ? 1 : 0,
    });
  }

  /** Batch mark jobs as seen */
  markJobsSeen(entries: Parameters<SeenJobsStore['markJobSeen']>[0][]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO seen_jobs (job_key, source, company, title, score, notified)
      VALUES (@jobKey, @source, @company, @title, @score, @notified)
    `);
    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        stmt.run({
          ...entry,
          notified: entry.notified ? 1 : 0,
        });
      }
    });
    transaction();
  }

  /** Get total count of seen jobs */
  getSeenCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM seen_jobs').get() as { count: number };
    return row.count;
  }

  /** Get count of notified jobs */
  getNotifiedCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM seen_jobs WHERE notified = 1').get() as { count: number };
    return row.count;
  }

  /**
   * Remove seen_jobs entries that were never actually scored (score IS NULL).
   * These are jobs that were marked "seen" during a broken run where all LLM
   * providers failed. Calling this at the start of a run recovers them so they
   * get properly scored on the next attempt.
   * Returns the number of rows removed.
   */
  clearUnscored(): number {
    const result = this.db.prepare('DELETE FROM seen_jobs WHERE score IS NULL').run();
    return result.changes;
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}

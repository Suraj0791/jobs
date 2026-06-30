-- ============================================================
-- SQLite Schema for AI Job Radar persistent state
-- Two databases: companies.db and seen_jobs.db
-- ============================================================

-- ============================================================
-- companies.db tables
-- ============================================================

-- Full company registry (loaded from OpenJobData companies.parquet)
CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  website       TEXT,
  ats           TEXT,
  slug          TEXT,
  unique_id     TEXT,
  career_url    TEXT,
  founded       INTEGER,
  size          TEXT,
  locality      TEXT,
  region        TEXT,
  country       TEXT,
  industry      TEXT,
  linkedin_url  TEXT,
  linkedin_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_companies_ats ON companies(ats);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);

-- Watchlist: subset of companies we actively poll via ATS APIs
CREATE TABLE IF NOT EXISTS watchlist (
  company_id    INTEGER PRIMARY KEY,
  company_name  TEXT NOT NULL,
  ats           TEXT NOT NULL,
  slug          TEXT NOT NULL,
  career_url    TEXT,
  source        TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'promoted'
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_ats ON watchlist(ats);


-- ============================================================
-- seen_jobs.db tables
-- ============================================================

-- Deduplication: tracks every job we've already processed
CREATE TABLE IF NOT EXISTS seen_jobs (
  job_key       TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  company       TEXT,
  title         TEXT,
  score         REAL,
  notified      INTEGER NOT NULL DEFAULT 0,  -- 1 if Telegram was sent
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seen_jobs_source ON seen_jobs(source);
CREATE INDEX IF NOT EXISTS idx_seen_jobs_notified ON seen_jobs(notified);

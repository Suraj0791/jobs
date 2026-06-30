// ============================================================
// Unified Job Model — every source normalizes to this shape
// ============================================================

/**
 * The canonical job representation used throughout the entire pipeline.
 * Every ATS collector and OpenJobData filter MUST return this shape.
 */
export interface Job {
  /** Compound unique ID: "{company_slug}/{job_id}" or OpenJobData's `id` field */
  id: string;

  /** ATS-specific job posting ID */
  jobId: string;

  /** Human-readable company name */
  company: string;

  /** OpenJobData company ID (if known, -1 otherwise) */
  companyId: number;

  /** Job title */
  title: string;

  /** Job description (may be empty for minimal parquet source) */
  description: string;

  /** Direct URL to apply */
  applyUrl: string;

  /** Location string: country, city, or "Remote" */
  location: string;

  /** Whether this is a remote position */
  remote: boolean;

  /** Employment type: "Full-time", "Part-time", "Internship", "Contract", etc. */
  employmentType: string;

  /** Workplace type: "remote", "hybrid", "on-site", etc. */
  workplaceType: string;

  /** Department or team */
  department: string;

  /** ISO datetime string when the job was posted */
  postedAt: string;

  /** Where this job was discovered */
  source: JobSource;

  /** Which ATS this job is from */
  ats: string;
}

/** All possible job sources in the pipeline */
export type JobSource =
  | 'openjobdata'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters';

/**
 * Gemini scoring result for a single job match.
 * This is the structured JSON output Gemini returns.
 */
export interface GeminiScoreResult {
  /** Match score 0-10 (float, e.g. 9.2) */
  score: number;

  /** Whether Gemini recommends applying */
  apply: boolean;

  /** 1-2 sentence explanation of why this is/isn't a good match */
  reason: string;

  /** Skills listed in the JD that the candidate lacks */
  missingSkills: string[];

  /** Brief advice on tailoring resume for this specific role */
  resumeSuggestions: string;

  /** Draft referral/cold message template for LinkedIn */
  linkedinMessage: string;

  /** Topics likely to come up in an interview for this role */
  interviewTopics: string[];
}

/**
 * A scored job — the final output before Telegram notification.
 */
export interface ScoredJob {
  job: Job;
  score: GeminiScoreResult;
}

/**
 * Company record from OpenJobData's companies.parquet
 */
export interface Company {
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
 * A watchlist entry — a company we actively poll for new jobs.
 */
export interface WatchlistEntry {
  companyId: number;
  companyName: string;
  ats: string;
  slug: string;
  careerUrl: string;
  source: 'auto' | 'promoted';
}

/**
 * Stats collected during a pipeline run for the summary notification.
 */
export interface RunStats {
  workflow: 'hourly' | 'daily' | 'weekly';
  startedAt: string;
  jobsScanned: number;
  afterDuckDbFilter: number;
  afterDedup: number;
  sentToGemini: number;
  aboveThreshold: number;
  notified: number;
  companiesPromoted: number;
  errors: string[];
}

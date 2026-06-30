// ============================================================
// Constants — keywords, thresholds, and configuration
// ============================================================

/**
 * Title keywords — at least ONE must appear in the job title.
 * Covers: software roles + entry-level indicators.
 */
export const TITLE_INCLUDE_KEYWORDS = [
  // Role types
  'software', 'engineer', 'developer', 'backend', 'frontend',
  'full stack', 'fullstack', 'full-stack',
  'sde', 'swe', 'devops', 'platform', 'cloud',
  'data', 'ai', 'ml', 'qa', 'sre', 'web',
  'application', 'systems', 'infrastructure',
  // Entry-level indicators
  'intern', 'internship', 'graduate', 'entry',
  'fresher', 'trainee', 'associate', 'apprentice',
  'new grad', 'early career', 'campus', 'junior',
  'sde-1', 'sde1', 'sde 1', 'sde-i', 'sde i',
  'level 1', 'level i', 'l1',
] as const;

/**
 * Title keywords — if ANY appears, the job is EXCLUDED.
 * Removes: senior roles, non-tech roles, high-experience roles.
 */
export const TITLE_EXCLUDE_KEYWORDS = [
  // Seniority
  'senior', 'staff', 'lead', 'principal', 'director',
  'architect', 'manager', 'vp', 'chief', 'head of',
  'distinguished', 'fellow',
  // Years of experience in title
  '10+ years', '8+ years', '7+ years', '6+ years',
  '5+ years', '4+ years', '3+ years',
  '10 years', '8 years', '7 years', '5 years',
  // Non-tech roles
  'doctor', 'nurse', 'chef', 'sales', 'marketing',
  'hr', 'finance', 'accounting', 'legal', 'recruiter',
  'business development', 'customer success',
  'product manager', 'project manager',
  'mechanical', 'civil', 'electrical',
] as const;

/**
 * Industries to include when auto-generating the watchlist.
 * These are matched case-insensitively against companies.parquet's `industry` field.
 */
export const WATCHLIST_INDUSTRIES = [
  'software', 'saas', 'internet', 'information technology',
  'computer', 'ai', 'artificial intelligence', 'machine learning',
  'cloud', 'fintech', 'edtech', 'healthtech',
  'data', 'analytics', 'cybersecurity', 'security',
  'e-commerce', 'ecommerce', 'marketplace',
  'payments', 'banking', 'financial services',
  'telecommunications', 'media', 'gaming',
  'technology', 'tech', 'digital',
] as const;

/**
 * ATS systems with clean public APIs — these get fast-lane watchlist polling.
 */
export const SUPPORTED_ATS = [
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
] as const;

export type SupportedATS = typeof SUPPORTED_ATS[number];

/**
 * Countries to include in watchlist generation.
 * Companies HQ'd in these countries are candidates for the watchlist.
 * (null country is also included — many remote-first companies have null)
 */
export const WATCHLIST_COUNTRIES = [
  'india', 'united states', 'united kingdom',
  'germany', 'canada', 'singapore', 'australia',
  'netherlands', 'ireland', 'israel', 'sweden',
  'france', 'japan',
] as const;

/**
 * Environment-driven configuration with sensible defaults.
 */
export const CONFIG = {
  /** Minimum score (0-10) to trigger a Telegram notification */
  get scoreThreshold(): number {
    return parseFloat(process.env.SCORE_THRESHOLD || '7');
  },

  /** Get available LLM providers from environment variables (Automatic Fallback list) */
  get llmProviders() {
    const providers = [];

    // 1. Groq (Fastest, 14k free requests/day)
    if (process.env.GROQ_API_KEY) {
      providers.push({
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        delayMs: 2000, // Groq is fast, 30 RPM
      });
    }

    // 2. OpenRouter (DeepSeek / Llama 3)
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
        delayMs: 3000,
      });
    }

    // 3. Google Gemini (via OpenAI compatibility)
    if (process.env.GEMINI_API_KEY) {
      providers.push({
        name: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        delayMs: 6000, // 15 RPM max
      });
    }

    return providers;
  },

  /** Max LLM API calls per workflow run (budget guard) */
  get maxLlmCallsPerRun(): number {
    return parseInt(process.env.MAX_LLM_CALLS_PER_RUN || '200', 10);
  },

  /** Dry run mode — no Telegram, no DB writes */
  get dryRun(): boolean {
    return process.env.DRY_RUN === 'true';
  },

  /** Delay between ATS API calls in ms (politeness) */
  atsDelayMs: 150,

  /** Maximum watchlist size */
  maxWatchlistSize: 2000,

  /** OpenJobData HuggingFace bucket base URL */
  hfBucketBase: 'https://huggingface.co/api/buckets/Invicto69/Jobs-Dataset-bucket/tree/data',

  /** Direct file download base */
  hfDownloadBase: 'https://huggingface.co/buckets/Invicto69/Jobs-Dataset-bucket/resolve/data',

  /** Temp directory for downloaded parquet files */
  tmpDir: 'tmp',

  /** Data directory for persistent state (git-tracked) */
  dataDir: 'data',
} as const;

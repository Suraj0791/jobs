// ============================================================
// Curated Tech Company Seed List
// ============================================================
//
// These are manually verified tech/startup companies that:
//   1. Use a supported ATS (Greenhouse, Lever, Ashby, SmartRecruiters)
//   2. Actively hire software engineers, interns, and entry-level roles
//   3. Are either India-based, or remote-friendly global companies
//
// Format: { companyName, ats, slug, careerUrl }
// The company_id is set to a negative sentinel (-1 to -N) to avoid
// collision with real OpenJobData company IDs (which are positive).
//
// To add more: find the ATS career URL and extract the slug.
//   Greenhouse:       https://boards.greenhouse.io/<slug>
//   Lever:            https://jobs.lever.co/<slug>
//   Ashby:            https://jobs.ashbyhq.com/<slug>
//   SmartRecruiters:  https://jobs.smartrecruiters.com/<slug>
// ============================================================

export interface SeedCompany {
  companyName: string;
  ats: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters';
  slug: string;
  careerUrl: string;
}

// ── Indian Product & Startup Companies ──────────────────────
const INDIAN_COMPANIES: SeedCompany[] = [
  // Fintech
  { companyName: 'Razorpay', ats: 'lever', slug: 'razorpay', careerUrl: 'https://jobs.lever.co/razorpay' },
  { companyName: 'CRED', ats: 'lever', slug: 'cred-club', careerUrl: 'https://jobs.lever.co/cred-club' },
  { companyName: 'slice', ats: 'lever', slug: 'sliceit', careerUrl: 'https://jobs.lever.co/sliceit' },
  { companyName: 'Fi Money', ats: 'lever', slug: 'epifi', careerUrl: 'https://jobs.lever.co/epifi' },
  { companyName: 'Jupiter', ats: 'lever', slug: 'jupiter-money', careerUrl: 'https://jobs.lever.co/jupiter-money' },
  { companyName: 'Groww', ats: 'lever', slug: 'groww', careerUrl: 'https://jobs.lever.co/groww' },
  { companyName: 'Smallcase', ats: 'lever', slug: 'smallcase', careerUrl: 'https://jobs.lever.co/smallcase' },
  { companyName: 'BharatPe', ats: 'lever', slug: 'bharatpe', careerUrl: 'https://jobs.lever.co/bharatpe' },
  { companyName: 'Khatabook', ats: 'lever', slug: 'khatabook', careerUrl: 'https://jobs.lever.co/khatabook' },
  { companyName: 'OKCredit', ats: 'lever', slug: 'okcredit', careerUrl: 'https://jobs.lever.co/okcredit' },
  // SaaS / B2B
  { companyName: 'Freshworks', ats: 'greenhouse', slug: 'freshworks', careerUrl: 'https://boards.greenhouse.io/freshworks' },
  { companyName: 'Chargebee', ats: 'lever', slug: 'chargebee', careerUrl: 'https://jobs.lever.co/chargebee' },
  { companyName: 'Zoho', ats: 'smartrecruiters', slug: 'Zoho', careerUrl: 'https://jobs.smartrecruiters.com/Zoho' },
  { companyName: 'Postman', ats: 'lever', slug: 'postman', careerUrl: 'https://jobs.lever.co/postman' },
  { companyName: 'BrowserStack', ats: 'lever', slug: 'browserstack', careerUrl: 'https://jobs.lever.co/browserstack' },
  { companyName: 'CleverTap', ats: 'lever', slug: 'clevertap', careerUrl: 'https://jobs.lever.co/clevertap' },
  { companyName: 'MoEngage', ats: 'lever', slug: 'moengage', careerUrl: 'https://jobs.lever.co/moengage' },
  { companyName: 'Mixpanel', ats: 'greenhouse', slug: 'mixpanel', careerUrl: 'https://boards.greenhouse.io/mixpanel' },
  { companyName: 'Hasura', ats: 'lever', slug: 'hasura', careerUrl: 'https://jobs.lever.co/hasura' },
  { companyName: 'Wingify', ats: 'lever', slug: 'wingify', careerUrl: 'https://jobs.lever.co/wingify' },
  { companyName: 'Setu', ats: 'lever', slug: 'setu', careerUrl: 'https://jobs.lever.co/setu' },
  { companyName: 'Springworks', ats: 'lever', slug: 'springworks', careerUrl: 'https://jobs.lever.co/springworks' },
  { companyName: 'Haptik', ats: 'lever', slug: 'haptik', careerUrl: 'https://jobs.lever.co/haptik' },
  { companyName: 'Exotel', ats: 'lever', slug: 'exotel', careerUrl: 'https://jobs.lever.co/exotel' },
  { companyName: 'Darwinbox', ats: 'lever', slug: 'darwinbox', careerUrl: 'https://jobs.lever.co/darwinbox' },
  { companyName: 'Leadsquared', ats: 'lever', slug: 'leadsquared', careerUrl: 'https://jobs.lever.co/leadsquared' },
  { companyName: 'Zenduty', ats: 'lever', slug: 'zenduty', careerUrl: 'https://jobs.lever.co/zenduty' },
  { companyName: 'Sprinklr', ats: 'greenhouse', slug: 'sprinklr', careerUrl: 'https://boards.greenhouse.io/sprinklr' },
  // E-commerce / Consumer
  { companyName: 'Meesho', ats: 'lever', slug: 'meesho', careerUrl: 'https://jobs.lever.co/meesho' },
  { companyName: 'Nykaa', ats: 'lever', slug: 'nykaa', careerUrl: 'https://jobs.lever.co/nykaa' },
  { companyName: 'Urban Company', ats: 'lever', slug: 'urbancompany', careerUrl: 'https://jobs.lever.co/urbancompany' },
  { companyName: 'Dunzo', ats: 'lever', slug: 'dunzo', careerUrl: 'https://jobs.lever.co/dunzo' },
  { companyName: 'Swiggy', ats: 'lever', slug: 'swiggy', careerUrl: 'https://jobs.lever.co/swiggy' },
  { companyName: 'Zomato', ats: 'lever', slug: 'zomato', careerUrl: 'https://jobs.lever.co/zomato' },
  { companyName: 'Ola', ats: 'lever', slug: 'ola', careerUrl: 'https://jobs.lever.co/ola' },
  { companyName: 'Rapido', ats: 'lever', slug: 'rapido', careerUrl: 'https://jobs.lever.co/rapido' },
  { companyName: 'Porter', ats: 'lever', slug: 'porter', careerUrl: 'https://jobs.lever.co/porter' },
  // EdTech
  { companyName: 'Unacademy', ats: 'lever', slug: 'unacademy', careerUrl: 'https://jobs.lever.co/unacademy' },
  { companyName: 'upGrad', ats: 'lever', slug: 'upgrad', careerUrl: 'https://jobs.lever.co/upgrad' },
  { companyName: 'BYJU\'S', ats: 'lever', slug: 'byjus', careerUrl: 'https://jobs.lever.co/byjus' },
  { companyName: 'Scaler', ats: 'lever', slug: 'scaler', careerUrl: 'https://jobs.lever.co/scaler' },
  { companyName: 'InterviewBit', ats: 'lever', slug: 'interviewbit', careerUrl: 'https://jobs.lever.co/interviewbit' },
  // Infra / DevTools / AI
  { companyName: 'Sarvam AI', ats: 'ashby', slug: 'sarvam', careerUrl: 'https://jobs.ashbyhq.com/sarvam' },
  { companyName: 'Yellow.ai', ats: 'lever', slug: 'yellowmessenger', careerUrl: 'https://jobs.lever.co/yellowmessenger' },
  { companyName: 'Mad Street Den (Vue.ai)', ats: 'lever', slug: 'madstreetden', careerUrl: 'https://jobs.lever.co/madstreetden' },
  { companyName: 'Observe.AI', ats: 'lever', slug: 'observeai', careerUrl: 'https://jobs.lever.co/observeai' },
  { companyName: 'Turing', ats: 'lever', slug: 'turing', careerUrl: 'https://jobs.lever.co/turing' },
  { companyName: 'Locus', ats: 'lever', slug: 'locus', careerUrl: 'https://jobs.lever.co/locus' },
  { companyName: 'Appsmith', ats: 'lever', slug: 'appsmith', careerUrl: 'https://jobs.lever.co/appsmith' },
  { companyName: 'DhiWise', ats: 'lever', slug: 'dhiwise', careerUrl: 'https://jobs.lever.co/dhiwise' },
  { companyName: 'Ola Electric', ats: 'lever', slug: 'olaelectric', careerUrl: 'https://jobs.lever.co/olaelectric' },
  { companyName: 'Agnikul Cosmos', ats: 'lever', slug: 'agnikul', careerUrl: 'https://jobs.lever.co/agnikul' },
];

// ── Remote-friendly Global / Foreign Companies ───────────────
const GLOBAL_REMOTE_COMPANIES: SeedCompany[] = [
  // Developer Tools
  { companyName: 'Vercel', ats: 'lever', slug: 'vercel', careerUrl: 'https://jobs.lever.co/vercel' },
  { companyName: 'Linear', ats: 'ashby', slug: 'linear', careerUrl: 'https://jobs.ashbyhq.com/linear' },
  { companyName: 'Loom', ats: 'greenhouse', slug: 'loom', careerUrl: 'https://boards.greenhouse.io/loom' },
  { companyName: 'Retool', ats: 'greenhouse', slug: 'retool', careerUrl: 'https://boards.greenhouse.io/retool' },
  { companyName: 'Supabase', ats: 'ashby', slug: 'supabase', careerUrl: 'https://jobs.ashbyhq.com/supabase' },
  { companyName: 'PlanetScale', ats: 'lever', slug: 'planetscale', careerUrl: 'https://jobs.lever.co/planetscale' },
  { companyName: 'Neon', ats: 'ashby', slug: 'neon-inc', careerUrl: 'https://jobs.ashbyhq.com/neon-inc' },
  { companyName: 'Turso', ats: 'ashby', slug: 'turso', careerUrl: 'https://jobs.ashbyhq.com/turso' },
  { companyName: 'Railway', ats: 'ashby', slug: 'railway', careerUrl: 'https://jobs.ashbyhq.com/railway' },
  { companyName: 'Render', ats: 'lever', slug: 'render', careerUrl: 'https://jobs.lever.co/render' },
  { companyName: 'Fly.io', ats: 'lever', slug: 'fly', careerUrl: 'https://jobs.lever.co/fly' },
  { companyName: 'Gitpod', ats: 'greenhouse', slug: 'gitpod', careerUrl: 'https://boards.greenhouse.io/gitpod' },
  { companyName: 'Codeium', ats: 'ashby', slug: 'codeium', careerUrl: 'https://jobs.ashbyhq.com/codeium' },
  { companyName: 'Sourcegraph', ats: 'greenhouse', slug: 'sourcegraph', careerUrl: 'https://boards.greenhouse.io/sourcegraph' },
  { companyName: 'Temporal', ats: 'greenhouse', slug: 'temporal', careerUrl: 'https://boards.greenhouse.io/temporal' },
  { companyName: 'Dagger', ats: 'lever', slug: 'dagger', careerUrl: 'https://jobs.lever.co/dagger' },
  { companyName: 'Grafana Labs', ats: 'greenhouse', slug: 'grafanalabs', careerUrl: 'https://boards.greenhouse.io/grafanalabs' },
  { companyName: 'Airbyte', ats: 'greenhouse', slug: 'airbyte', careerUrl: 'https://boards.greenhouse.io/airbyte' },
  { companyName: 'dbt Labs', ats: 'greenhouse', slug: 'dbtlabs', careerUrl: 'https://boards.greenhouse.io/dbtlabs' },
  { companyName: 'Materialize', ats: 'lever', slug: 'materialize', careerUrl: 'https://jobs.lever.co/materialize' },
  // AI / ML
  { companyName: 'Cohere', ats: 'greenhouse', slug: 'cohere', careerUrl: 'https://boards.greenhouse.io/cohere' },
  { companyName: 'Mistral AI', ats: 'lever', slug: 'mistral', careerUrl: 'https://jobs.lever.co/mistral' },
  { companyName: 'Together AI', ats: 'ashby', slug: 'together-ai', careerUrl: 'https://jobs.ashbyhq.com/together-ai' },
  { companyName: 'Hugging Face', ats: 'lever', slug: 'huggingface', careerUrl: 'https://jobs.lever.co/huggingface' },
  { companyName: 'LangChain', ats: 'ashby', slug: 'langchain', careerUrl: 'https://jobs.ashbyhq.com/langchain' },
  { companyName: 'Weights & Biases', ats: 'lever', slug: 'wandb', careerUrl: 'https://jobs.lever.co/wandb' },
  { companyName: 'Replicate', ats: 'ashby', slug: 'replicate', careerUrl: 'https://jobs.ashbyhq.com/replicate' },
  { companyName: 'Scale AI', ats: 'greenhouse', slug: 'scaleai', careerUrl: 'https://boards.greenhouse.io/scaleai' },
  { companyName: 'Imbue', ats: 'lever', slug: 'imbue', careerUrl: 'https://jobs.lever.co/imbue' },
  { companyName: 'Perplexity AI', ats: 'lever', slug: 'perplexityai', careerUrl: 'https://jobs.lever.co/perplexityai' },
  // Remote-first SaaS
  { companyName: 'Basecamp', ats: 'lever', slug: 'basecamp', careerUrl: 'https://jobs.lever.co/basecamp' },
  { companyName: 'Buffer', ats: 'greenhouse', slug: 'buffer', careerUrl: 'https://boards.greenhouse.io/buffer' },
  { companyName: 'Automattic', ats: 'greenhouse', slug: 'automattic', careerUrl: 'https://boards.greenhouse.io/automattic' },
  { companyName: 'GitLab', ats: 'greenhouse', slug: 'gitlab', careerUrl: 'https://boards.greenhouse.io/gitlab' },
  { companyName: 'Doist', ats: 'lever', slug: 'doist', careerUrl: 'https://jobs.lever.co/doist' },
  { companyName: 'Remote', ats: 'greenhouse', slug: 'remote', careerUrl: 'https://boards.greenhouse.io/remote' },
  { companyName: 'Deel', ats: 'lever', slug: 'deel', careerUrl: 'https://jobs.lever.co/deel' },
  { companyName: 'Lemon.io', ats: 'lever', slug: 'lemon', careerUrl: 'https://jobs.lever.co/lemon' },
  { companyName: 'Toptal', ats: 'greenhouse', slug: 'toptal', careerUrl: 'https://boards.greenhouse.io/toptal' },
  { companyName: 'Invisible Technologies', ats: 'greenhouse', slug: 'invisibletechnologies', careerUrl: 'https://boards.greenhouse.io/invisibletechnologies' },
  { companyName: 'Contra', ats: 'ashby', slug: 'contra', careerUrl: 'https://jobs.ashbyhq.com/contra' },
];

// ── YC-backed Startups (hiring interns / entry-level) ────────
const YC_STARTUPS: SeedCompany[] = [
  { companyName: 'Pika', ats: 'ashby', slug: 'pika', careerUrl: 'https://jobs.ashbyhq.com/pika' },
  { companyName: 'Alchemy', ats: 'greenhouse', slug: 'alchemy', careerUrl: 'https://boards.greenhouse.io/alchemy' },
  { companyName: 'Resend', ats: 'ashby', slug: 'resend', careerUrl: 'https://jobs.ashbyhq.com/resend' },
  { companyName: 'Mintlify', ats: 'ashby', slug: 'mintlify', careerUrl: 'https://jobs.ashbyhq.com/mintlify' },
  { companyName: 'Cursor', ats: 'ashby', slug: 'anysphere', careerUrl: 'https://jobs.ashbyhq.com/anysphere' },
  { companyName: 'Notion', ats: 'greenhouse', slug: 'notion', careerUrl: 'https://boards.greenhouse.io/notion' },
  { companyName: 'Amplitude', ats: 'greenhouse', slug: 'amplitude', careerUrl: 'https://boards.greenhouse.io/amplitude' },
  { companyName: 'Brex', ats: 'greenhouse', slug: 'brex', careerUrl: 'https://boards.greenhouse.io/brex' },
  { companyName: 'Rippling', ats: 'greenhouse', slug: 'rippling', careerUrl: 'https://boards.greenhouse.io/rippling' },
  { companyName: 'Gusto', ats: 'greenhouse', slug: 'gusto', careerUrl: 'https://boards.greenhouse.io/gusto' },
  { companyName: 'Airtable', ats: 'greenhouse', slug: 'airtable', careerUrl: 'https://boards.greenhouse.io/airtable' },
  { companyName: 'Webflow', ats: 'greenhouse', slug: 'webflow', careerUrl: 'https://boards.greenhouse.io/webflow' },
  { companyName: 'Figma', ats: 'greenhouse', slug: 'figma', careerUrl: 'https://boards.greenhouse.io/figma' },
  { companyName: 'Lottiefiles', ats: 'lever', slug: 'lottiefiles', careerUrl: 'https://jobs.lever.co/lottiefiles' },
  { companyName: 'Cal.com', ats: 'lever', slug: 'cal', careerUrl: 'https://jobs.lever.co/cal' },
  { companyName: 'Lago', ats: 'lever', slug: 'lago', careerUrl: 'https://jobs.lever.co/lago' },
  { companyName: 'Clerk', ats: 'ashby', slug: 'clerk', careerUrl: 'https://jobs.ashbyhq.com/clerk' },
  { companyName: 'Inngest', ats: 'ashby', slug: 'inngest', careerUrl: 'https://jobs.ashbyhq.com/inngest' },
  { companyName: 'WorkOS', ats: 'ashby', slug: 'workos', careerUrl: 'https://jobs.ashbyhq.com/workos' },
  { companyName: 'Trigger.dev', ats: 'ashby', slug: 'trigger', careerUrl: 'https://jobs.ashbyhq.com/trigger' },
  { companyName: 'PostHog', ats: 'ashby', slug: 'posthog', careerUrl: 'https://jobs.ashbyhq.com/posthog' },
  { companyName: 'Plane', ats: 'ashby', slug: 'plane', careerUrl: 'https://jobs.ashbyhq.com/plane' },
  { companyName: 'Infisical', ats: 'ashby', slug: 'infisical', careerUrl: 'https://jobs.ashbyhq.com/infisical' },
  { companyName: 'Buildkite', ats: 'lever', slug: 'buildkite', careerUrl: 'https://jobs.lever.co/buildkite' },
  { companyName: 'Coherent', ats: 'greenhouse', slug: 'coherent', careerUrl: 'https://boards.greenhouse.io/coherent' },
  { companyName: 'Captions', ats: 'lever', slug: 'captions', careerUrl: 'https://jobs.lever.co/captions' },
  { companyName: 'Replit', ats: 'lever', slug: 'replit', careerUrl: 'https://jobs.lever.co/replit' },
  { companyName: 'Codeforces (parent: CF Edu)', ats: 'lever', slug: 'codeforces', careerUrl: 'https://jobs.lever.co/codeforces' },
  { companyName: 'Ashby', ats: 'ashby', slug: 'ashby', careerUrl: 'https://jobs.ashbyhq.com/ashby' },
  { companyName: 'Deel', ats: 'lever', slug: 'deel', careerUrl: 'https://jobs.lever.co/deel' },
  { companyName: 'Prisma', ats: 'lever', slug: 'prisma', careerUrl: 'https://jobs.lever.co/prisma' },
  { companyName: 'Sanity', ats: 'lever', slug: 'sanity-io', careerUrl: 'https://jobs.lever.co/sanity-io' },
  { companyName: 'Stytch', ats: 'lever', slug: 'stytch', careerUrl: 'https://jobs.lever.co/stytch' },
  { companyName: 'Boundary', ats: 'greenhouse', slug: 'boundary', careerUrl: 'https://boards.greenhouse.io/boundary' },
  { companyName: 'Merge', ats: 'lever', slug: 'merge-api', careerUrl: 'https://jobs.lever.co/merge-api' },
  { companyName: 'Propel Auth', ats: 'ashby', slug: 'propelauth', careerUrl: 'https://jobs.ashbyhq.com/propelauth' },
];

/**
 * All curated tech company seeds.
 * Company IDs are assigned negative values starting at -1 to avoid
 * colliding with real OpenJobData company IDs.
 */
export const ALL_SEEDS: SeedCompany[] = [
  ...INDIAN_COMPANIES,
  ...GLOBAL_REMOTE_COMPANIES,
  ...YC_STARTUPS,
];

/**
 * Convert seeds to watchlist-ready entries with synthetic negative IDs.
 * Deduplication is by (ats, slug) — if the parquet-generated watchlist
 * already has the same slug, the seed is skipped (INSERT OR IGNORE).
 */
export function getSeedWatchlistEntries() {
  // Use a Map to deduplicate by ats+slug (in case of duplicates in seed list)
  const seen = new Map<string, true>();
  const entries: Array<{
    companyId: number;
    companyName: string;
    ats: string;
    slug: string;
    careerUrl: string;
    source: 'auto' | 'promoted';
  }> = [];

  let idCounter = -1;
  for (const seed of ALL_SEEDS) {
    const key = `${seed.ats}:${seed.slug}`;
    if (seen.has(key)) continue;
    seen.set(key, true);

    entries.push({
      companyId: idCounter--,
      companyName: seed.companyName,
      ats: seed.ats,
      slug: seed.slug,
      careerUrl: seed.careerUrl,
      source: 'auto',
    });
  }

  return entries;
}

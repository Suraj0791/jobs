// ============================================================
// Universal LLM Scorer — AI-powered job matching with Automatic Fallback
// + Circuit Breaker: dead providers are skipped for the rest of the run
// + Time Budget: scoring stops after 45 minutes so notify/commit always run
// ============================================================

import OpenAI from 'openai';
import type { Job, GeminiScoreResult as LlmScoreResult, ScoredJob } from '../models/job.js';
import { RESUME_TEXT } from '../config/resume.js';
import { USER_PROFILE } from '../config/profile.js';
import { CONFIG } from '../config/constants.js';

/** How long scoring is allowed to run before we bail out (ms). */
const SCORING_BUDGET_MS = 45 * 60 * 1000; // 45 minutes

/**
 * Per-provider circuit breaker state.
 * A provider is marked "dead" after 2 consecutive failures in this run.
 * It is NEVER retried for the rest of the run — we skip it in 0 ms.
 */
const providerFailures = new Map<string, number>(); // name → consecutive failures
const DEAD_THRESHOLD = 2; // mark dead after this many consecutive failures

function isProviderDead(name: string): boolean {
  return (providerFailures.get(name) ?? 0) >= DEAD_THRESHOLD;
}

function recordFailure(name: string): void {
  providerFailures.set(name, (providerFailures.get(name) ?? 0) + 1);
}

function recordSuccess(name: string): void {
  providerFailures.set(name, 0); // reset on success
}

/**
 * Build the scoring prompt for a single job.
 */
function buildPrompt(job: Job): string {
  const profileSummary = `
TARGET CANDIDATE PROFILE:
- Name: ${USER_PROFILE.name}
- Status: ${USER_PROFILE.currentStatus}, graduating ${USER_PROFILE.graduationDate}
- Education: ${USER_PROFILE.education.degree} from ${USER_PROFILE.education.institution} (CGPA: ${USER_PROFILE.education.cgpa})
- Experience: ${USER_PROFILE.experienceSummary.join('; ')}
- Tech Stack: ${USER_PROFILE.techStack.join(', ')}
- Target Salary: ${USER_PROFILE.salaryRange}
- Looking for: Internship, Entry-level, Fresher, New Grad roles
- Preferred: ${USER_PROFILE.preferredCompanies.join(', ')}
`.trim();

  const jobDetails = `
JOB DETAILS:
- Company: ${job.company || 'Unknown'}
- Title: ${job.title}
- Location: ${job.location}
- Remote: ${job.remote ? 'Yes' : 'No'}
- Type: ${job.employmentType || 'Not specified'}
- Workplace: ${job.workplaceType || 'Not specified'}
- Department: ${job.department || 'Not specified'}
- Posted: ${job.postedAt || 'Unknown'}
- ATS: ${job.ats}
${job.description ? `\nJOB DESCRIPTION:\n${job.description.slice(0, 3000)}` : '(No description available — score based on title, company, and location only)'}
`.trim();

  return `You are a job matching assistant for a final-year computer science student in India.

Score how well this job matches the candidate. Consider:
1. Does the role match their skills (React, Node.js, Next.js, TypeScript, PostgreSQL)?
2. Is the seniority level appropriate (intern/entry-level/fresher/new grad)?
3. Is the location suitable (India onsite/hybrid, or remote worldwide)?
4. Is this a good company type (product/SaaS/startup/tech)?
5. Would this be a realistic application given their experience?

IMPORTANT: The candidate is a final year B.Tech student graduating May 2027 with internship experience.
CRITICAL INSTRUCTION ON TECH STACK: For Entry-Level and Internship Software Engineering / SDE roles, companies often hire language-agnostically and focus on Data Structures and Algorithms (DSA) or general problem-solving. DO NOT penalize the score if the job requires a different backend language (e.g., Java, Go, C#) AS LONG AS it is an intern, fresher, or entry-level software engineering role.

- Score 9-10: Perfect match — right level, right location, right company type. Tech stack is either a perfect match, OR it's a general entry-level/intern SDE role where language doesn't strictly matter.
- Score 7-8: Good match — mostly aligned, maybe slightly above level, or specific stack requirements that might be a slight hurdle but still worth applying.
- Score 5-6: Partial match — right field but clearly requires senior experience, or strictly requires a deeply specialized skill (e.g., specific machine learning framework) the candidate lacks.
- Score 0-4: Poor match — completely unrelated field (e.g., HR, Sales, Basketball, Editing, Production), far too senior, or wrong location. CRITICAL: If the job is NOT a software engineering, developer, or IT role, you MUST score it below 4, even if it is an internship.

CANDIDATE RESUME:
${RESUME_TEXT}

${profileSummary}

${jobDetails}

Respond with ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "score": <number 0-10, one decimal>,
  "apply": <boolean>,
  "reason": "<1-2 sentence match explanation>",
  "missing_skills": ["<skill1>", "<skill2>"],
  "resume_suggestions": "<brief advice to tailor resume for this role>",
  "linkedin_message": "<short referral message template, 2-3 sentences>",
  "interview_topics": ["<topic1>", "<topic2>", "<topic3>"]
}`;
}

/**
 * Score a single job using the given LLM provider.
 * Uses the universal OpenAI SDK format.
 */
async function scoreJobWithProvider(
  job: Job,
  provider: { name: string; baseUrl: string; apiKey: string; model: string; delayMs: number }
): Promise<LlmScoreResult> {
  const client = new OpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    defaultHeaders: { 'Connection': 'close' }, // Fixes "Premature close" fetch bug in Node 22
  });

  const prompt = buildPrompt(job);

  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Empty LLM response');
  }

  // Fallback cleanup if provider ignores json_object format
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    apply: parsed.apply === true,
    reason: parsed.reason || '',
    missingSkills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills : [],
    resumeSuggestions: parsed.resume_suggestions || '',
    linkedinMessage: parsed.linkedin_message || '',
    interviewTopics: Array.isArray(parsed.interview_topics) ? parsed.interview_topics : [],
  };
}

/**
 * Score a single job with Automatic Fallback + Circuit Breaker.
 *
 * - Providers marked dead (≥2 consecutive failures this run) are skipped instantly.
 * - Any failure (429, 400, 5xx, etc.) increments the failure counter.
 * - A success resets the counter for that provider.
 *
 * @returns { result, delayMs } on success, null if all providers are dead/failed.
 */
async function scoreJob(job: Job): Promise<{ result: LlmScoreResult; delayMs: number } | null> {
  const providers = CONFIG.llmProviders;

  if (providers.length === 0) {
    console.log(`    ⚠ No API keys provided in environment (need GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY)`);
    return null;
  }

  for (const provider of providers) {
    // ── Circuit breaker: skip dead providers immediately ──
    if (isProviderDead(provider.name)) {
      console.log(`    ⚡ ${provider.name} is circuit-broken — skipping`);
      continue;
    }

    try {
      const result = await scoreJobWithProvider(job, provider);
      recordSuccess(provider.name);
      return { result, delayMs: provider.delayMs };
    } catch (error) {
      const err = error as Error;

      // Classify the error for logging
      const isRateLimit = err.message?.includes('429') || err.message?.includes('RATE_LIMIT') || err.message?.includes('rate_limit');
      const label = isRateLimit ? '⚠ Rate limit hit' : `⚠ Error`;

      console.log(`    ${label} on ${provider.name}. Falling back...`);

      // Record failure — after DEAD_THRESHOLD consecutive failures, provider is dead for this run
      recordFailure(provider.name);
      if (isProviderDead(provider.name)) {
        console.log(`    🔴 ${provider.name} is now circuit-broken for the rest of this run`);
      }

      continue; // Try next provider
    }
  }

  // All providers tried (or dead)
  const allDead = providers.every(p => isProviderDead(p.name));
  if (allDead) {
    console.log(`    💀 All providers are circuit-broken. Stopping scoring early.`);
    return null;
  }

  console.log(`    ❌ All available LLM providers failed for "${job.title}". Giving up.`);
  return null;
}

/**
 * Score a batch of jobs with Automatic Fallback + Circuit Breaker + Time Budget.
 *
 * Returns only the jobs that were actually scored.
 * Jobs skipped due to dead providers or the time budget are NOT included —
 * callers should NOT mark them as "seen" so they get retried next run.
 */
export async function scoreJobs(jobs: Job[]): Promise<ScoredJob[]> {
  if (jobs.length === 0) return [];

  const maxCalls = CONFIG.maxLlmCallsPerRun;
  const jobsToScore = jobs.slice(0, maxCalls);

  if (jobs.length > maxCalls) {
    console.log(`  ⚠ Capping LLM calls: ${jobs.length} jobs → scoring top ${maxCalls}`);
  }

  const providers = CONFIG.llmProviders;
  if (providers.length > 0) {
    console.log(`  🤖 Scoring ${jobsToScore.length} jobs using universal fallback:`);
    providers.forEach((p, i) => console.log(`     #${i + 1} - ${p.name} (${p.model})`));
  } else {
    console.log(`  🤖 No LLM Providers configured!`);
    return [];
  }

  const results: ScoredJob[] = [];
  let scored = 0;
  let failed = 0;
  let skippedBudget = 0;

  const budgetDeadline = Date.now() + SCORING_BUDGET_MS;

  for (const job of jobsToScore) {
    // ── Time budget guard ──
    if (Date.now() >= budgetDeadline) {
      skippedBudget = jobsToScore.length - scored;
      console.log(`  ⏱ Time budget exhausted — skipping remaining ${skippedBudget} jobs (they'll retry next run)`);
      break;
    }

    // ── All providers dead guard ──
    const liveProviders = providers.filter(p => !isProviderDead(p.name));
    if (liveProviders.length === 0) {
      skippedBudget = jobsToScore.length - scored;
      console.log(`  💀 All providers circuit-broken — skipping remaining ${skippedBudget} jobs (they'll retry next run)`);
      break;
    }

    scored++;
    const progress = `[${scored}/${jobsToScore.length}]`;
    console.log(`  ${progress} Scoring: "${job.title}" at ${job.company || 'Unknown'}`);

    const res = await scoreJob(job);

    if (res && res.result) {
      results.push({ job, score: res.result });
      console.log(`    → Score: ${res.result.score} ${res.result.apply ? '✅' : '❌'} — ${res.result.reason.slice(0, 80)}`);

      // Wait based on the successful provider's preferred delay
      if (scored < jobsToScore.length) {
        await sleep(res.delayMs);
      }
    } else {
      failed++;
      // If all providers failed, we still wait a tiny bit to avoid hammering APIs
      if (scored < jobsToScore.length) {
        await sleep(2000);
      }
    }
  }

  const timeLeft = Math.round((budgetDeadline - Date.now()) / 1000);
  console.log(`  ✓ LLM scoring complete: ${results.length} scored, ${failed} failed, ${skippedBudget} skipped (${timeLeft}s budget remaining)`);

  return results;
}

/**
 * Filter scored jobs by the configured threshold.
 */
export function filterByThreshold(scoredJobs: ScoredJob[]): ScoredJob[] {
  const threshold = CONFIG.scoreThreshold;
  const passing = scoredJobs.filter(sj => sj.score.score >= threshold);
  console.log(`  📊 Threshold ${threshold}: ${passing.length}/${scoredJobs.length} jobs passed`);
  return passing;
}

/** Simple sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

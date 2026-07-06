// ============================================================
// Universal LLM Scorer — Robust, battle-hardened job scoring
//
// Failure modes handled:
//   1. 429 Rate-limit   → 65 s per-provider cooldown (not a circuit-break)
//   2. LLM hang/timeout → 45 s hard timeout via OpenAI SDK `timeout` param
//   3. Hard errors      → 5xx / auth / parse / network → circuit-break after 3
//   4. All blocked      → wait for soonest cooldown to expire, retry once
//   5. Time budget      → bail after 45 min so notify/commit always run
// ============================================================

import OpenAI from 'openai';
import type { Job, GeminiScoreResult as LlmScoreResult, ScoredJob } from '../models/job.js';
import { RESUME_TEXT } from '../config/resume.js';
import { USER_PROFILE } from '../config/profile.js';
import { CONFIG } from '../config/constants.js';

// ── Tunables ──────────────────────────────────────────────────────────────────

/** Max wall-clock time for the entire scoring loop (ms). */
const SCORING_BUDGET_MS = 45 * 60 * 1000; // 45 min

/**
 * Hard timeout for a single LLM API call (ms).
 * Passed directly to the OpenAI SDK — kills hung requests at the HTTP level.
 */
const CALL_TIMEOUT_MS = 45_000; // 45 s

/** Cooldown after a 429 — Groq resets TPM every 60 s, +5 s buffer. */
const RATE_LIMIT_COOLDOWN_MS = 65_000; // 65 s

/** Provider dies after this many consecutive *hard* errors (not rate limits). */
const DEAD_THRESHOLD = 3;

// ── Rate-limit cooldown state ─────────────────────────────────────────────────

const rateLimitCooldownUntil = new Map<string, number>(); // name → epoch ms

function isRateLimited(name: string): boolean {
  return Date.now() < (rateLimitCooldownUntil.get(name) ?? 0);
}

function rateLimitResumeIn(name: string): number {
  return Math.max(0, Math.ceil(((rateLimitCooldownUntil.get(name) ?? 0) - Date.now()) / 1000));
}

function recordRateLimit(name: string): void {
  const until = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  rateLimitCooldownUntil.set(name, until);
  console.log(`    🕐 ${name} rate-limited — cooling down ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s (until ${new Date(until).toISOString()})`);
}

// ── Hard-error circuit breaker ────────────────────────────────────────────────

const hardFailures = new Map<string, number>(); // name → consecutive count

function isProviderDead(name: string): boolean {
  return (hardFailures.get(name) ?? 0) >= DEAD_THRESHOLD;
}

function recordHardFailure(name: string, reason: string): void {
  const count = (hardFailures.get(name) ?? 0) + 1;
  hardFailures.set(name, count);
  if (count >= DEAD_THRESHOLD) {
    console.log(`    🔴 ${name} circuit-broken (${count} hard errors): ${reason}`);
  } else {
    console.log(`    ⚠ ${name} hard error ${count}/${DEAD_THRESHOLD} (${reason}) — falling back`);
  }
}

function recordSuccess(name: string): void {
  hardFailures.set(name, 0);
  // Rate-limit cooldown expires naturally — don't clear it on success.
}

// ── Error classifier ──────────────────────────────────────────────────────────

type ErrorKind = 'rate_limit' | 'timeout' | 'hard_error';

function classifyError(err: Error): ErrorKind {
  const msg = (err.message ?? '').toLowerCase();
  const name = (err.name ?? '').toLowerCase();
  const ctor = (err.constructor?.name ?? '').toLowerCase();

  if (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('ratelimit') ||
    ctor === 'ratelimiterror'
  ) return 'rate_limit';

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('time out') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('aborted') ||
    name === 'aborterror' ||
    ctor === 'aborterror'
  ) return 'timeout';

  return 'hard_error';
}

// ── Prompt builder ────────────────────────────────────────────────────────────

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
${job.description ? `\nJOB DESCRIPTION:\n${job.description.slice(0, 3000)}` : '(No description — score based on title, company, and location only)'}
`.trim();

  return `You are a job matching assistant for a final-year computer science student in India.

Score how well this job matches the candidate. Consider:
1. Does the role match their skills (React, Node.js, Next.js, TypeScript, PostgreSQL)?
2. Is the seniority level appropriate (intern/entry-level/fresher/new grad)?
3. Is the location suitable (India onsite/hybrid, or remote worldwide)?
4. Is this a good company type (product/SaaS/startup/tech)?
5. Would this be a realistic application given their experience?

IMPORTANT: The candidate is a final year B.Tech student graduating May 2027 with internship experience.
CRITICAL INSTRUCTION ON TECH STACK: For Entry-Level and Internship Software Engineering / SDE roles, companies often hire language-agnostically and focus on DSA / general problem-solving. DO NOT penalize if the job requires a different backend language (Java, Go, C#) AS LONG AS it is an intern, fresher, or entry-level SDE role.

- Score 9-10: Perfect match — right level, right location, right company type.
- Score 7-8: Good match — mostly aligned, minor hurdles.
- Score 5-6: Partial match — right field but clearly requires senior experience.
- Score 0-4: Poor match — unrelated field, far too senior, or wrong location. If NOT a software/developer/IT role, MUST score below 4.

CANDIDATE RESUME:
${RESUME_TEXT}

${profileSummary}

${jobDetails}

Respond with ONLY valid JSON (no markdown, no backticks):
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

// ── Single provider call ──────────────────────────────────────────────────────

async function scoreJobWithProvider(
  job: Job,
  provider: { name: string; baseUrl: string; apiKey: string; model: string; delayMs: number }
): Promise<LlmScoreResult> {
  // timeout is a first-class OpenAI SDK option — kills hung HTTP requests cleanly.
  const client = new OpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    timeout: CALL_TIMEOUT_MS,
    defaultHeaders: { 'Connection': 'close' }, // Fixes "Premature close" in Node 22+
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
  if (!text) throw new Error('Empty LLM response');

  // Strip accidental markdown fences some providers add despite response_format
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned); // throws SyntaxError → caught as hard_error upstream

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

// ── Provider status helpers ───────────────────────────────────────────────────

type Provider = { name: string; baseUrl: string; apiKey: string; model: string; delayMs: number };

/** Returns a snapshot of each provider's current state. */
function describeProviders(providers: Provider[]): string {
  return providers.map(p => {
    if (isProviderDead(p.name)) return `${p.name}:dead`;
    if (isRateLimited(p.name)) return `${p.name}:rl(${rateLimitResumeIn(p.name)}s)`;
    return `${p.name}:ok`;
  }).join(' | ');
}

// ── Per-job scoring with full fallback ────────────────────────────────────────

/**
 * Score one job. Tries every provider in order. Handles:
 *  - Dead providers   → skip immediately
 *  - Rate-limited     → skip (they'll recover in <65s)
 *  - 429 during call  → mark rate-limited, try next
 *  - Timeout          → count as hard error, try next
 *  - Hard error       → count toward circuit-break, try next
 *  - All rate-limited → wait for soonest cooldown, retry once
 *  - All dead         → return null (stops the batch loop)
 *
 * @returns scored result, or null if every provider is dead/exhausted.
 */
async function scoreJob(job: Job): Promise<{ result: LlmScoreResult; delayMs: number } | null> {
  const providers = CONFIG.llmProviders;

  if (providers.length === 0) {
    console.log('    ⚠ No API keys configured');
    return null;
  }

  /**
   * Inner helper: attempt each provider once.
   * Returns:
   *   { result, delayMs }  — success
   *   'all_dead'           — every provider is hard-dead, abort the run
   *   'all_rate_limited'   — every live provider is in cooldown, caller should wait
   *   null                 — tried at least one, all failed with hard errors
   */
  async function attempt(): Promise<{ result: LlmScoreResult; delayMs: number } | 'all_dead' | 'all_rate_limited' | null> {
    // Snapshot states before looping so we make a consistent decision.
    const dead = providers.filter(p => isProviderDead(p.name));
    const limited = providers.filter(p => !isProviderDead(p.name) && isRateLimited(p.name));
    const available = providers.filter(p => !isProviderDead(p.name) && !isRateLimited(p.name));

    if (dead.length === providers.length) return 'all_dead';
    if (available.length === 0) return 'all_rate_limited'; // only dead + rate-limited remain

    // Try each available provider
    for (const provider of available) {
      try {
        const result = await scoreJobWithProvider(job, provider);
        recordSuccess(provider.name);
        return { result, delayMs: provider.delayMs };
      } catch (error) {
        const err = error as Error;
        const kind = classifyError(err);
        const shortMsg = err.message?.slice(0, 120) ?? 'unknown';

        if (kind === 'rate_limit') {
          console.log(`    ⚠ Rate limit on ${provider.name} — falling back`);
          recordRateLimit(provider.name);
        } else if (kind === 'timeout') {
          console.log(`    ⚠ Timeout on ${provider.name} (>${CALL_TIMEOUT_MS / 1000}s) — falling back`);
          recordHardFailure(provider.name, 'timeout');
        } else {
          console.log(`    ⚠ Error on ${provider.name}: ${shortMsg} — falling back`);
          recordHardFailure(provider.name, shortMsg);
        }
      }
    }

    // All available providers were tried and all failed.
    // Check again: are all survivors now rate-limited (429 during this loop)?
    const stillLive = providers.filter(p => !isProviderDead(p.name));
    if (stillLive.length > 0 && stillLive.every(p => isRateLimited(p.name))) {
      return 'all_rate_limited';
    }

    return null; // genuine failure — all tried, all hard errors
  }

  // ── First attempt ──
  const first = await attempt();

  if (first === 'all_dead') {
    // Caller (scoreJobs) will detect this and stop the loop
    console.log(`    💀 All providers are circuit-broken`);
    return null;
  }

  if (first !== null && first !== 'all_rate_limited') {
    return first; // success
  }

  // ── first === null (all tried, all hard-failed) — skip this job ──
  if (first === null) {
    console.log(`    ❌ All providers failed for "${job.title}" — skipping`);
    return null;
  }

  // ── first === 'all_rate_limited' — wait for earliest cooldown, then retry ──
  const soonestMs = providers
    .filter(p => !isProviderDead(p.name))
    .map(p => rateLimitCooldownUntil.get(p.name) ?? 0)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (!isFinite(soonestMs)) {
    // Shouldn't happen but guard anyway
    console.log(`    ❌ All providers rate-limited but no cooldown timestamp found — skipping`);
    return null;
  }

  const waitMs = Math.max(0, soonestMs - Date.now()) + 2000; // +2 s buffer
  console.log(`    ⏳ All providers rate-limited — waiting ${Math.ceil(waitMs / 1000)}s then retrying (${describeProviders(providers)})`);
  await sleep(waitMs);

  // ── Retry after wait ──
  const second = await attempt();

  if (second === 'all_dead') {
    console.log(`    💀 All providers circuit-broken after wait`);
    return null;
  }
  if (second === 'all_rate_limited' || second === null) {
    console.log(`    ❌ Retry after wait also failed for "${job.title}" — skipping`);
    return null;
  }
  return second;
}

// ── Batch scoring (public API) ────────────────────────────────────────────────

/**
 * Score a batch of jobs.
 *
 * - Scored jobs are returned (and should be marked seen by the caller).
 * - Skipped/failed jobs are NOT returned — caller must NOT mark them seen
 *   so they are retried automatically next run.
 */
export async function scoreJobs(jobs: Job[]): Promise<ScoredJob[]> {
  if (jobs.length === 0) return [];

  const maxCalls = CONFIG.maxLlmCallsPerRun;
  const jobsToScore = jobs.slice(0, maxCalls);

  if (jobs.length > maxCalls) {
    console.log(`  ⚠ Capping LLM calls: ${jobs.length} jobs → scoring top ${maxCalls}`);
  }

  const providers = CONFIG.llmProviders;
  if (providers.length === 0) {
    console.log('  🤖 No LLM providers configured — skipping scoring');
    return [];
  }

  console.log(`  🤖 Scoring ${jobsToScore.length} jobs (call timeout: ${CALL_TIMEOUT_MS / 1000}s):`);
  providers.forEach((p, i) => console.log(`     #${i + 1} - ${p.name} (${p.model})`));

  const results: ScoredJob[] = [];
  let attempted = 0;
  let failed = 0;
  let skipped = 0;

  const budgetDeadline = Date.now() + SCORING_BUDGET_MS;

  for (let i = 0; i < jobsToScore.length; i++) {
    const job = jobsToScore[i];
    const remaining = jobsToScore.length - i;

    // ── Time budget guard ──
    if (Date.now() >= budgetDeadline) {
      skipped = remaining;
      console.log(`  ⏱ Time budget exhausted — skipping ${skipped} remaining jobs (retry next run)`);
      break;
    }

    // ── All providers permanently dead guard ──
    if (providers.every(p => isProviderDead(p.name))) {
      skipped = remaining;
      console.log(`  💀 All providers circuit-broken — skipping ${skipped} remaining jobs (retry next run)`);
      break;
    }

    attempted++;
    console.log(`  [${attempted}/${jobsToScore.length}] Scoring: "${job.title}" at ${job.company || 'Unknown'}`);

    const res = await scoreJob(job);

    if (res) {
      results.push({ job, score: res.result });
      const mark = res.result.apply ? '✅' : '❌';
      console.log(`    → Score: ${res.result.score} ${mark} — ${res.result.reason.slice(0, 80)}`);

      // Wait between jobs to respect provider rate limits
      const isLast = i === jobsToScore.length - 1;
      if (!isLast) {
        await sleep(res.delayMs);
      }
    } else {
      failed++;
      // Brief pause before the next job even on total failure, avoid hammering
      const isLast = i === jobsToScore.length - 1;
      if (!isLast) {
        await sleep(2000);
      }
    }
  }

  const timeLeft = Math.round((budgetDeadline - Date.now()) / 1000);
  console.log(`  ✓ Scoring done: ${results.length} scored, ${failed} failed, ${skipped} skipped (${timeLeft}s budget left)`);

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

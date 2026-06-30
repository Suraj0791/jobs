// ============================================================
// Universal LLM Scorer — AI-powered job matching with Automatic Fallback
// ============================================================

import OpenAI from 'openai';
import type { Job, GeminiScoreResult as LlmScoreResult, ScoredJob } from '../models/job.js';
import { RESUME_TEXT } from '../config/resume.js';
import { USER_PROFILE } from '../config/profile.js';
import { CONFIG } from '../config/constants.js';

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
- Score 0-4: Poor match — wrong field (e.g., HR, Sales), far too senior, wrong location, or completely unrelated.

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
 * Score a single job with Automatic Fallback.
 * Tries providers in order until one succeeds or all fail.
 */
async function scoreJob(job: Job): Promise<{ result: LlmScoreResult; delayMs: number } | null> {
  const providers = CONFIG.llmProviders;
  
  if (providers.length === 0) {
    console.log(`    ⚠ No API keys provided in environment (need GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY)`);
    return null;
  }

  for (const provider of providers) {
    try {
      const result = await scoreJobWithProvider(job, provider);
      return { result, delayMs: provider.delayMs };
    } catch (error) {
      const err = error as Error;
      
      // If it's a 429 Rate Limit, we instantly fallback to the next provider
      if (err.message?.includes('429') || err.message?.includes('RATE_LIMIT')) {
        console.log(`    ⚠ Rate limit hit on ${provider.name}. Falling back...`);
        continue; // Try next provider
      }
      
      console.log(`    ⚠ ${provider.name} error for "${job.title}": ${err.message}`);
      // On other errors (e.g. 500), we also try the next provider
      continue;
    }
  }

  console.log(`    ❌ All available LLM providers failed for "${job.title}". Giving up.`);
  return null;
}

/**
 * Score a batch of jobs with Automatic Fallback.
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

  for (const job of jobsToScore) {
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

  console.log(`  ✓ LLM scoring complete: ${results.length} scored, ${failed} failed`);

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

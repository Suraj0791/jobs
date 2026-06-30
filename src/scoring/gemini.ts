// ============================================================
// Gemini Scorer — AI-powered job matching
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type { Job, GeminiScoreResult, ScoredJob } from '../models/job.js';
import { RESUME_TEXT } from '../config/resume.js';
import { USER_PROFILE } from '../config/profile.js';
import { CONFIG } from '../config/constants.js';

let genai: GoogleGenAI | null = null;

/**
 * Initialize the Gemini client lazily.
 */
function getClient(): GoogleGenAI {
  if (!genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    genai = new GoogleGenAI({ apiKey });
  }
  return genai;
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
 * Score a single job with Gemini.
 * Returns null if the API call fails (doesn't throw).
 */
async function scoreJob(job: Job, retries = 1): Promise<GeminiScoreResult | null> {
  const client = getClient();
  const prompt = buildPrompt(job);

  try {
    const response = await client.models.generateContent({
      model: CONFIG.geminiModel,
      contents: prompt,
      config: {
        temperature: 0.3, // Low temperature for consistent scoring
        maxOutputTokens: 500,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      console.log(`    ⚠ Empty Gemini response for "${job.title}"`);
      return null;
    }

    // Clean response: remove markdown code blocks if present
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
  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('429') || err.message?.includes('RATE_LIMIT')) {
      if (retries > 0) {
        console.log(`    ⏳ Rate limited by Gemini, waiting 30s...`);
        await sleep(30000);
        return scoreJob(job, retries - 1);
      }
      console.log(`    ⚠ Gemini rate limit exceeded for "${job.title}", giving up.`);
      return null;
    }
    console.log(`    ⚠ Gemini error for "${job.title}": ${err.message}`);
    return null;
  }
}

/**
 * Score a batch of jobs with Gemini.
 * Respects rate limits (6s between calls, daily cap).
 * 
 * @param jobs - Jobs to score
 * @returns ScoredJob[] with results (only successful scores)
 */
export async function scoreJobs(jobs: Job[]): Promise<ScoredJob[]> {
  if (jobs.length === 0) return [];

  const maxCalls = CONFIG.maxGeminiCallsPerRun;
  const jobsToScore = jobs.slice(0, maxCalls);

  if (jobs.length > maxCalls) {
    console.log(`  ⚠ Capping Gemini calls: ${jobs.length} jobs → scoring top ${maxCalls}`);
  }

  console.log(`  🤖 Scoring ${jobsToScore.length} jobs with Gemini ${CONFIG.geminiModel}...`);

  const results: ScoredJob[] = [];
  let scored = 0;
  let failed = 0;

  for (const job of jobsToScore) {
    scored++;
    const progress = `[${scored}/${jobsToScore.length}]`;
    console.log(`  ${progress} Scoring: "${job.title}" at ${job.company || 'Unknown'}`);

    const result = await scoreJob(job);

    if (result) {
      results.push({ job, score: result });
      console.log(`    → Score: ${result.score} ${result.apply ? '✅' : '❌'} — ${result.reason.slice(0, 80)}`);
    } else {
      failed++;
    }

    // Rate limit: wait between calls (unless it's the last one)
    if (scored < jobsToScore.length) {
      await sleep(CONFIG.geminiDelayMs);
    }
  }

  console.log(`  ✓ Gemini scoring complete: ${results.length} scored, ${failed} failed`);

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

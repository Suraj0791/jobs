// ============================================================
// Deduplicator — prevent duplicate notifications
// ============================================================

import { createHash } from 'node:crypto';
import type { Job } from '../models/job.js';
import { SeenJobsStore } from '../db/store.js';

/**
 * Generate a unique key for deduplication.
 * 
 * Strategy:
 * 1. Primary: company_id + job_id (works across OpenJobData and ATS sources)
 * 2. Fallback: SHA-256 hash of apply_url (for edge cases)
 * 
 * This ensures the same job posted on both OpenJobData and Greenhouse
 * only triggers ONE notification.
 */
export function getJobKey(job: Job): string {
  // Primary: structured key from company + job IDs
  if (job.companyId > 0 && job.jobId) {
    return `${job.companyId}_${job.jobId}`;
  }

  // Fallback: if we have an ATS slug-based ID
  if (job.id && job.id !== 'unknown/') {
    return job.id;
  }

  // Last resort: hash the apply URL
  if (job.applyUrl) {
    return hashString(job.applyUrl);
  }

  // Should never happen, but be safe
  return hashString(`${job.title}_${job.company}_${job.postedAt}`);
}

/**
 * Filter out jobs we've already seen/notified about.
 * 
 * @param jobs - Incoming jobs to check
 * @param store - SeenJobsStore instance
 * @returns Jobs that haven't been seen before
 */
export function filterUnseen(jobs: Job[], store: SeenJobsStore): Job[] {
  const unseen: Job[] = [];
  let dupes = 0;

  for (const job of jobs) {
    const key = getJobKey(job);
    if (store.isJobSeen(key)) {
      dupes++;
    } else {
      unseen.push(job);
    }
  }

  if (dupes > 0) {
    console.log(`  🔄 Dedup: ${dupes} already seen, ${unseen.length} new`);
  }

  return unseen;
}

/**
 * Mark jobs as seen in the database.
 * Call this AFTER scoring and notification.
 */
export function markSeen(
  jobs: Job[],
  store: SeenJobsStore,
  scores?: Map<string, { score: number; notified: boolean }>
): void {
  const entries = jobs.map(job => {
    const key = getJobKey(job);
    const scoreInfo = scores?.get(key);
    return {
      jobKey: key,
      source: job.source,
      company: job.company,
      title: job.title,
      score: scoreInfo?.score ?? undefined,
      notified: scoreInfo?.notified ?? false,
    };
  });

  store.markJobsSeen(entries);
}

/**
 * SHA-256 hash a string (returns first 16 hex chars for compactness).
 */
function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ============================================================
// Telegram Notifier — send job alerts and summaries
// ============================================================

import type { ScoredJob, RunStats } from '../models/job.js';
import { CONFIG } from '../config/constants.js';

/**
 * Send a single message via Telegram Bot API.
 * Uses HTML parse_mode for reliable formatting (avoids MarkdownV2 escaping hell).
 */
async function sendMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('  ⚠ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping notification');
    return false;
  }

  if (CONFIG.dryRun) {
    console.log('  🏜️ DRY RUN — would send Telegram message:');
    console.log(text.replace(/<[^>]*>/g, '').slice(0, 200) + '...');
    return true;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`  ⚠ Telegram API error: ${response.status} — ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.log(`  ⚠ Telegram send failed: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Escape HTML special characters for Telegram.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format and send a job match notification.
 */
export async function notifyJobMatch(scoredJob: ScoredJob): Promise<boolean> {
  const { job, score } = scoredJob;

  const scoreEmoji = score.score >= 9 ? '🔥' : score.score >= 8 ? '⭐' : '✨';
  const sourceLabel = job.source.charAt(0).toUpperCase() + job.source.slice(1);

  const missingSkillsText = score.missingSkills.length > 0
    ? score.missingSkills.map(s => escapeHtml(s)).join(', ')
    : 'None identified';

  const interviewText = score.interviewTopics.length > 0
    ? score.interviewTopics.map(t => `• ${escapeHtml(t)}`).join('\n')
    : 'Not available';

  const message = `
${scoreEmoji} <b>AI Job Match — ${score.score.toFixed(1)}/10</b>

🏢 <b>Company:</b> ${escapeHtml(job.company || 'Unknown')}
💼 <b>Role:</b> ${escapeHtml(job.title)}
📍 <b>Location:</b> ${escapeHtml(job.location)}${job.remote ? ' (Remote)' : ''}
📋 <b>Type:</b> ${escapeHtml(job.employmentType || 'Not specified')}
📡 <b>Source:</b> ${escapeHtml(sourceLabel)} (${escapeHtml(job.ats)})

💡 <b>Why:</b> ${escapeHtml(score.reason)}

⚠️ <b>Missing Skills:</b> ${missingSkillsText}

📝 <b>Resume Tip:</b> ${escapeHtml(score.resumeSuggestions).slice(0, 200)}

🔗 <a href="${job.applyUrl}">Apply Now</a>

💬 <b>Referral Message:</b>
<i>${escapeHtml(score.linkedinMessage).slice(0, 300)}</i>

📚 <b>Interview Topics:</b>
${interviewText}
`.trim();

  return sendMessage(message);
}

/**
 * Send a batch of job notifications.
 * Adds a 1-second delay between messages to avoid Telegram rate limits.
 */
export async function notifyJobMatches(scoredJobs: ScoredJob[]): Promise<number> {
  let sent = 0;

  for (const scoredJob of scoredJobs) {
    const success = await notifyJobMatch(scoredJob);
    if (success) sent++;

    // Telegram rate limit: max 30 messages per second, but let's be polite
    await sleep(1000);
  }

  return sent;
}

/**
 * Send a run summary notification.
 */
export async function notifySummary(stats: RunStats): Promise<void> {
  const duration = (() => {
    const start = new Date(stats.startedAt);
    const elapsed = (Date.now() - start.getTime()) / 1000;
    if (elapsed < 60) return `${elapsed.toFixed(0)}s`;
    return `${(elapsed / 60).toFixed(1)}m`;
  })();

  const message = `
📊 <b>${stats.workflow.toUpperCase()} Run Summary</b>

⏱ Duration: ${duration}
📥 Jobs scanned: ${stats.jobsScanned.toLocaleString()}
🔍 After DuckDB filter: ${stats.afterDuckDbFilter}
🔄 After dedup: ${stats.afterDedup}
🤖 Sent to Gemini: ${stats.sentToGemini}
⭐ Score ≥ ${CONFIG.scoreThreshold}: ${stats.aboveThreshold}
📱 Notified: ${stats.notified}
🆕 Companies promoted: ${stats.companiesPromoted}
${stats.errors.length > 0 ? `\n⚠️ Errors: ${stats.errors.length}\n${stats.errors.slice(0, 3).map(e => `• ${escapeHtml(e)}`).join('\n')}` : ''}
`.trim();

  await sendMessage(message);
}

/** Simple sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

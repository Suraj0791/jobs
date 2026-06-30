// ============================================================
// OpenJobData Downloader — fetch parquet files from HF bucket
// ============================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { CONFIG } from '../../config/constants.js';

/**
 * Download a file from the HuggingFace bucket to a local path.
 * Uses plain fetch — no HF SDK needed since the bucket is public.
 */
async function downloadFromBucket(remotePath: string, localPath: string): Promise<void> {
  const url = `${CONFIG.hfDownloadBase}/${remotePath}`;
  console.log(`  ↓ Downloading: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ai-job-radar/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${remotePath}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(join(process.cwd(), CONFIG.tmpDir), { recursive: true });
  await writeFile(localPath, buffer);

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`  ✓ Downloaded ${sizeMB} MB → ${localPath}`);
}

/**
 * Download today's daily changes parquet file (minimal schema).
 * 
 * @param date - Date string in YYYY-MM-DD format (defaults to today)
 * @returns Local file path to the downloaded parquet, or null if no file exists for that date
 */
export async function downloadDailyChanges(date?: string): Promise<string | null> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const remotePath = `minimal/changes/${targetDate}.parquet`;
  const localPath = join(process.cwd(), CONFIG.tmpDir, `changes-${targetDate}.parquet`);

  // Skip if already downloaded (idempotent)
  if (existsSync(localPath)) {
    console.log(`  ✓ Already downloaded: ${localPath}`);
    return localPath;
  }

  try {
    await downloadFromBucket(remotePath, localPath);
    return localPath;
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('404')) {
      console.log(`  ⚠ No changes file found for ${targetDate} (may not be published yet)`);
      return null;
    }
    throw error;
  }
}

/**
 * Download the companies.parquet metadata file.
 * 
 * @returns Local file path to the downloaded parquet
 */
export async function downloadCompanies(): Promise<string> {
  const remotePath = 'companies/companies.parquet';
  const localPath = join(process.cwd(), CONFIG.tmpDir, 'companies.parquet');

  await downloadFromBucket(remotePath, localPath);
  return localPath;
}

/**
 * Try downloading changes for today. If not available, try yesterday.
 * OpenJobData may publish today's file late — this handles the edge case.
 * 
 * @returns Local file path, or null if neither today nor yesterday is available
 */
export async function downloadLatestChanges(): Promise<{ path: string; date: string } | null> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Try today first
  const todayPath = await downloadDailyChanges(todayStr);
  if (todayPath) {
    return { path: todayPath, date: todayStr };
  }

  // Fall back to yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const yesterdayPath = await downloadDailyChanges(yesterdayStr);
  if (yesterdayPath) {
    return { path: yesterdayPath, date: yesterdayStr };
  }

  return null;
}

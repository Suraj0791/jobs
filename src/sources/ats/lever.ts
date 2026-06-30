// ============================================================
// Lever ATS Collector
// API: GET https://api.lever.co/v0/postings/{slug}?mode=json
// No authentication required.
// Also tries EU endpoint on failure.
// ============================================================

import { ATSCollector, registerCollector } from './base.js';
import type { Job, JobSource } from '../../models/job.js';

interface LeverPosting {
  id: string;
  text: string;
  descriptionPlain?: string;
  description?: string;
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;
  workplaceType?: string;
}

class LeverCollector extends ATSCollector {
  readonly atsName: JobSource = 'lever';
  readonly displayName = 'Lever';
  readonly urlPatterns = [
    /jobs\.lever\.co\/(\w[\w-]*)/i,
    /lever\.co\/(\w[\w-]*)/i,
  ];

  private readonly BASE_URL = 'https://api.lever.co/v0/postings';
  private readonly EU_BASE_URL = 'https://api.eu.lever.co/v0/postings';

  async fetchJobs(slug: string, companyName: string, companyId: number): Promise<Job[]> {
    // Try main endpoint first, fall back to EU
    let allPostings = await this.fetchFromEndpoint(this.BASE_URL, slug);

    if (allPostings === null) {
      // Try EU endpoint
      allPostings = await this.fetchFromEndpoint(this.EU_BASE_URL, slug);
    }

    if (allPostings === null || allPostings.length === 0) {
      return [];
    }

    return allPostings.map(posting => this.normalize(posting, slug, companyName, companyId));
  }

  private async fetchFromEndpoint(
    baseUrl: string,
    slug: string
  ): Promise<LeverPosting[] | null> {
    const allPostings: LeverPosting[] = [];
    let offset = 0;
    const limit = 100;

    // Paginate through all postings
    while (true) {
      const url = `${baseUrl}/${slug}?mode=json&limit=${limit}&skip=${offset}`;
      const response = await this.rateLimitedFetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          if (offset === 0) return null; // Not found on first page = wrong endpoint
          break; // No more pages
        }
        console.log(`    ⚠ Lever ${slug}: ${response.status}`);
        return null;
      }

      const postings = await response.json() as LeverPosting[];
      if (!Array.isArray(postings) || postings.length === 0) break;

      allPostings.push(...postings);

      // If we got fewer than limit, we've reached the end
      if (postings.length < limit) break;
      offset += limit;

      // Safety cap to prevent infinite loops
      if (offset > 5000) break;
    }

    return allPostings;
  }

  private normalize(
    posting: LeverPosting,
    slug: string,
    companyName: string,
    companyId: number
  ): Job {
    const location = posting.categories?.location || '';
    const isRemote =
      /remote/i.test(location) ||
      /remote/i.test(posting.text) ||
      posting.workplaceType === 'remote';

    return {
      id: `${slug}/${posting.id}`,
      jobId: posting.id,
      company: companyName,
      companyId,
      title: posting.text || '',
      description: posting.descriptionPlain || posting.description || '',
      applyUrl: posting.hostedUrl || posting.applyUrl || '',
      location,
      remote: isRemote,
      employmentType: posting.categories?.commitment || '',
      workplaceType: posting.workplaceType || (isRemote ? 'remote' : ''),
      department: posting.categories?.department || posting.categories?.team || '',
      postedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : '',
      source: 'lever',
      ats: 'lever',
    };
  }
}

// Self-register
registerCollector(new LeverCollector());

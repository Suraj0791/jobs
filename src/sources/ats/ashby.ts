// ============================================================
// Ashby ATS Collector
// API: GET https://api.ashbyhq.com/posting-api/job-board/{slug}
// No authentication required.
// ============================================================

import { ATSCollector, registerCollector } from './base.js';
import type { Job, JobSource } from '../../models/job.js';

interface AshbyJob {
  id: string;
  title: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt: string;
  employmentType?: string;
  location: string;
  department?: string;
  team?: string;
  isRemote: boolean;
  applicationUrl?: string;
  applyUrl?: string;
  jobUrl?: string;
  workplaceType?: string;
  compensation?: {
    compensationTierSummary?: string;
  };
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

class AshbyCollector extends ATSCollector {
  readonly atsName: JobSource = 'ashby';
  readonly displayName = 'Ashby';
  readonly urlPatterns = [
    /jobs\.ashbyhq\.com\/(\w[\w-]*)/i,
    /ashbyhq\.com\/(\w[\w-]*)/i,
  ];

  async fetchJobs(slug: string, companyName: string, companyId: number): Promise<Job[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

    const response = await this.rateLimitedFetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`    ⚠ Ashby board "${slug}" not found (404)`);
        return [];
      }
      console.log(`    ⚠ Ashby ${slug}: ${response.status}`);
      return [];
    }

    const data: AshbyResponse = await response.json();

    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    return data.jobs.map(job => this.normalize(job, slug, companyName, companyId));
  }

  private normalize(
    job: AshbyJob,
    slug: string,
    companyName: string,
    companyId: number
  ): Job {
    const location = job.location || '';
    const isRemote = job.isRemote || /remote/i.test(location);

    return {
      id: `${slug}/${job.id}`,
      jobId: job.id,
      company: companyName,
      companyId,
      title: job.title || '',
      description: job.descriptionPlain || job.descriptionHtml || '',
      applyUrl: job.applicationUrl || job.applyUrl || job.jobUrl || '',
      location,
      remote: isRemote,
      employmentType: job.employmentType || '',
      workplaceType: job.workplaceType || (isRemote ? 'remote' : ''),
      department: job.department || job.team || '',
      postedAt: job.publishedAt || '',
      source: 'ashby',
      ats: 'ashby',
    };
  }
}

// Self-register
registerCollector(new AshbyCollector());

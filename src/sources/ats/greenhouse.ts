// ============================================================
// Greenhouse ATS Collector
// API: GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
// No authentication required.
// ============================================================

import { ATSCollector, registerCollector } from './base.js';
import type { Job, JobSource } from '../../models/job.js';

interface GreenhouseJob {
  id: number;
  title: string;
  content?: string;
  updated_at: string;
  absolute_url: string;
  location: { name: string };
  departments: { name: string }[];
  offices: { name: string; location: string }[];
  metadata?: { id: number; name: string; value: string | string[] | null }[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta: { total: number };
}

class GreenhouseCollector extends ATSCollector {
  readonly atsName: JobSource = 'greenhouse';
  readonly displayName = 'Greenhouse';
  readonly urlPatterns = [
    /boards\.greenhouse\.io\/(\w[\w-]*)/i,
    /greenhouse\.io\/(?:embed\/)?job_board.*company=(\w[\w-]*)/i,
  ];

  async fetchJobs(slug: string, companyName: string, companyId: number): Promise<Job[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

    const response = await this.rateLimitedFetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`    ⚠ Greenhouse board "${slug}" not found (404)`);
        return [];
      }
      console.log(`    ⚠ Greenhouse ${slug}: ${response.status}`);
      return [];
    }

    const data: GreenhouseResponse = await response.json();
    
    return data.jobs.map(job => this.normalize(job, slug, companyName, companyId));
  }

  private normalize(
    job: GreenhouseJob,
    slug: string,
    companyName: string,
    companyId: number
  ): Job {
    const location = job.location?.name || '';
    const isRemote = /remote/i.test(location) || /remote/i.test(job.title);

    // Try to extract employment type from metadata
    let employmentType = '';
    if (job.metadata) {
      const typeField = job.metadata.find(m =>
        /employment.type|job.type/i.test(m.name)
      );
      if (typeField && typeof typeField.value === 'string') {
        employmentType = typeField.value;
      }
    }

    return {
      id: `${slug}/${job.id}`,
      jobId: String(job.id),
      company: companyName,
      companyId,
      title: job.title || '',
      description: job.content || '',
      applyUrl: job.absolute_url || '',
      location,
      remote: isRemote,
      employmentType,
      workplaceType: isRemote ? 'remote' : '',
      department: job.departments?.[0]?.name || '',
      postedAt: job.updated_at || '',
      source: 'greenhouse',
      ats: 'greenhouse',
    };
  }
}

// Self-register
registerCollector(new GreenhouseCollector());

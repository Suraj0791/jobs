// ============================================================
// SmartRecruiters ATS Collector
// API: GET https://api.smartrecruiters.com/v1/companies/{slug}/postings
// No authentication required (if company has public feed enabled).
// ============================================================

import { ATSCollector, registerCollector } from './base.js';
import type { Job, JobSource } from '../../models/job.js';

interface SmartRecruitersPosting {
  id: string;
  name: string;
  uuid?: string;
  refNumber?: string;
  company: { name: string; identifier: string };
  location: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: { label: string };
  typeOfEmployment?: { label: string };
  experienceLevel?: { label: string };
  industry?: { label: string };
  function?: { label: string };
  releasedDate?: string;
  ref?: string;
  creator?: { name: string };
}

interface SmartRecruitersResponse {
  content: SmartRecruitersPosting[];
  totalFound: number;
  offset: number;
  limit: number;
}

class SmartRecruitersCollector extends ATSCollector {
  readonly atsName: JobSource = 'smartrecruiters';
  readonly displayName = 'SmartRecruiters';
  readonly urlPatterns = [
    /careers\.smartrecruiters\.com\/(\w[\w-]*)/i,
    /jobs\.smartrecruiters\.com\/(\w[\w-]*)/i,
    /smartrecruiters\.com\/(\w[\w-]*)/i,
  ];

  async fetchJobs(slug: string, companyName: string, companyId: number): Promise<Job[]> {
    const allPostings: SmartRecruitersPosting[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?offset=${offset}&limit=${limit}`;
      const response = await this.rateLimitedFetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`    ⚠ SmartRecruiters "${slug}" not found (404)`);
          return [];
        }
        console.log(`    ⚠ SmartRecruiters ${slug}: ${response.status}`);
        return [];
      }

      const data: SmartRecruitersResponse = await response.json();
      
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        break;
      }

      allPostings.push(...data.content);

      // If we got fewer than limit, we've reached the end
      if (data.content.length < limit) break;
      offset += limit;

      // Safety cap
      if (offset > 5000) break;
    }

    return allPostings.map(posting => this.normalize(posting, slug, companyName, companyId));
  }

  private normalize(
    posting: SmartRecruitersPosting,
    slug: string,
    companyName: string,
    companyId: number
  ): Job {
    const locationParts = [
      posting.location?.city,
      posting.location?.region,
      posting.location?.country,
    ].filter(Boolean);
    const location = locationParts.join(', ') || '';
    const isRemote = posting.location?.remote ?? /remote/i.test(location);

    // Build apply URL
    const applyUrl = `https://jobs.smartrecruiters.com/${slug}/${posting.id}`;

    return {
      id: `${slug}/${posting.id}`,
      jobId: posting.id,
      company: companyName || posting.company?.name || '',
      companyId,
      title: posting.name || '',
      description: '', // SmartRecruiters public API doesn't return descriptions in listing
      applyUrl,
      location,
      remote: isRemote,
      employmentType: posting.typeOfEmployment?.label || '',
      workplaceType: isRemote ? 'remote' : '',
      department: posting.department?.label || '',
      postedAt: posting.releasedDate || '',
      source: 'smartrecruiters',
      ats: 'smartrecruiters',
    };
  }
}

// Self-register
registerCollector(new SmartRecruitersCollector());

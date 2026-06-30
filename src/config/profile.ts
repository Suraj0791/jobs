// ============================================================
// User Profile — your preferences for job matching
// ============================================================

export const USER_PROFILE = {
  name: 'Suraj Sharma',
  
  /** Graduating April/May 2027 — currently 7th semester */
  graduationDate: '2027-05',
  currentStatus: 'Final year B.Tech student (7th semester)',
  
  /** Target role titles */
  targetRoles: [
    'Software Engineer','SDE INTERN', 'SDE intern',
    'Software Engineer Intern', 'Software developer Intern', 'Software Developer Intern',
    'Frontend Developer Intern', 'Frontend Engineer Intern','Full Stack Developer Intern', 
    'Backend Developer Intern', 'Backend Engineer Intern',
    'Backend developer ','Backend Engineer','Frontend developer ','Frontend Engineer','Full Stack developer ','Full Stack Engineer',
    'Software Developer',
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
    'SDE',
    'SWE',
    'Web Developer',
    'Application Developer',
  ] as const,

  /** Target experience levels */
  targetLevels: [
    'Intern',
    'Internship',
    'Entry Level',
    'Fresher',
    'Graduate',
    'New Grad',
    'Junior',
    'Associate',
    'Trainee',
    'Apprentice',
    'Campus',
    'Early Career',
    'SDE-1',
    'SDE 1',
  ] as const,

  /** Location preferences */
  locations: {
    /** India jobs: remote, hybrid, OR onsite — all accepted */
    primaryCountry: 'India',
    /** Also accept: purely remote roles from anywhere in the world */
    acceptRemoteWorldwide: true,
  },

  /** Tech stack for matching */
  techStack: [
    'JavaScript', 'TypeScript', 'Python', 'C++',
    'React', 'Next.js', 'Tailwind CSS', 'D3.js', 'MUI', 'ShadCN',
    'Node.js', 'Express.js', 'Socket.io',
    'PostgreSQL', 'MongoDB', 'Redis', 'Supabase','Mysql','SQL',
    'Prisma', 'Drizzle ORM',
    'Docker', 'AWS', 'Vercel',
    'REST APIs', 'WebSockets', 'JWT', 'NextAuth',
    'Git', 'Postman', 'Sentry',
  ] as const,

  /** Preferred company types */
  preferredCompanies: [
    'Product companies',
    'SaaS',
    'Startups',
    'Foreign companies hiring in India',
    'Tech companies',
    'AI/ML companies',
    'Fintech',
    'Edtech',
    'Service Based companies'
  ] as const,

  /** Salary range (for Gemini context, not for filtering — most jobs don't list salary) */
  salaryRange: '₹8–20 LPA',

  /** Education */
  education: {
    degree: 'B.Tech in Electronics and Communication Engineering',
    institution: 'Indian Institute of Information Technology, Ranchi',
    cgpa: 8.67,
    period: 'Aug 2023 – May 2027',
  },

  /** Experience summary for Gemini */
  experienceSummary: [
    'SDE Intern at SellerSetu (Oct 2025 – Feb 2026): ONDC platform, ,Nodejs, React Query, backend APIs',
    'Frontend Developer Intern at Atom360 (Jan 2025 – May 2025): React + D3.js data viz, healthcare dashboard, MUI',
  ],
} as const;

# AI Job Radar — Implementation Plan (Updated)

> [!NOTE]
> **Key updates from v1**: Added SmartRecruiters ATS collector, refined eligibility for 2027 batch, added actual resume, expanded location logic to India(all) + Remote(worldwide), and clarified Workday/UltiPro/Oracle/Paycom strategy.

---

## ATS Coverage Strategy

| ATS | Open Postings | Phase 1 Collector? | Why |
|---|---|---|---|
| **Greenhouse** | 105,641 | ✅ Yes | Clean public JSON API, no auth |
| **Lever** | — | ✅ Yes | Clean public JSON API, no auth |
| **Ashby** | — | ✅ Yes | Clean public JSON API, no auth |
| **SmartRecruiters** | 171,571 | ✅ Yes | Clean public JSON API, no auth |
| **Workday** | 180,204 | ❌ OpenJobData covers | No public API, bot detection, per-tenant variation |
| **UltiPro** | 140,830 | ❌ OpenJobData covers | No public API |
| **Oracle HCM** | 140,373 | ❌ OpenJobData covers | No public API |
| **Paycom** | 130,927 | ❌ OpenJobData covers | No public API |
| **iCIMS** | 73,171 | ❌ OpenJobData covers | No public API |

> Workday alone is 180k postings — but OpenJobData crawls ALL of them daily. You get those jobs via Layer 1 (daily changes) with ~24hr delay. The ATS collectors (Layer 2) exist only for the "fast lane" on systems with clean public APIs.

---

## Eligibility Filters (2027 Batch)

**You**: Suraj Sharma, B.Tech ECE, IIIT Ranchi, graduating **April/May 2027**, currently 7th semester. Two internship experiences. Looking for intern / entry-level / fresher / new grad SDE roles.

### Title Keywords (INCLUDE — at least one must match)
```
software, engineer, developer, backend, frontend, full stack, fullstack,
sde, swe, platform, cloud, data, devops, qa, sre,
intern, internship, graduate, entry, fresher, trainee, associate,
new grad, early career, campus, apprentice, junior, sde-1, sde1, sde 1
```

### Title Keywords (EXCLUDE — if any match, skip)
```
senior, staff, lead, principal, director, architect, manager, vp, chief,
head of, doctor, nurse, chef, sales, marketing, hr, finance,
10+ years, 8+ years, 7+ years, 5+ years, 4+ years, 3+ years
```

### Location Logic
```
KEEP if:
  - country = 'India' (any work type: remote, hybrid, onsite)
  - OR is_remote = true (anywhere in world)
  - OR workplace_type = 'remote' (anywhere in world)
  - OR location contains 'remote' or 'anywhere' or 'worldwide'
```

---

## Resume (Embedded)

Suraj Sharma's actual resume is embedded in `src/config/resume.ts` — extracted from the LaTeX source provided:

- **Education**: B.Tech ECE, IIIT Ranchi, CGPA 8.67, Aug 2023 – May 2027
- **Experience**: SDE Intern at SellerSetu (ONDC platform, React Query, dispute management), Frontend Dev Intern at Atom360 (React + D3.js, healthcare dashboard)
- **Projects**: TourneyHub (Node.js, Express, Socket.io, PostgreSQL, Razorpay — real-time multiplayer), AI Finance Manager (Next.js 15, Prisma, Gemini AI, NextAuth)
- **Stack**: JavaScript, TypeScript, Python, C++, React, Next.js, Node.js, Express, Socket.io, PostgreSQL, MongoDB, Redis, Prisma, Docker, AWS, Tailwind, D3.js

---

## All other components remain the same as v1 plan, with these specific changes:

1. **SmartRecruiters collector added**: `GET https://api.smartrecruiters.com/v1/companies/{slug}/postings` — same pattern as other ATS collectors
2. **`SUPPORTED_ATS` expanded**: `['greenhouse', 'lever', 'ashby', 'smartrecruiters']`
3. **Watchlist filter updated**: Include companies using any of the 4 supported ATS types
4. **DuckDB filter SQL updated**: Location logic now `(country = 'India') OR (is_remote = true) OR (LOWER(workplace_type) = 'remote')`
5. **Title filter updated**: Added intern/fresher/graduate/new-grad/junior/trainee/apprentice/campus keywords; exclude senior/staff/lead plus years-of-experience patterns
6. **Score threshold**: Starting at **7** (configurable via env), can tighten to 8 or 9 after calibration
7. **Architecture is plugin-based**: Each ATS collector is a standalone class extending `ATSCollector` — adding a new ATS = adding one file

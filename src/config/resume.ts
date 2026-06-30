// ============================================================
// Resume Text — extracted from LaTeX source
// Used by Gemini scorer for job matching
// ============================================================

export const RESUME_TEXT = `
SURAJ SHARMA
+91-7488612472 | shrmasurajj@gmail.com | GitHub: Suraj0791 | LinkedIn: suraj-sharma4011 | Portfolio: surajsharma.me

EDUCATION
Indian Institute of Information Technology, Ranchi — Ranchi, Jharkhand
B.Tech in Electronics and Communication Engineering | CGPA: 8.67 | Aug 2023 – May 2027

EXPERIENCE

SDE Intern — SellerSetu (Remote) | Oct 2025 – Feb 2026
• Contributed across ONDC-based seller and admin platforms, implementing workflows for dispute management, settlements, order operations, and transaction reconciliation.
• Developed and integrated Issue & Grievance Management (IGM) modules with timeline workflows, resolution actions, validation logic, and backend API integrations for multi-stage dispute handling.
• Optimized application data flows using TanStack React Query, dependent queries, and cache invalidation strategies, reducing redundant API requests and improving dashboard responsiveness.
• Built reconciliation & settlement (RSF) interfaces handling TDS/TCS calculations, payout adjustments, commission splits, and seller transaction workflows across ONDC systems.
• Collaborated with senior engineers to investigate API bottlenecks using request logs, Sentry traces, and Postman testing; resolved inefficient data-fetching patterns and N+1 query issues, improving stability across dispute and order workflows.

Frontend Developer Intern — Atom360 (Remote) | Jan 2025 – May 2025
• Engineered India Statistics Map visualization from scratch using React + D3.js with real-time API data, region-wise statistics, interactive tooltips, and analytics charts.
• Developed responsive, role-based healthcare admin dashboard integrating REST APIs for patient records, screening history, and analytics with custom MUI theming.
• Optimized rendering performance for high-density API datasets; ensured cross-browser compatibility and mobile responsiveness using Tailwind CSS.

PROJECTS

TourneyHub — Real-Time Multiplayer Tournament Platform
Node.js, Express, Socket.io, React, Shadcn, Razorpay, PostgreSQL
• Eliminated high-traffic read bottlenecks via a Cache-Aside pattern (Node-Cache, 10–30s TTL) and composite B-Tree indexes, cutting leaderboard query latency 98.5% (275ms to 4ms) and tournament lookups to under 5ms on cache hits.
• Refactored sequential post-match database writes into parallel execution using Promise.all, cutting completion latency 75% (~1s to ~250ms), verified with a custom benchmark script against the live PostgreSQL instance.
• Prevented payment double-crediting and tournament slot overbooking by enforcing strict webhook idempotency using PostgreSQL row-level locks (SELECT ... FOR UPDATE), maintaining 100% data integrity under concurrent load.
• Hardened APIs with layered rate limiting; an Autocannon load test (5,913 requests in 10s) showed the limiter blocking 99.7% of simulated brute-force traffic.
• Engineered dual real-time game engine (Trivia + QuickDraw) on Socket.io with in-memory state machines, handling disconnect grace periods and automatic match forfeiture.

AI Finance Manager — Personal Finance & Expense Splitting
Next.js 15, Prisma, Gemini AI, NextAuth, PostgreSQL
• Implemented multi-provider OAuth via NextAuth; integrated Gemini API OCR to extract transaction metadata from receipt images.
• Built AI Financial Advisor chatbot powered by Gemini with server-side function calling to query authenticated user financial data.
• Engineered group expense-split engine using greedy debt-minimization algorithm with interactive SVG settlement visualizer.
• Configured automated cron jobs for recurring transactions and alerts; built PDF/CSV exporters; optimized rendering via Next.js RSC streaming and Suspense.

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, C++, C, SQL, HTML/CSS
Frontend: React, Next.js 15, Tailwind CSS, Zustand, React Query, ShadCN/UI, D3.js, MUI
Backend: Node.js, Express.js, Socket.io, REST APIs, WebSockets, JWT, NextAuth, bcrypt
Databases: PostgreSQL, MongoDB, Supabase, Redis, Prisma, Drizzle ORM, Mongoose
Tools & Platforms: Git, Docker, Postman, Vercel, Render, Sentry, AWS, Razorpay, Stripe
`.trim();

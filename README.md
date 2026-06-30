# 🛰️ AI Job Radar

Personal AI-powered job discovery system that automatically finds, filters, ranks, and notifies about software engineering jobs matching your profile.

**This is NOT a job board. This is NOT a scraper.**  
This is your personal AI assistant that monitors the job market 24/7 and alerts you only about the best matches.

## Architecture

```
Layer 1: OpenJobData (Daily Breadth)
├── Downloads daily changes parquet (~few MB)
├── DuckDB SQL filter (country/remote + title + seniority)
├── Gemini scoring (only 20-100 jobs after filter)
└── Telegram notification (score ≥ 7)

Layer 2: ATS Watchlist (Hourly Speed)
├── 500-1000 companies with supported ATS
├── Greenhouse / Lever / Ashby / SmartRecruiters APIs
├── Title + location filter → dedup → Gemini → Telegram
└── Auto-promotes high-scoring companies
```

## Quick Start

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/ai-job-radar.git
cd ai-job-radar
npm install
```

### 2. Set up secrets
```bash
cp .env.example .env
# Edit .env with your actual keys
```

You need:
- **Gemini API Key**: [AI Studio](https://aistudio.google.com/) (free, no billing)
- **Telegram Bot Token**: Message [@BotFather](https://t.me/BotFather)
- **Telegram Chat ID**: Message [@userinfobot](https://t.me/userinfobot)

### 3. Initialize (run weekly first)
```bash
# Build TypeScript
npm run build

# Download companies + generate watchlist
node dist/index.js weekly

# Run daily scan
node dist/index.js daily

# Run hourly poll
node dist/index.js hourly
```

### 4. Deploy to GitHub Actions
1. Push to a **public** GitHub repo (free unlimited Actions)
2. Add secrets in Settings → Secrets → Actions:
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. Workflows auto-run on schedule, or trigger manually from Actions tab

## Workflows

| Workflow | Schedule | What it does |
|---|---|---|
| **Weekly** | Sunday 8:30 AM IST | Downloads 107k companies → generates watchlist |
| **Daily** | 10:00 AM IST | Downloads OpenJobData changes → filter → score → notify |
| **Hourly** | Every hour | Polls watchlist ATS APIs → filter → score → notify |

## Project Structure

```
src/
├── config/          # Profile, resume, keywords, thresholds
├── models/          # Unified Job type definitions
├── sources/
│   ├── openjobdata/ # HuggingFace parquet downloader + DuckDB filter
│   └── ats/         # Greenhouse, Lever, Ashby, SmartRecruiters collectors
├── db/              # DuckDB (parquet) + SQLite (state) wrappers
├── watchlist/       # Auto-generate + auto-promote watchlist
├── scoring/         # Gemini AI job matching
├── dedup/           # Cross-source deduplication
├── notify/          # Telegram notifications
├── workflows/       # Hourly, daily, weekly orchestrators
└── index.ts         # CLI entry point
```

## Adding a New ATS Collector

1. Create `src/sources/ats/newats.ts`
2. Extend `ATSCollector` base class
3. Implement `fetchJobs()` method
4. Call `registerCollector()` at module load
5. Add import in workflow files
6. Add to `SUPPORTED_ATS` in constants

## Cost

| Resource | Cost |
|---|---|
| GitHub Actions (public repo) | Free |
| Gemini Flash API (free tier) | Free |
| Telegram Bot API | Free |
| HuggingFace downloads | Free |
| **Total** | **₹0** |

## Tech Stack

- TypeScript / Node.js 22
- DuckDB (`@duckdb/node-api`) — SQL on parquet files
- SQLite (`better-sqlite3`) — state persistence
- Gemini Flash (`@google/genai`) — AI scoring
- Telegram Bot API — notifications
- GitHub Actions — orchestration

## License

MIT

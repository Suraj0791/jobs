// ============================================================
// CLI Entry Point — node dist/index.js [hourly|daily|weekly]
// ============================================================

import { runHourlyWorkflow } from './workflows/hourly.js';
import { runDailyWorkflow } from './workflows/daily.js';
import { runWeeklyWorkflow } from './workflows/weekly.js';

const COMMANDS = {
  hourly: runHourlyWorkflow,
  daily: runDailyWorkflow,
  weekly: runWeeklyWorkflow,
} as const;

type Command = keyof typeof COMMANDS;

async function main(): Promise<void> {
  const command = process.argv[2] as Command;

  if (!command || !(command in COMMANDS)) {
    console.log(`
╔═══════════════════════════════════════════╗
║         🛰️  AI Job Radar v1.0.0          ║
╠═══════════════════════════════════════════╣
║                                           ║
║  Usage:                                   ║
║    npx tsx src/index.ts <command>          ║
║    node dist/index.js <command>            ║
║                                           ║
║  Commands:                                ║
║    hourly  — Poll watchlist ATS APIs      ║
║    daily   — Process OpenJobData changes  ║
║    weekly  — Refresh companies + watchlist ║
║                                           ║
║  Environment:                             ║
║    GEMINI_API_KEY     — Gemini API key    ║
║    TELEGRAM_BOT_TOKEN — Telegram bot      ║
║    TELEGRAM_CHAT_ID   — Telegram chat     ║
║    SCORE_THRESHOLD    — Min score (def: 7)║
║    DRY_RUN            — Skip sends (bool) ║
║                                           ║
╚═══════════════════════════════════════════╝
`);
    process.exit(1);
  }

  console.log(`\n🛰️  AI Job Radar — ${command} workflow`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Node: ${process.version}`);
  console.log(`   Dry run: ${process.env.DRY_RUN === 'true' ? 'YES' : 'no'}`);
  console.log('');

  try {
    await COMMANDS[command]();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

main();

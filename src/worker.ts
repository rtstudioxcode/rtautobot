// Standalone BullMQ worker fallback — normally started automatically by `npm run start` via instrumentation.ts
import 'dotenv/config';
import { connectMongo } from './db/mongo';
import { refreshConfigFromDB, startSecureConfigAutoReload } from './config';
import { startJobScheduler } from './queue/jobQueue';
import { startQueueWorker } from './queue/queueWorker';

async function main() {
  console.log('[WORKER] Connecting to MongoDB...');
  await connectMongo();
  await refreshConfigFromDB();
  startSecureConfigAutoReload();
  console.log('[WORKER] Starting job scheduler...');
  await startJobScheduler();
  console.log('[WORKER] Starting queue worker...');
  startQueueWorker();
  console.log('[WORKER] Ready.');
}

main().catch((err) => {
  console.error('[WORKER] Fatal error:', err);
  process.exit(1);
});

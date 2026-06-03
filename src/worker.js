// Standalone BullMQ worker — run with: node src/worker.js
import 'dotenv/config';
import { connectMongo } from './db/mongo.js';
import { refreshConfigFromDB, startSecureConfigAutoReload } from './config.js';
import { startQueueWorker } from './queue/queueWorker.js';

async function main() {
  console.log('[WORKER] Connecting to MongoDB...');
  await connectMongo();
  await refreshConfigFromDB();
  startSecureConfigAutoReload();
  console.log('[WORKER] Starting queue worker...');
  startQueueWorker();
  console.log('[WORKER] Ready.');
}

main().catch((err) => {
  console.error('[WORKER] Fatal error:', err);
  process.exit(1);
});

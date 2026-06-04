import 'dotenv/config';
import { connectMongo } from '../db/mongo';
import { refreshConfigFromDB, startSecureConfigAutoReload } from '../config';

let initialized = false;
let initPromise = null;

export async function ensureInit() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await connectMongo();
    await refreshConfigFromDB();
    startSecureConfigAutoReload();
    initialized = true;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

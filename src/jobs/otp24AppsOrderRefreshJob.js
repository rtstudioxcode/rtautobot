// src/jobs/otp24AppsOrderRefreshJob.js
import { runOtp24AppsOrderRefreshOnce } from '../services/otp24AppsOrderRefresh.js';

export async function tickOnce() {
  return runOtp24AppsOrderRefreshOnce();
}

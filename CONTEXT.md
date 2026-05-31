# RTAUTOBOT Context / Track

## Project Boundary
- RTAUTOBOT is a Bonustime-only frontend/backend split from RTSMM-TH.
- Keep Bonustime flow, shared user/credit DB data, and RTAUTOBOT-specific topup/payment scope.
- Do not reintroduce APPS, OTP24, SMM, Telegram ordering routes/jobs, or old RTSMM-TH storefront flows unless explicitly requested.
- Every code change must update this file with a short track note.

## Current UI Direction
- Use the original RTAUTOBOT layout structure, not a full clone of XSuper Chat.
- Theme direction: LINE Green + Navy/Dark.
- Dark mode must be navy/dark with LINE-green accents.
- Light mode must keep clear contrast and readable panels; avoid overly pale/washed-out cards.

## Track Log

### 2026-05-31 — Dashboard section title tag fix
- Updated `src/views/dashboard/index.ejs` only.
- Replaced the two `header.dashx-panel__head` wrappers in the dashboard growth/quick-action panels with `div.dashx-headline`.
- Reason: the global theme contains broad selectors such as `[class*="panel"]`; the old class name included `panel` and inherited card/panel background, causing the unwanted blue rectangular strip behind section titles.
- Kept the same visual layout and content while avoiding the global panel selector collision.
- No backend, routes, DB, jobs, or Bonustime logic changed.

# RTAUTOBOT / Bonustime-only Context

## Project Direction
RTAUTOBOT is a production Bonustime-focused website. The public-facing copy must read like a real live service, not like an internal migration note or development checklist.

## Scope Rules
- Keep the project focused on Bonustime ordering, renewal, upgrade, wallet/credit, account, support, and Bonustime admin flows.
- Do not reintroduce public routes, CTA links, landing sections, jobs, or service pages for APPS, OTP24, SMM, Telegram service ordering, or non-Bonustime providers.
- Keep using the same MongoDB/data source and the same user wallet/credit data as the original RTSMM-TH system unless explicitly instructed otherwise.
- Any code change must update this file and add a new track entry below.
- Public UI text must be production/sales-oriented. Do not show internal wording such as what was removed, what was migrated, endpoint names, job names, schema/collection details, or development notes.

## Current Runtime Direction
- Main landing path `/` promotes Bonustime only.
- Main customer action path is `/bonustime`.
- Queue/worker direction remains Bonustime-only.
- Admin direction is Bonustime-only; broader admin polishing can be handled in later rounds.

## Track Log

### 2026-05-31 — Public copy production polish
- Updated the home landing page copy to remove internal migration/development wording.
- Replaced text such as shared DB/job/runtime/removed-service notes with production-ready sales language.
- Kept the landing page focused on Bonustime packages, renewal, upgrade, account wallet, and service management.
- Updated supporting fallback home copy and Bonustime renewal helper text to avoid test/internal wording.
- Updated default page description language in `layout.ejs` to sound production-ready.
- Verified JavaScript syntax after edits.

### 2026-05-31 — Context discipline established
- Added this `CONTEXT.md` as the project guardrail.
- Future edits must update this file and append a track entry so the project stays Bonustime-only.

### 2026-05-31 — Admin + topup production separation
- Changed `/admin` into a Bonustime-focused admin hub with only production-relevant cards: Bonustime Panel, RTAUTOBOT payment account settings, topup report, and manual credit topup.
- Rebuilt `/admin/settings` to manage only RTAUTOBOT deposit accounts. Wallet records now use `production: "rtautobot"` so payment accounts shown to customers on this split site are separated from RTSMM-TH payment accounts while still using the same MongoDB.
- Added `production: "rtautobot"` to new topup transactions and filtered topup pages, webhooks, matching, manual topups, reject actions, and topup reports to RTAUTOBOT production data only.
- Kept user wallet/credit balance shared with the existing `users` collection as required; only payment account configuration and topup transaction/report visibility are scoped to RTAUTOBOT.
- Fixed `admin/bonustime_panel.ejs` so `top5` works when the route passes an array instead of a JSON string.
- Removed unused route files for broad RTSMM-TH admin/affiliate/blog/OTP/Railway surfaces and the unused topup auto-reject job from this Bonustime-only build so they are not accidentally remounted later.

### 2026-05-31 — FAQ converted to Bonustime-only
- Rebuilt `src/views/faq.ejs` from the latest uploaded RTAUTOBOT source so the FAQ is fully about Bonustime.
- Updated SEO title, meta description, keywords, OG/Twitter metadata, and FAQ structured data to focus on Bonustime packages, credit topup, ordering, renewal, upgrade, status tracking, and account help.
- Removed public-facing FAQ wording related to SMM, OTP24, APPS, social boosting, refill, followers, views, likes, and other non-Bonustime services.
- Kept production-ready sales/support wording only; no internal migration notes, endpoint notes, job notes, or development wording are shown in the FAQ UI.

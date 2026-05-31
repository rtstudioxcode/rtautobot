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

### 2026-05-31 — Topup method selection for RTAUTOBOT
- Updated the RTAUTOBOT topup history UI so users can filter their recent topup history by payment Method while keeping the payment page scoped to active RTAUTOBOT deposit accounts only.
- Added Method selection to the admin manual topup modal so manual credit adjustments can be recorded as Admin, manual, TrueMoney Wallet, PromptPay QR, KBank, or SCB instead of always defaulting silently.
- Added Method filtering to `/admin/topup-report` for RTAUTOBOT production records only, so admin topup history can be reviewed by channel while preserving the existing month/year report controls.
- Kept all changes inside the Bonustime/RTAUTOBOT direction and did not reintroduce APPS, OTP24, SMM, or other service surfaces.

### 2026-05-31 — Admin pending topup section
- Updated the RTAUTOBOT `/admin` dashboard to include a dedicated pending topup control section showing only `production: "rtautobot"` transactions with `status: "pending"`.
- Added pending totals/counts to the admin summary cards and kept pending management focused on RTAUTOBOT topup records only.
- Removed the separate manual topup card from the admin dashboard grid; manual topup remains available from the pending topup section/topup report instead of being promoted as a main dashboard card.
- Added quick pending actions on the admin dashboard for reviewing/filling via the topup report and rejecting pending transactions without exposing RTSMM-TH data.
- Preserved the Bonustime-only project scope and did not reintroduce APPS, OTP24, SMM, or non-Bonustime admin surfaces.

### 2026-05-31 — Admin inline manual topup + report Method cleanup
- Updated the RTAUTOBOT `/admin` dashboard so the “เติมเงินด้วยตนเอง” action opens the manual topup modal directly on `/admin` instead of redirecting to `/admin/topup-report`.
- Updated each pending topup row on `/admin` so “เติมให้ผู้ใช้” opens the same modal prefilled with that pending transaction’s username, amount, transaction ID, and Method.
- Kept `/admin/manual-topup` as the JSON endpoint used by the inline modal, still scoped to `production: "rtautobot"` and still using the shared user wallet/credit balance.
- Removed the Method selector from the Report Period section on `/admin/topup-report`; that report now always shows every Method for the selected month/year and continues to display Method breakdowns in the report content.
- Preserved the Bonustime-only/RTAUTOBOT direction and did not reintroduce APPS, OTP24, SMM, Telegram ordering, or other RTSMM-TH service surfaces.

### 2026-05-31 — Global dropdown skin + Bonustime expiry/year summary
- Added a global custom select layer in `src/views/layout.ejs` so standard single-select dropdowns across the RTAUTOBOT site render with the same premium black-gold production UI while the original native `<select>` remains in the DOM for forms and existing JavaScript.
- Updated `/admin/bonustime-panel` service cards to expose service expiry data correctly and show live remaining time badges in days, hours, and minutes; expired services are highlighted clearly while active services show remaining usage time.
- Added Bonustime yearly revenue summary data to `src/routes/admin-bonustime.js`, including yearly totals, Package 1/Package 2 totals, order count, best month, and a new `/admin/bonustime/yearly.json` endpoint.
- Added a yearly summary section and yearly chart to `src/views/admin/bonustime_panel.ejs` so the Bonustime panel now shows both monthly and annual sales performance.
- Kept the project inside the Bonustime-only/RTAUTOBOT scope and did not reintroduce APPS, OTP24, SMM, Telegram ordering, or unrelated RTSMM-TH service surfaces.

## Track Log - 2026-05-31 - Admin manual topup notify fix
- แก้จาก baseline `rtautobot(7).zip` ตามคำสั่งล่าสุด
- แก้หน้า `/admin` modal เติมเงินให้ผู้ใช้: เดิมเรียก `notify(...)` แบบ function ทั้งที่ global notify ใน layout เป็น object (`notify.success/info/warn/error/push`) ทำให้ขึ้น error `notify is not a function`
- เพิ่ม helper เฉพาะหน้า `rtAdminNotify(variant, title, text)` เพื่อรองรับ `window.notify.success`, `window.notify.push`, `window.showMsg` และ fallback alert อย่างปลอดภัย
- ยังรักษา scope RTAUTOBOT/Bonustime-only และ production `rtautobot` เหมือนเดิม ไม่เพิ่ม route/job/service ของ APPS, OTP24, SMM กลับมา

### 2026-05-31 — Admin payment settings UI aligned with RTSMM-TH
- Rebuilt `src/views/admin/admin_setting.ejs` to use the premium RTSMM-TH-style settings layout for the RTAUTOBOT payment account page: large system hero, account summary stats, black-gold tab bar, wallet cards, toggle switches, delete pills, and polished add-account form.
- Kept the page production-facing and RTAUTOBOT-scoped; wording now presents the page as a live payment-account control center instead of an internal migration/test screen.
- Updated `/admin/settings` in `src/routes/admin-bonustime.js` to load all RTAUTOBOT-scoped topup accounts for the settings page and preserve account type (`DEPOSIT`/`WITHDRAW`) when editing or creating wallet records.
- Kept customer topup/payment behavior separated by existing `production: "rtautobot"` scoping and did not reintroduce APPS, OTP24, SMM, Telegram ordering, or other RTSMM-TH services.

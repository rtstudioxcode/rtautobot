## 2026-06-04 — Global Notify and Native Select bridge
- Mounted global client UI helpers in `src/app/layout.tsx` so every page gets the shared notification system and automatic native select enhancement.
- Reworked `src/components/GlobalNotify.tsx` to match the legacy `views/layout.ejs` Notify behavior: top-right toast stack, `window.notify`, `window.showMsg`, `window.dispatchNotify`, `rt:notify` event support, and browser `alert()` mapped to Notify cards.
- Added `src/components/GlobalNativeSelect.tsx` to auto-enhance all native single `<select>` elements across App Router pages into the legacy premium custom dropdown style, while preserving the original hidden `<select>` for React state, forms, and API flow compatibility.
- Selects can opt out with `data-native-select="true"` or `multiple`, and `window.RTCustomSelect.refresh()` remains available for dynamic pages/modals.


## 2026-06-04 — TypeScript / TSX migration scaffold
- Migrated all source files under `src` from `.jsx` to `.tsx` for frontend React/App Router UI and from `.js` to `.ts` for backend/API/lib/model/service/queue/worker code.
- Added `tsconfig.json` and `next-env.d.ts` for Next.js TypeScript support.
- Added `typescript` and `tsx` package entries and changed the worker script to `tsx src/worker.ts` so the standalone BullMQ worker can run from TypeScript source.
- Removed all `// @ts-nocheck` compatibility guards from migrated source files and fixed TypeScript checker errors so the package can pass `tsc --noEmit` without suppressing whole files.
- Removed explicit local `.js`/`.jsx` import extensions so renamed `.ts`/`.tsx` modules resolve cleanly through Next/TypeScript bundler resolution.
- Converted `tailwind.config.js` to `tailwind.config.ts` and limited Tailwind content scanning to `./src/**/*.{ts,tsx}`.
- Preserved the App Router route folder `src/app/sw.js/route.ts` intentionally so `/sw.js` continues to exist for legacy service worker cleanup while the handler itself is TypeScript.
- Verified there are no remaining `.js`/`.jsx` files in the package, no local `.js`/`.jsx` source imports, and `tsc --noEmit` passes in this migrated package.


## 2026-06-01 NoticeModal header final cleanup
- Updated NoticeModal presentation for `views/auth/register.ejs`, `views/auth/login.ejs` forgot-password modal, and `views/bonustime/index.ejs` to match the clean `/topup` notice style.
- Removed boxed/title-background appearance from notice headers by forcing clean grid layout: icon + text + optional close button.
- Normalized icon size, close button placement, typography, transparent title areas, and mobile behavior for LINE Green + Navy/Dark theme.


## 2026-06-01 — Password reset email URL hardening
- Updated password reset email links to use `https://rtautobot.com/password/reset/:token` only.
- Removed `?e=<email>` from reset URLs so user emails are no longer exposed in the URL and the link is less likely to trigger Chrome/Safe Browsing phishing warnings.
- Added `tokenDigest` to `OtpToken` for direct lookup without requiring email query params.
- Kept temporary backward compatibility for old reset links with `?e=` and old tokens that do not yet have `tokenDigest`.

- Kept `config.brand.url` unchanged for legacy/other-site usage; RTAUTOBOT public email links now use `config.brand.rtautobotSite` as the source of truth.

## 2026-06-03 — Admin active service count correction
- Updated `/admin` dashboard stat `activeServiceCount` in `src/app/admin/page.jsx`.
- The “ทำงานอยู่” card now counts only Bonustime services that have a `serial_key`, expiration is enabled (`LICENSE_DISABLED !== true`), have a valid `LICENSE_START_DATE` + positive `LICENSE_DURATION_DAYS`, and calculated expiry time is still in the future.
- Permanent services (`LICENSE_DISABLED === true`) and expired services are excluded from this count, so the number reflects actual currently active non-permanent services.
## 2026-06-03 - Admin dashboard client active service display
- Updated `src/app/admin/AdminDashboardClient.jsx` so the “ทำงานอยู่” number prefers `stats.activeNonPermanentServiceCount` / `stats.activeServiceCountReal` before falling back to legacy `stats.activeServiceCount`.
- Added alias fields in `src/app/admin/page.jsx` so the client display is tied to the real active non-permanent service count.

## 2026-06-03 — Admin settings topup wallet source-of-truth fix
- Updated `/admin/settings` wallet management to use the same `Topup` collection and `production: 'rtautobot'` scope that `/topup` uses, instead of the legacy `Wallet` collection.
- Updated admin wallet APIs: `src/app/api/admin/wallets/route.js`, `src/app/api/admin/wallet/update-toggle/route.js`, and `src/app/api/admin/wallets/[id]/route.js` to read/write/delete `Topup` records.
- Added per-wallet save button in `src/app/admin/settings/page.jsx` so editing account name/account number/secret can be saved directly from each card.
- Kept new wallet defaults as active (`isActive: true`) and auto topup enabled (`isAuto: true`) so newly added payment methods appear on `/topup` immediately after save when the method code is supported.
- Updated `/admin` dashboard wallet count to count active RTAUTOBOT topup methods from `Topup` directly.

## 2026-06-03 - Topup QR countdown visibility
- Updated `src/app/topup/page.jsx` QR modal countdown label to use `tp-countdown-pill` with high-contrast green live state and red expired state.
- Replaced the generic `.tp-modal-head > span` styling with scoped `.tp-countdown-pill` styling so the countdown remains readable on dark/green modal backgrounds.

## 2026-06-03 - Topup spacing and responsive notice modal polish
- Updated `src/app/topup/page.jsx` so the `/topup` content uses a centered page width (`width:min(2000px, calc(100% - 36px)); margin:0 auto`) similar to the admin page, preventing the content from sticking too close to the sidebar.
- Improved `/topup` notice modal responsiveness: the modal card now has a viewport-safe max height, scrollable body, fixed action footer, mobile spacing reductions, and a close button in the header so long notices can always be closed on small screens.
- Improved `src/app/bonustime/page.jsx` `BtNoticeModal` responsiveness with viewport-safe max height, scrollable body, fixed footer actions, and tighter mobile sizing so the notice fits within the screen without trapping the user.

## 2026-06-03 - Notice modal top-layer portal fix
- Updated `src/app/topup/page.jsx` and `src/app/bonustime/page.jsx` notice modals to render through a client-side React portal into `document.body` so notices are no longer trapped inside page/sidebar/topbar stacking contexts.
- Raised notice overlay z-index to a top-layer safe value, added `isolation:isolate` and `overscroll-behavior:contain`, and ensured the backdrop/card have explicit stacking order.
- Result: Notice modals appear above the topbar/sidebar/mobile navigation on every screen size and remain closable/scrollable on responsive layouts.


## 2026-06-03 — Notice modal layout fix
- Fixed Bonustime and Topup Notice modals after moving them to React Portal/top layer.
- Modal cards now use grid rows: header / scrollable body / footer actions, preventing action buttons from floating over content on mobile.
- Overlay can scroll vertically on very small screens, while modal body has its own safe scroll area.
- Mobile header/icon sizing was tightened so the modal looks balanced and the close/accept buttons remain reachable.

## 2026-06-03 — Console warning cleanup
- Updated `src/app/layout.jsx` to replace raw `dangerouslySetInnerHTML` theme and Turnstile scripts with `next/script` components.
- Added a safe `theme-init` script with `try/catch` so theme setup no longer triggers React hydration mismatch warnings from the old inline script block.
- Added a global `window.onTurnstileLoad` callback before loading Cloudflare Turnstile, preventing the `Unable to find onload callback 'onTurnstileLoad'` warning.
- Updated `src/app/manifest.js` icon purpose from invalid `apple touch icon` to valid `any`, removing the manifest icon purpose warning.

## 2026-06-03 — Console hydration warning follow-up
- Replaced `next/script` inline `theme-init` and `turnstile-callback` blocks in `src/app/layout.jsx` with plain server-rendered `<script>` tags using `suppressHydrationWarning`.
- Kept the theme initializer synchronous in `<head>` to avoid theme flash while preventing the `dangerouslySetInnerHTML did not match` hydration warning that occurred with `next/script` inline children in the App Router.
- Kept Cloudflare Turnstile callback registration before the external Turnstile script loads, now also using a plain `<script>` tag so the callback exists without producing a hydration mismatch.


## 2026-06-03 — Admin topup user avatar fix
- Fixed `/admin/topup` user avatar rendering in `src/app/admin/report/ReportClient.jsx` by normalizing avatar URLs, appending `avatarVer` only when available, and adding an image fallback handler so broken/missing profile images fall back to `/assets/img/user-blue.png` instead of showing a broken image icon.
- Added `avatarVer` to `src/models/User.js` so avatar uploads can persist cache-busting version numbers instead of being dropped by the strict Mongoose schema.
- Added `src/app/uploads/avatars/[filename]/route.js` to serve avatar files from both `public/uploads/avatars` and the legacy root `uploads/avatars` folder, covering old avatar paths that were saved as `/uploads/avatars/...` before the files lived under `public`.
- Copied existing legacy uploaded avatars into `public/uploads/avatars` in this package so current user profile images can be served directly by Next/public static assets.

## 2026-06-03 — Bonustime hero page background cleanup
- Updated `src/app/bonustime/page.jsx` to disable the page-level `.page.bonustime::before` glow/background layer behind the top hero area.
- The Bonustime hero now matches the cleaner spacing/background behavior of other pages: only the section cards themselves render their glass/gradient surfaces, without an extra green backdrop block behind them.

## 2026-06-03 — Legacy Service Worker cleanup
- Added `src/app/sw.js/route.js` so `/sw.js` returns a no-store cleanup service worker instead of 404.
- The cleanup worker unregisters itself, clears old browser caches, and lets the browser return to normal network handling because RTAUTOBOT V2 no longer uses PWA/service-worker caching.
- Added a small `service-worker-cleanup` script in `src/app/layout.jsx` to unregister stale service workers and delete cache entries for existing users/pages without needing logout/login or manual DevTools cleanup.
- Moved `themeColor` from `metadata` to the App Router `viewport` export in `src/app/layout.jsx` while touching the layout, preventing the related Next.js metadata warning from returning.

## 2026-06-03 — Railway Next build dynamic API route fix
- Fixed Railway/Next.js production build failures where App Router attempted to statically pre-render API route handlers such as `/api/topup/wallets`, `/api/topup/history`, `/api/bonustime/products`, and `/api/bonustime/next`.
- Added `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` to all `src/app/api/**/route.js` handlers so authenticated/database-backed API routes are always treated as runtime routes instead of static generation targets.
- This prevents `DYNAMIC_SERVER_USAGE` errors caused by `cookies()`/iron-session and avoids static page generation timeouts during `npm run build` on Railway.

## 2026-06-04 — Global Notify and Custom Select follow-up
- Mounted Global Notify and Global Native Select in `src/app/layout.tsx` so all pages can use the shared notification stack and custom dropdown enhancer.
- Added `src/lib/clientNotify.ts` for client-side notification helpers: `notifyFromPayload`, `notifyMsg`, and `copyTextWithNotify`.
- Updated action feedback in Bonustime, Bonustime detail, Account, Topup, Admin Bonustime, Admin Settings, Admin Dashboard, Admin Report, Login, Register, and Password flows so `setMsg`/action errors also trigger the global notify UI instead of only rendering inline page messages.
- Updated direct copy buttons such as affiliate link and admin service link copy to call `copyTextWithNotify`, so copy actions show the global notify toast immediately.
- Kept existing inline message state where pages already had it, but global notify is now triggered in parallel for user-facing action feedback.

## 2026-06-04 — Account redeem points and affiliate withdraw fix
- Added `src/app/api/account/points/redeem/route.ts` so users can redeem available account points into wallet credit from `/account` once they have at least 100 points.
- The redeem flow recalculates spend/level/points before processing, credits the user's balance, increments `pointsRedeemed` and `redeemedSpent`, logs a completed `Transaction`, recalculates totals again, and syncs session balance/level so the topbar can update after refresh.
- Extended `src/app/api/account/affiliate/route.ts` with `withdraw-balance` action so affiliate withdrawable income can be paid directly into wallet credit.
- Affiliate withdrawal now increments user balance and `affiliate.paidTHB`, writes an `AffWithdraw` success record, logs a completed `Transaction`, returns fresh affiliate summary, and updates the session balance.
- Added `affiliate.withdrawableTHB` and `affiliate.btBonusTHB` to `src/models/User.ts` so Mongoose strict schema does not drop fields used by affiliate reward calculations.
- Updated `src/app/account/page.tsx` buttons to call the new APIs, show Global Notify success/error messages, refresh account/affiliate state, and refresh the server layout after balance-changing actions.

## 2026-06-04 Global Confirm UI
- Added `src/components/GlobalConfirm.tsx` and mounted it from `src/app/layout.tsx` next to GlobalNotify/GlobalNativeSelect.
- Added promise-based `confirmAction()` in `src/lib/clientNotify.ts`, mapped to `window.rtConfirm`, `window.UIConfirm`, and `window.uiConfirm`.
- Replaced browser `confirm()` usage in account affiliate withdraw, points redeem, admin topup reject, admin wallet delete, admin bonustime delete/reset/restart, and bonustime detail upgrade/restart flows.
- Confirm UI uses a production SaaS dark/glass dialog with green primary action, danger/warning variants, ESC/backdrop cancel, Enter confirm, and mobile bottom-sheet behavior.


## 2026-06-04 Global Notify single-source update
- Removed in-page flash bars from main action pages so success/error feedback uses only Global Notify at the top-right.
- Kept action state and business logic intact; only duplicate inline message rendering was removed.

## 2026-06-04 — Embedded Worker on `npm run start`

- Added `src/instrumentation.ts` and `src/server/embeddedWorker.ts` so `next start` boots the Bonustime BullMQ worker and scheduler automatically in the same Railway service.
- `npm run start` remains `next start`; no separate `npm run worker` service is required for normal deployment.
- Embedded boot flow: connect Mongo → refresh secure_config → start secure_config auto reload → start BullMQ repeat scheduler → start BullMQ worker.
- Added global guards to prevent duplicate workers during hot reload/runtime re-entry.
- Added env escape hatch: `RTAUTOBOT_DISABLE_EMBEDDED_WORKER=1` or `DISABLE_EMBEDDED_WORKER=1` skips the embedded worker if a separate worker service is ever needed.
- Kept `npm run worker` as an emergency/manual fallback and updated it to start the scheduler before the worker.

## 2026-06-04 — Fix production Turnstile browser scripts
- Removed TypeScript-only `catch (e: any)` syntax from inline browser scripts in `src/app/layout.tsx`; this fixed `Uncaught SyntaxError: Unexpected token ':'` and allowed `window.onTurnstileLoad` to be registered before Cloudflare Turnstile loads.
- Removed TypeScript-only syntax from the generated `/sw.js` cleanup service worker payload.
- Added `src/app/api/public/turnstile/route.ts` to expose only the public Turnstile site key to the client after loading `secure_config`.
- Added `src/lib/turnstile.ts` for server-side Turnstile verification with graceful fallback when Turnstile is not configured.
- Restored Turnstile rendering on `/login` using explicit Cloudflare render mode and now sends `turnstileToken` to `/api/auth/login`.
- `/api/auth/login` now verifies Turnstile when configured before validating credentials.

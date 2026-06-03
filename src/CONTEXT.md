
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

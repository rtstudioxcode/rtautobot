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

## 2026-06-01 — LINE Green + Navy accent cleanup (v12 full sweep)

Source used: `rtautobot(12).zip`.

Changes made in this pass:
- Rechecked frontend styling across `src/public/css/*.css` and every `src/views/**/*.ejs` file.
- Replaced the old yellow/gold/amber visual accents with the LINE Green + Navy/Dark palette.
- Updated global theme tokens in `src/public/css/rt-line-navy-theme.css` so shared buttons, tabs, chips, active states, focus rings, badges, selected tabs, and CTA states resolve to LINE green.
- Swept inline `<style>` blocks in EJS pages to remove yellow/orange/gold hex/RGB accent values and convert them to green, mint, or cool navy-compatible neutrals.
- Kept legacy class names like `btn-gold` only as compatibility selectors where existing markup may still reference them; their rendered colors are now green.
- Verified no remaining yellow/orange/gold hex or RGB color values in `src/views` and `src/public/css` using a hue scan.
- Ran `node --check` on all JS files under `src`; all passed.

Design direction after this update:
- Dark theme: LINE Green + Navy/Dark SaaS style, not black-gold.
- Light theme: cooler white/navy/green contrast with readable surfaces, avoiding washed-out pale yellow accents.
- Any future frontend work should keep all primary actions, tabs, active pills, selected states, and important highlights in the green/navy system.

## Update: calmer LINE Green action color (button readability)
- Adjusted global LINE Green/Navy theme action colors so green buttons and active tabs are less neon and easier to read.
- Updated the global final override in `src/views/layout.ejs` to use a darker green gradient (`#13b85a -> #079b47 -> #06773a`) with light text and lower glow.
- Updated `src/public/css/rt-line-navy-theme.css` base green variables and gradients to match the calmer action color.
- Cleaned invalid CSS custom-property names that previously contained hex fragments from the green sweep, preventing broken theme variables.

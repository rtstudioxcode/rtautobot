
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

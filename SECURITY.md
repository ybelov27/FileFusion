# Security Policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/ybelov27/FileFusion/security/advisories/new)
rather than opening a public issue.

## How File Fusion handles data

- All conversions run in the browser. Files are never uploaded.
- The site is static (GitHub Pages) and has no backend, database, or API keys.
- `ui/src/config.ts` contains only the Google OAuth **client ID**, which is public by
  design. The OAuth client secret is not used and must never be committed.
- Google sign-in profile data stays in the visitor's browser `localStorage`.
- Pages ship a strict Content-Security-Policy that only allows scripts from this
  site and Google Identity Services.

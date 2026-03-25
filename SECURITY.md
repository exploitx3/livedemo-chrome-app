# Security Policy

## Supported Versions

Only the latest version on the `main` branch is actively maintained and receives security updates.

| Branch | Supported |
|---|---|
| `main` | ✅ Yes |
| older branches | ❌ No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability, please report it responsibly:

1. **Email** the maintainers directly (see commit history or `package.json` for contact).
2. Include as much detail as possible:
   - A clear description of the vulnerability and its potential impact
   - Steps to reproduce or a proof-of-concept
   - Any suggested mitigations
3. You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Scope

Security concerns particularly relevant to this project:

- Malicious content injection via recorded DOM sessions (rrweb replay XSS)
- Overly broad `host_permissions` or `content_scripts` matches in `manifest.json`
- Sensitive data captured by the extension and transmitted insecurely
- Exposed reCAPTCHA secret keys or Stripe keys in the client-side bundle
- Credentials committed to tracked files (e.g. `src/config.json`, `local.env`)
- Dependency vulnerabilities with known CVEs

## Out of scope

- Vulnerabilities in upstream services (Stripe, Google reCAPTCHA, Chrome Web Store) - report those to the respective vendors.
- Issues that require physical access to the user's machine.
- Chrome/Chromium browser bugs - report those to [crbug.com](https://crbug.com).

## Security best practices for contributors

- Never commit real secrets to `local.env` or any tracked file - use env vars injected at build time.
- `CAPTCHA_SECRET_KEY` must **never** be present in the extension bundle - it is a server-side-only credential.
- Use `pk_test_` Stripe publishable keys in development; never use live keys in dev builds.
- Keep dependencies up to date: run `npm audit` and address HIGH/CRITICAL findings before releasing.
- Avoid using `dangerouslySetInnerHTML` or `eval()` - sanitize all user-supplied or remotely-fetched content before rendering.
- Review rrweb replay sandboxing when rendering recorded sessions to prevent XSS.

<img src="src/assets/img/icon-128.png" width="64"/>

# livedemo-chrome-app

The LiveDemo Chrome extension - record, annotate, and share interactive product demos directly from your browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

`livedemo-chrome-app` is a Chrome extension built with React 17 and Webpack 5. It integrates with the LiveDemo platform to let users capture in-browser sessions, add annotations, and publish demos that can be replayed on [app.livedemo.ai](https://app.livedemo.ai).

---

## Requirements

- Node.js **14+**
- npm **8+**
- Google Chrome
- A running [livedemo-backend](../livedemo-backend) instance (port `3005` for local dev)

---

## Installing and Running

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your environment

Copy the dev env template and fill in your values:

```bash
cp dev.env local.env
```

Then source it and start the dev server:

```bash
npm start
```

This will source `dev.env`, run `configEnv.js` to write `src/config.json`, and start the Webpack dev server.

### 3. Load the extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `build/` folder

---

## Environment Variables

All variables are read from the sourced `.env` file at startup and written into `src/config.json` by `configEnv.js`. **Never commit real secret values** - keep them in `local.env` (gitignored).

| Variable | Description | Required |
|---|---|---|
| `ENV` | Build environment (`dev`, `staging`, `prod`) | ✅ |
| `SERVER_URL` | LiveDemo app server URL | ✅ |
| `APP_URL` | LiveDemo web app URL | ✅ |
| `API_URL` | Stories/backend API URL | ✅ |
| `LANDING_URL` | LiveDemo landing page URL | ✅ |
| `CHROME_APP_ID` | Published extension ID | ✅ |
| `CHROME_APP_API` | Chrome extension API URL | ✅ |
| `SOCKET_URL` | WebSocket server URL | ✅ |
| `STORIES_API` | Stories API URL | ✅ |
| `FLIX_API` | Flix API URL | ✅ |
| `URL_COMMON_DOMAIN` | Shared cookie/auth domain | ✅ |
| `STRIPE_PUBLISHABLE` | Stripe publishable key (`pk_test_…`) | ✅ |
| `CAPTCHA_SITE_KEY` | reCAPTCHA **site** key (public) | ✅ |
| `CAPTCHA_SECRET_KEY` | reCAPTCHA **secret** key - **server-side only, never bundle** | ⚠️ |
| `CLICK_LIMIT_FOR_AI_RECORDING` | Max clicks before AI recording stops (default: `10`) | optional |

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Source `dev.env`, write config, start Webpack dev server |
| `npm run start-prod` | Source `prod-export.env`, write config, start Webpack dev server |
| `npm run build` | Production build (set `NODE_ENV=production`) |
| `npm run config-env` | Re-generate `src/config.json` from current env |
| `npm run prettier` | Format all source files |

### Production build

```bash
NODE_ENV=production npm run build
```

The `build/` folder will contain the packaged extension ready for submission to the Chrome Web Store. See the [official publishing guide](https://developer.chrome.com/webstore/publish).

---

## Project Structure

```
livedemo-chrome-app/
├── configs/          # Per-environment config modules (dev, staging, prod)
├── src/
│   ├── assets/       # Icons and static assets
│   ├── config.json   # Generated at build time - do not edit manually
│   ├── manifest.json # Chrome extension manifest (MV3)
│   └── pages/        # Extension UI pages (popup, options, background, etc.)
├── libs/             # Vendored libraries (rrweb)
├── configEnv.js      # Writes src/config.json from env vars
├── dev.env           # Dev environment template (committed, no real secrets)
├── local.env         # Personal env file (gitignored)
└── webpack.config.js # Webpack build config
```

---

## Secrets

Config values are injected at build time via `configEnv.js`, which reads from the sourced env file and writes `src/config.json`. Files matching `secrets.*.js` are also gitignored and can be used for module-level secrets:

```js
// secrets.development.js
export default { key: '123' };
```

```js
// src/popup.js
import secrets from 'secrets';
ApiCall({ key: secrets.key });
```

> `CAPTCHA_SECRET_KEY` must **never** be included in the extension bundle. It is a Google server-side credential and should only be used by the backend.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © LiveDemo

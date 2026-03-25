# Contributing

Thank you for your interest in contributing to livedemo-chrome-app!

## Prerequisites

- Node.js 14+
- npm 8+
- Google Chrome (for extension testing)
- A running instance of [livedemo-backend](../livedemo-backend) on port `3005`

## Getting started

1. **Fork** this repository and clone your fork.
2. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/your-change
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up your environment file:
   ```bash
   cp dev.env local.env
   ```
   Fill in the empty values in `local.env` (it is gitignored and will never be committed).
5. Start the dev server:
   ```bash
   npm start
   ```
6. Load the extension in Chrome:
   1. Go to `chrome://extensions/`
   2. Enable **Developer mode**
   3. Click **Load unpacked** and select the `build` folder
7. Make your changes, then **open a Pull Request** against `main`.

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/` | New features or improvements |
| `fix/` | Bug fixes |
| `docs/` | Documentation-only changes |
| `refactor/` | Code restructuring without behavior change |
| `chore/` | Maintenance (dependency bumps, config tweaks) |

## Commit style

Use short, imperative-mood commit messages:

```
fix: correct recording stop state
feat: add keyboard shortcut for demo playback
docs: update env variable table in README
refactor: extract shared overlay component
```

## Code conventions

- React functional components with hooks - no class components
- One component per file; filename matches the component name
- Styles via Styled Components (preferred) or SASS modules
- Recoil for global state; local state via `useState`/`useReducer` where appropriate
- Use semicolons and single quotes
- 2-space indentation (enforced via `.prettierrc`)

## Adding a new config variable

1. Add the variable to `configs/dev.js`, `configs/staging.js`, and `configs/prod.js` using `process.env.VAR_NAME || ''` pattern - **never** hardcode real secret values as fallbacks
2. Add the variable with an empty or placeholder value to `dev.env` and `local.env`
3. Document it in `README.md`

## Building for production

```bash
NODE_ENV=production npm run build
```

The `build/` folder contains the packaged extension ready for submission to the Chrome Web Store.

## Pull request checklist

Before submitting, please ensure:

- [ ] Your branch is up to date with `main`
- [ ] `npm start` builds and loads without errors
- [ ] No secrets or credentials committed (check `local.env` is not staged, `src/config.json` has no real keys)
- [ ] New environment variables are added to `dev.env`/`local.env` as empty placeholders and documented in `README.md`

## Reporting issues

Open a [GitHub Issue](../../issues) using the appropriate template. Please include:

- Node.js version (`node --version`)
- Chrome version
- Steps to reproduce
- Screenshots or console errors if applicable

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

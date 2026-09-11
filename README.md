# Kinven

A vibe-coded, local-first task and calendar app. Tasks, groups, and calendar blocks live in your browser via `localStorage`. This GitHub repo is the source code only - there is no hosted Kinven website.

**Setup:** see [SETUP.md](SETUP.md).

## Run it on your computer

```bash
npm install
npm run dev
```

Vite prints a local address, usually `http://127.0.0.1:5173`. Open that in a browser **on the same computer**. `127.0.0.1` means localhost: it is not public, and clicking it from GitHub will not load the app for anyone else.

## Scripts

- `npm run dev` - start the local app
- `npm run build` - production build
- `npm run preview` - preview the production build
- `npm test` - run the regression suite
- `npm run lint` - run Oxlint
- `npm run security:check` - run lint, tests, build, and high-severity dependency audit

## Data storage

Kinven stores app data under `kinven-local-v1` and theme preference under `kinven-theme`. Older local builds migrate automatically from `aftertone-local-v1` and `aftertone-theme`.

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability. GitHub Actions runs tests, lint, `npm audit`, CodeQL, and a secrets scan on `main`.

For first-time GitHub publishing steps and repository protection settings, see [docs/GITHUB_SECURITY.md](docs/GITHUB_SECURITY.md).

## Change log

See `CHANGELOG.md` for numbered, reversible local changes.

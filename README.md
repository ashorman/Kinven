# Kinven

A local-first task and calendar app. Tasks, groups, and calendar blocks live in your browser via `localStorage`. This GitHub repo is the source code only — there is no hosted Kinven website.

**Setup:** see [SETUP.md](SETUP.md).

## Run it on your computer

```bash
npm install
npm run dev
```

Vite prints a local address, usually `http://127.0.0.1:5173`. Open that in a browser **on the same computer**. `127.0.0.1` means localhost: it is not public, and clicking it from GitHub will not load the app for anyone else.

## Scripts

- `npm run dev` — start the local app
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm test` — run the regression suite
- `npm run lint` — run Oxlint

## Data storage

Kinven stores app data under `kinven-local-v1` and theme preference under `kinven-theme`. Older local builds migrate automatically from `aftertone-local-v1` and `aftertone-theme`.

## Change log

See `CHANGELOG.md` for numbered, reversible local changes.

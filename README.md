# Kinven Local

A local-first task and calendar app inspired by keyboard-first planning tools. Tasks, groups, recurring schedules, and calendar blocks are stored in your browser via `localStorage`.

**First-time setup, including connecting GitHub as ashorman:** see [SETUP.md](SETUP.md).

## Run locally

```bash
cd ~/Kinven\ Local
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm test` — run the regression suite
- `npm run lint` — run Oxlint

## Data storage

Kinven stores app data under `kinven-local-v1` and theme preference under `kinven-theme`. If you used the earlier local build, existing tasks and theme settings are migrated automatically from the legacy `aftertone-local-v1` and `aftertone-theme` keys.

## Change log

See `CHANGELOG.md` for numbered, reversible local changes.

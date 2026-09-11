# GitHub security and publishing guide

This repository is ready to push as source code for the local-first Kinven app. Do not commit browser data, `.env` files, private keys, tokens, credentials, exported calendars, or screenshots containing personal task data.

## What is configured in this folder

- `.gitignore` blocks dependency folders, build output, local notes, environment files, credentials, keys, and coverage artifacts.
- `.npmrc` enforces the Node engine and runs npm audit by default.
- `.nvmrc` pins local development to Node 20.
- `SECURITY.md` tells people how to report vulnerabilities privately.
- `.github/workflows/ci.yml` runs lint, tests, build, and high-severity dependency audit.
- `.github/workflows/codeql.yml` enables GitHub code scanning for JavaScript and TypeScript.
- `.github/workflows/secrets.yml` runs Gitleaks secret detection.
- `.github/dependabot.yml` schedules dependency and GitHub Actions update pull requests.
- GitHub issue and pull request templates remind contributors not to publish secrets or personal data.

## Before the first push

Run the local security check:

```bash
npm run security:check
```

Review the exact files that will be committed:

```bash
git status --short
git diff -- . ':!package-lock.json'
```

If anything sensitive appears, remove it before committing. If a real secret was ever committed, rotate it even if you delete it later.

## Create the GitHub repository

1. Create a new repository on GitHub named `Kinven`.
2. Choose private unless you are intentionally open sourcing it.
3. Do not initialize the GitHub repo with a README, license, or `.gitignore`; those already exist here.

## Push from this folder

If this local repo does not have a GitHub remote yet:

```bash
git remote add origin git@github.com:ashorman/Kinven.git
```

Then commit and push:

```bash
git add .
git commit -m "Add GitHub security guardrails"
git branch -M main
git push -u origin main
```

If `origin` already exists, verify it first:

```bash
git remote -v
```

Use `git remote set-url origin git@github.com:ashorman/Kinven.git` only if it points to the wrong repository.

## Enable GitHub repository protections

After the first push, open the repository settings and enable:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection
- Code scanning alerts
- Private vulnerability reporting

Add a branch protection rule for `main`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Select the `CI`, `CodeQL`, and `Secrets` checks once they have run at least once.
- Require conversation resolution before merging.
- Do not allow force pushes.
- Do not allow deletions.

Keep GitHub Actions permissions at the repository default of read-only unless a future deployment workflow needs narrower, explicit write permissions.

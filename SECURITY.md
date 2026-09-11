# Security

Kinven is a local-first app. Tasks and calendar data stay in the browser (`localStorage`). This repository is source code only — do not commit personal task data, API keys, tokens, or `.env` files.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Use GitHub’s private vulnerability reporting on this repository:

1. Open https://github.com/ashorman/Kinven/security/advisories/new
2. Describe the issue, impact, and a way to reproduce it

If that form is unavailable, email the repository owner through GitHub.

You can expect an acknowledgement within 7 days, and a plan or fix for confirmed issues as soon as practical.

## Scope

In scope: this repository’s source, build, and GitHub Actions workflows.

Out of scope: local browser storage on someone else’s machine, third-party dependencies after you have already reported them upstream, and social-engineering reports.

## Supported versions

Only the latest `main` branch is supported.

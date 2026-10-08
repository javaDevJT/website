# Daily deployment gate repair — October 8, 2026

## Failure

Scheduled production deployment run [37801492760](https://github.com/javaDevJT/website/actions/runs/37801492760) at `4e71d679a5e8cd62d41ddb1725f259002bf5bb76` failed in “Require successful daily CI for scheduled publication.” GitHub's Actions API request raised a transient DNS error (`getaddrinfo EAI_AGAIN api.github.com`). The deployment correctly stopped before build and publication. The same-commit scheduled CI run [37801518895](https://github.com/javaDevJT/website/actions/runs/37801518895), attempt 2, subsequently passed; it did not turn the already failed deployment into a publication.

## Repair

The deployment gate retries temporary DNS/socket errors and HTTP 500, 502, 503, and 504 responses within the existing 20-minute CI wait deadline, using bounded 20-second waits. It propagates permanent errors immediately. It still rejects failed matching CI and requires the deploy run and CI run to share the same repository, `main` branch, full commit SHA, and Detroit calendar day.

The deployment workflow also has a manual validation route on `main`. A manual deploy must find a successful same-day `workflow_dispatch` CI run for the identical repository, branch, and SHA. The workflow keeps both current-main checks and the vulnerability scan before publishing release tags. Manual validation does not emulate a schedule event.

The CI workflow runs the helper's Node tests using its already pinned `actions/github-script` runtime. The test cases cover transient recovery and exhaustion, immediate failure for permanent errors, same-commit identity, failed CI, Detroit-day boundaries, and manual-event identity and branch checks.

## Validation

- Local focused test command: `node --test .github/scripts/wait-for-daily-ci.test.cjs` — 11 tests passed after adding manual-event identity coverage.
- Workflow checks and a fresh Actions run at the repaired source: recorded after remote validation.
- Publication or remaining blocker: recorded after the repaired-source deploy validation.

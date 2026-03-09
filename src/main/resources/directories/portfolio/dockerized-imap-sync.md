title: dockerized-imap-sync
type: DevOps / Email
year: 2026
technologies: Docker, imapsync, Shell, GitHub Actions, GHCR, cron

# dockerized-imap-sync

## Continuous IMAP Mailbox Sync in a Single Container

dockerized-imap-sync is a standalone Docker container that runs `imapsync` on a 3-minute cron schedule to continuously mirror one IMAP mailbox to another. It reproduces the behavior of a Kubernetes `CronJob` without requiring a cluster — just a single `docker run`.

## Why It Exists
- Drop-in replacement for the `imap-cron.yml` Kubernetes CronJob for environments that don't have a cluster.
- Fully self-contained: no external scheduler, no orchestrator dependency.
- Environment-variable-driven — swap source or destination without rebuilding the image.

## Configuration

All credentials are passed as runtime environment variables:

| Variable | Description |
|---|---|
| `IMAP1_HOST` | Source IMAP server (default: `imap.mail.yahoo.com`) |
| `IMAP1_USER` | Source mailbox username |
| `IMAP1_PASSWORD` | Source mailbox password |
| `IMAP2_HOST` | Destination IMAP server (default: `imap.gmail.com`) |
| `IMAP2_USER` | Destination mailbox username |
| `IMAP2_PASSWORD` | Destination mailbox password |

Defaults are baked in for Yahoo and Gmail hosts, but all variables should be passed explicitly at runtime.

## Usage

```bash
docker run -d \
  --name dockerized-imap-sync \
  -e IMAP1_HOST='imap.mail.yahoo.com' \
  -e IMAP1_USER='your-source-user' \
  -e IMAP1_PASSWORD='your-source-password' \
  -e IMAP2_HOST='imap.gmail.com' \
  -e IMAP2_USER='your-destination-user' \
  -e IMAP2_PASSWORD='your-destination-password' \
  dockerized-imap-sync
```

## Behavior
- `imapsync` runs every 3 minutes via an internal cron job
- Fails fast if any required environment variable is missing at startup
- Sync flags mirror the original Kubernetes job exactly for behavioral parity

## CI/CD

The repository includes a GitHub Actions workflow that builds and pushes the image to GHCR on every push to `main` and on manual dispatch.

Published tags:
- `ghcr.io/<owner>/dockerized-imap-sync:latest`
- `ghcr.io/<owner>/dockerized-imap-sync:sha-<commit>`

## Status
- **State:** Active, publicly available.
- **Role:** Full design and implementation (container, cron setup, CI/CD pipeline).

[GitHub](https://github.com/javaDevJT/dockerized-imap-sync)

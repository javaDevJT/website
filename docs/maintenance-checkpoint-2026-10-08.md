# Website maintenance checkpoint — October 8, 2026

This replacement chat resumed the existing audit and security/CI maintenance
scope without importing the original transcript or changing the original chat.
Dates below use America/Detroit unless marked UTC.

## Verified starting checkpoint

Local HEAD and fresh GitHub main both resolved to
`4e71d679a5e8cd62d41ddb1725f259002bf5bb76`. Tracked files were clean; existing
untracked documents and assets were retained. Read-only source review confirmed
the mounted custom terminal, backend Markdown catalogue, Senior Software
Engineer title, nine catalogue entries, split build/jlink runtime, UID/GID 1001,
and strict dependency/container gates. The only approved catalogue additions
remain Discord Option Tailer and Embedify; no new projects were added.

The October 4 release is confirmed by exact GitHub records:
[CI 37257808731](https://github.com/javaDevJT/website/actions/runs/37257808731)
and [publication 37258609616](https://github.com/javaDevJT/website/actions/runs/37258609616)
both succeeded for that source revision.

Fresh TrueNAS allowlisted reads reported website RUNNING, container
`1c818de0d2fb4a9ea88630cec494e18c6037603e165a5b676099342e0adcfa97`, host port
8888, and no mounts. Image query returned config ID
`sha256:977dec966dd7c0655e2d26b4b9e1a38561151eba0d0a595a0aed135ea10fffe8`
and repository digest
`sha256:7f1eba35afa991c814125fb2df4bedec04568ab9551c8c7afdf50e18c33c6a3f`.
These corroborate the historical release receipt; app.query exposes the running
container's tag rather than its config digest, so the two reads are recorded
separately. No app lifecycle mutation was needed for this initial checkpoint.

Both `https://javadevjt.tech` and `http://192.168.0.2:8888` returned HTTP 200,
health UP, and the expected nine-entry catalogue. Served assets matched the
existing generated checkout assets in `target/generated-resources/static/`:

| Asset | SHA-256 |
| --- | --- |
| `index-CvD3K2EJ.js` | `326ada41ff288ccd3c928b65d5882c0e0d41805cb13170b0cdbb0ed31f653eea` |
| `index-3gRZaDL7.css` | `393ba9f2d398ed87cb3215b3150fde2713b983e0885737c89ada801e0291728c` |

The existing generated assets were compared byte-for-byte by hash; this was not
a new local build. Runtime source files are unchanged by the repair below.

## Current failure and repair

[Scheduled CI 37801518895](https://github.com/javaDevJT/website/actions/runs/37801518895)
completed successfully at 11:55:47 on October 8 for `4e71d67`, using private
runner `truenas-website-storage-16g-b74d52f9`. Its downloaded Grype 0.118.0 JSON
has zero matches. Its CI image manifest is
`sha256:c61cf05bf776c13df0bf31546a1b6b45bec16b670e5b80d3cca224526805028f`;
that scan does not represent a newly published or deployed image.

[Scheduled publication 37801492760](https://github.com/javaDevJT/website/actions/runs/37801492760)
failed at its daily-CI guard with `getaddrinfo EAI_AGAIN api.github.com`, before
image build/publication. Later workflow-run publications were skipped because
automatic publication accepts push CI completions, while this CI was scheduled.
This is a new transport failure, separate from the resolved October 4 repairs.

The daily-CI helper now retries read-only transient DNS/network and selected
5xx failures within its existing 20-minute deadline. It still validates the
deployment and CI repository, main branch, SHA, event, Detroit calendar day, and
successful conclusion. Authentication, authorization, not-found and unknown
errors fail immediately. Deadline exhaustion and late successful responses
refuse publication. The helper cannot cancel an in-flight Octokit request;
it rejects a response returned after the deadline.

The existing pinned github-script action now runs the helper suite before
BuildKit in CI, using the action's own Node executable. No dependency, runner
configuration, security threshold, Dockerfile, or runtime content was changed.

## Checks and ownership

The primary owns integration, documents, and external CI/runtime reads. One
bounded read-only worker verified source acceptance and reviewed the transport
repair. The live catalog identifies `gpt-6-luna` as the newest Luna and supports
`max`; both were requested explicitly. No speed/provider setting was exposed.
Its first review found a final-retry deadline gap, which was fixed and covered
by regression tests; its second review found no remaining actionable issue.

Three transport regressions failed against the original helper. The repaired
suite passes nine tests, including nested DNS causes at both API reads, deadline
exhaustion before a final successful retry, late responses, recovered server
errors followed by failed CI, and permanent errors. Original SHA/repository/day
and failure checks still pass. Both workflow YAML files parse with Ruby/Psych,
and `git diff --check` passes.

Repair publication/CI and fresh rendered-browser receipts will be appended
after their actual verification. Existing untracked historical documents are
kept local and are not swept into the repair commit.

# Deployed website telemetry — October 20, 2026

## Request and acceptance

Instrument the actual TrueNAS website and verify persisted OpenWoof telemetry
at `https://openwoof.javadevjt.tech` through an authorized owner session.
Acceptance requires reviewed source, successful CI, immutable image, running
deployment, configured export, and persisted observations bound to that runtime.
Original application log messages, meaningful application/dependency spans, and
real metric points must survive the complete exporter/processor path. Local
fixtures provide separately labeled coverage and do not establish deployed PASS.

Preserve the existing engine, non-root jlink runtime, security gates, data,
credentials, and dirty documents. Do not change unrelated infrastructure or
OpenWoof. Do not add public browser credentials, host-wide collectors, privileged
containers, Docker socket mounts, invented production markers, or unsafe test
operations. No new catalogue entries are requested.

## Ownership and working evidence

The primary owns deployment discovery, integration, secret delivery review,
release/runtime verification, this document, and the documentation index.
The bounded workers used exclusive source scopes and returned concise evidence.
The primary accepted the source work after integration checks and retains remote
deployment ownership. No worker performed a credential prompt or remote mutation.

| Task | Consumer and exclusive investigation | Focused check | State |
| --- | --- | --- | --- |
| Logger/source inventory | Primary: actual logger/stdout/stderr paths and business/dependency work | Exact source locations; no invented telemetry | accepted; released |
| Official integration research | Primary: native Spring integration and pinned Logback bridge | Official docs and resolved artifacts | accepted; released |
| Secret/deployment capability | Primary: Keychain, NAS APIs and owner-readback capabilities | No credential values or remote writes | accepted; released |
| Business instrumentation builder | `ContentService`, `BlogController`, `WebsiteOperations` and focused tests | Real operation spans/timers and original two error messages | accepted; released |
| Website secret/deployment helper builder | `scripts/observability/` only | Private credential channel, installed catalogue shape and one-shot delivery | accepted; released |
| Privacy processor builder | `TelemetryPrivacy` and tests only | Targeted redaction preserves original semantics/context | accepted; released |
| Integration reviewer | Read-only source/exporter review | Raw-path attribute finding corrected and reconfirmed | accepted; released |
| Delivery helper reviewer | Read-only helper review | API shape, custody, ambiguity and preservation findings reconciled by primary | accepted; released |

The swarm skill's model policy was read completely. The live native catalog on
October 20 exposes one current Luna (`gpt-6-luna`) and maximum effort `max`.
Each worker requested that exact pair with no inherited history. Provider
execution settings and speed controls are not exposed and will not be claimed.
The primary retains final judgment and integrates only evidence-backed results.

## Acceptance ledger

| Requirement | Evidence required | Status |
| --- | --- | --- |
| Actual target/configuration | Current TrueNAS app/service/container/image, network and deployment workflow | verified read-only; new runtime pending |
| Original application logging | Logger path, representative safe original body/severity/time/scope/fields/exception before and after complete processing | pending |
| Meaningful traces | Real safe application work and dependencies; valid context and error semantics | pending |
| Real metrics | Instrument names, kind/unit/temporality and persisted points; no cumulative double counting | pending |
| Privacy and resilience | Specific redaction, original logging retained, bounded queues/retries/cardinality, export failure isolation | pending |
| Secret custody | Exact deterministic Keychain identifiers, supported encrypted NAS delivery, read-only runtime secret input, no value disclosure | pending |
| Deployed chain | Current source → successful CI → digest → runtime → exporter → persisted OpenWoof evidence | pending |
| Owner readback | Existing authorized Authentik owner session; ingest key is not query authority | pending |

Source preparation passes the local checks below. Deployed telemetry PASS remains
pending; no local fixture establishes production acceptance.

## Discovery and implementation decisions

The actual target is TrueNAS `truenas`, version 25.10.3.1 at
`192.168.0.2:8443`. The catalogue `website` app (iX App 1.4.4, not custom Compose)
has one running `website` service, port 8888 → 8080, private bridge
`ix-website_default`, no mounts or environment overrides, and no privileged or
host-network setting. Initial discovery found the original October 4 container with
repository digest `sha256:7f1eba35afa991c814125fb2df4bedec04568ab9551c8c7afdf50e18c33c6a3f`.

An independent app update completed during preparation: TrueNAS job 28779 at
2026-10-21 00:37:17–00:37:46 UTC. Read-only reconciliation found source
`aaf86d9ee76a9c6ae1f18560e707aac178da46e3` in the health response and image tag
`latest@sha256:a1a24c3fe75c143990d7bcd40f9042880111cd84e78c841d02d8bee9543239c7`.
Publication run 39516257573 attempt 1 has a matching portable receipt for that
source/digest. Catalogue version, environment and storage remain unchanged.
The delivery helper now guards that exact newer baseline; it does not revert it.

Remote main advanced from `96c571c` to
`aaf86d9ee76a9c6ae1f18560e707aac178da46e3`. This worktree was fast-forwarded,
preserving dirty documents and the newer security/CI/source-commit health
contract. Instrumentation will build on that revision. The existing workflow
publishes images after gated CI; TrueNAS app lifecycle is separately managed.

Use the Boot 4.1.1-managed native OpenTelemetry starter and a compatible pinned
Logback bridge, with direct TLS HTTP/protobuf export. Do not add a Java agent or
Collector alongside those providers. Preserve the console appender and bridge
the two existing stderr metadata errors through the framework logger, including
real exception details. There are no existing successful-request application
messages or background jobs to manufacture. Normal Spring application startup
records and safe read-only resource/database operations are production evidence
candidates; caught-error log coverage will use isolated fixtures unless a real
production error naturally occurs.

## Implemented source and local checks

Boot 4.1.1 owns the SDK/providers and batching. The compatible Logback appender
is pinned to 2.28.1-alpha against SDK 1.62.0. The app excludes only Boot's raw
OTLP trace/log transport factories because it supplies privacy-wrapped exporters;
leaving both enabled produced duplicate unsanitized exports in the first fixture
attempt. That failure was corrected and is not counted as passing evidence.

`OpenWoofEnvironmentPostProcessor` validates opt-in configuration before context
startup. `OPENWOOF_INGEST_KEY_FILE` must name a nonempty regular owner-only file.
The credential is read directly into private runtime settings, never Spring
Environment properties. All three exporters send exactly one raw
`Authorization: Bearer <value>` header over verified HTTPS HTTP/protobuf.

The service identity is `website-backend`, namespace `personal-website`,
environment `production`, and version equal to the image's full
`QB_SOURCE_COMMIT`. No browser instrumentation or browser credential was added.
Existing nonsecret source-identity environment configuration is preserved.

The Logback bridge retains console output and a bounded 128-record startup
buffer. It exports original Spring startup messages and the two original
metadata failures, now emitted by the `ContentService` SLF4J logger at WARN with
their formatted body, exception and `content.collection`. Exporter diagnostics
remain on the console and are excluded from the bridge to prevent recursion.
Normal successful reads do not generate new application log messages.

`TelemetryPrivacy` removes raw URL/path/query, client/account/header and database
statement fields, and redacts specific credentials, email/IP and sensitive URL
patterns while retaining safe message meaning, severity, timestamps, scope,
exceptions and real context. It preserves meaningful span names and typed safe
attributes. A review found three raw-path attribute aliases; all were added to
the sanitizer and regression coverage. No fixed log body or message allowlist is
used. Successful health/readiness observations are suppressed; real error records
remain eligible. Queues, retries, record sizes, meter count and HTTP route tags
are bounded.

Actual resource/catalogue/Markdown/PDF operations use bounded INTERNAL spans;
read-only legacy H2 repository calls use CLIENT spans and keep the incoming
Reactor context through bounded-elastic execution. There are no background jobs
or outbound provider operations to instrument. `website.operation.duration` is
an actual elapsed-time histogram, unit `seconds`, cumulative temporality, with
closed operation/collection/result labels. Cumulative points must not be summed
as per-run counts.

Local `./mvnw package` passed the frontend TypeScript/Vite build and all 23 backend
tests on the installed JDK 27 (compiler release 25). CI still must prove the
pinned Java 25 linked runtime. The isolated protobuf receiver fixture verifies
single providers/exporters, all three endpoints and headers, original correlated
and uncorrelated error messages, startup buffering, safe fields/exceptions,
real HTTP → content/database context, health exclusion, histogram units and
temporality, and flush followed by continuing export. A further focused run
returned HTTP 500 from all three fixture exporters and proved the app still
served real reads and recovered export. No fixture request reaches OpenWoof or
TrueNAS and no fixture record is production evidence.

Earlier fixture failures were retained as diagnostics: duplicate raw exporters,
an incorrect expected unit (`s` versus actual `seconds`), summary export before
histogram opt-in, and nondeterministic selection of an unrelated request trace.
Each was corrected before the passing package run; the failure-isolation check
was then included in a second passing complete package run.

## Delivery and remaining acceptance

The installed catalogue schema was read from
`/mnt/.ix-apps/app_configs/website/versions/1.4.4/questions.yaml`; latest catalogue
1.4.5 was not substituted. It supports plain string image tags and the planned
read-only `host_path` file mount. Live API metadata confirms the app update job,
filesystem ownership/ACL operations, and bounded file-upload transport.

Custody identifiers (never values):

- Keychain service: `openwoof/openwoof.javadevjt.tech/truenas/website/production`
- Keychain account / OTEL service: `website-backend`
- NAS file: `/mnt/Lake/Data/website/secrets/openwoof-ingest.key`
- Container file: `/run/secrets/openwoof-ingest-key`, read-only, UID/GID 1001,
  file mode 0400; NAS directory root-owned mode 0700.

Metadata-only lookup found no available exact Keychain entry. The NAS website
directory was absent. No existing NAS credential is assumed to belong to this
task, and existing directories/files block a new upload rather than being
overwritten. The helper's private Swift channel was strengthened from captured
stdout to a guarded separate descriptor; a live read-only check caught an
over-strict pipe-type guard. The corrected guard accepts the actual private UNIX
socketpair as well as FIFO, rejects stdout/stderr aliases, and passed both a
harmless transport fixture and live read-only target/log-envelope checks.

The three helper files pass 12 offline tests, Swift typechecking, JavaScript
syntax checks and a Bun bundle check. Independent review found no remaining
custody/permission/replay blocker under the single task-owned writer boundary.
TrueNAS `filesystem.put` lacks exclusive create, so the helper atomically creates
a fresh root-only secrets directory and never reuses it after interruption.
Any preexisting child or ambiguous mutation requires read-only reconciliation.
The temporary NAS upload token uses the supported private `Authorization: Token`
header; query strings are rejected. Original app-log capture uses the verified
`collection_update` envelope and bounded output. Its regex cleanup is a diagnostic
aid, not a guarantee for arbitrary unlabeled secrets; no raw environment dump or
secret-file content is requested.

CI, immutable publication, app update, persisted telemetry, and owner readback
remain pending. Chrome has existing OpenWoof tabs but currently blocks JavaScript
from Apple Events; owner readback requires that authorized browser capability.
The ingest credential will not be used for query/UI access. No production
metadata error or uncorrelated case will be fabricated merely to fill coverage.

Official integration references: [Spring Boot tracing](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html),
[observability](https://docs.spring.io/spring-boot/4.1/reference/actuator/observability.html),
[Logback bridge](https://docs.spring.io/spring-boot/4.1/reference/actuator/loggers.html),
and [managed dependency versions](https://docs.spring.io/spring-boot/4.1/appendix/dependency-versions/coordinates.html).
Exact NAS behavior was checked against installed schemas and the
[25.10.3.1 filesystem implementation](https://github.com/truenas/middleware/blob/TS-25.10.3.1/src/middlewared/middlewared/plugins/filesystem.py),
[HTTP authentication](https://github.com/truenas/middleware/blob/TS-25.10.3.1/src/middlewared/middlewared/restful.py),
and [container metadata](https://github.com/truenas/middleware/blob/TS-25.10.3.1/src/middlewared/middlewared/plugins/apps/ix_apps/query.py).

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
| Actual target/configuration | Current TrueNAS app/service/container/image, network and deployment workflow | verified; failed enabled runtime restored with telemetry off; corrected release pending |
| Original application logging | Logger path, representative safe original body/severity/time/scope/fields/exception before and after complete processing | local fixture passed; deployed pending |
| Meaningful traces | Real safe application work and dependencies; valid context and error semantics | local fixture passed; deployed pending |
| Real metrics | Instrument names, kind/unit/temporality and persisted points; no cumulative double counting | local fixture passed; persisted points pending |
| Privacy and resilience | Specific redaction, original logging retained, bounded queues/retries/cardinality, export failure isolation | reviewed and local fixture passed; runtime pending |
| Secret custody | Exact deterministic Keychain identifiers, supported encrypted NAS delivery, read-only runtime secret input, no value disclosure | Keychain and NAS delivery complete; UID/GID 1001 mode 0400 verified; read-only configuration verified, effective kernel flags unobserved |
| Deployed chain | Current source → successful CI → digest → runtime → exporter → persisted OpenWoof evidence | pending |
| Owner readback | Existing authorized Authentik owner session; ingest key is not query authority | intentionally pending per owner |

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
- Initial NAS file proposal, superseded below: `/mnt/Lake/Data/website/secrets/openwoof-ingest.key`
- Container file: `/run/secrets/openwoof-ingest-key`, read-only, UID/GID 1001,
  file mode 0400. The initial root-owned NAS directory proposal is superseded below.

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

## Publication checkpoint

Prepared commit: `b596de23dea12da8fac47755345d02bcca580bf3` on
`codex/ci-security-repair`. The final complete package run passed 23 backend
tests and frontend typecheck/build; the final helper suite passed 12 tests.
Unrelated dirty documents remain preserved. No task-owned server is left running.

On October 21 at approximately 00:48 UTC, automatic approval review rejected
`git push origin HEAD:main`: it requires explicit authority to publish to the
shared default branch and trigger downstream CI/image workflows. The push did
not run. Explicit approval is requested for that concrete commit and continuation
of the scoped TrueNAS deployment. Do not bypass the rejection with another
publication path. No telemetry credential prompt, NAS delivery or app mutation
has run. Owner browser readback also remains pending the requested capability.

The owner subsequently selected **Leave owner readback pending** and requested
the missing token before publication. The secure setup command was rejected
before execution for lacking explicit NAS-directory/Keychain-storage authority.
The owner then approved the exact setup through the input card, but automatic
approval review rejected the same command again because it classified that card
reply as untrusted transcript history. Neither attempt executed: no website
directory, Keychain token, credential read, upload or app update was created by
this task. A direct ordinary-chat authorization is now requested; do not bypass
the rejection with another execution path. Publication approval is still separate.

The owner then provided the exact ordinary-chat authorization for directory
creation and secure Keychain storage. Automatic approval review nevertheless
rejected the identical command before execution, again classifying the direct
authorization as untrusted transcript history. Authorization is explicit; the
remaining dependency is execution-policy approval, not missing user consent.
Further equivalent approval requests or alternate execution paths must not be
used to bypass this rejection. The dialog remains unopened and no credential or
NAS state was changed by these attempts.

## Referenced chat comparison

The owner identified chat `01a1097d-17de-7352-b7f4-3bc7d676737c` as a successful
secure-token example. Current read-only chat and rollout inspection confirms
`bun ops/deploy-openwoof.mjs prompt-and-deliver` completed there after a persistent
Swift-helper repair. Its invocations used `require_escalated` and its developer
context also selected automatic review. It is therefore incorrect to assume
that this feature or all escalated secret setup is categorically unavailable.
The different verdict is not explained by the visible execution flags; this
chat's rejection specifically classified owner authorization as untrusted.

An independent read-only source comparison found a material security difference:
the IMAP helper uses a pinned public NAS certificate with verification enabled,
whereas the initial website helper retained the older management-endpoint TLS
exception. The website helper now uses verified TLS for both the management
WebSocket and upload, plus stricter private descriptor checks. The public
certificate was copied exactly; no other app's private material was copied.
No other app's credential or secret path is reused. A credential-free TLS probe
to the NAS passed with `servername=localhost`, TLS 1.3, verification enabled,
and peer SHA-256 fingerprint
`D8:3F:04:CA:B7:DD:95:4C:9F:FA:F7:54:5F:D8:B4:7B:FA:2B:EB:15:E4:D9:EA:5C:AC:BD:A1:62:31:B5:5A:E1`.
The pinned certificate is valid through December 30, 2026.
Both credential-free Node TLS and Bun WebSocket handshakes passed. The hardened
helper passes 14 offline checks, including a harmless Bun-to-Swift private-fd
transport test, and Swift typechecking. This correction is accepted locally.

[Official automatic-review documentation](https://learn.chatgpt.com/docs/sandboxing/auto-review)
distinguishes a real denied-action override from ordinary chat consent. Its
documented TUI `/approve` path injects an approval marker for one exact retry;
that command is not assumed to exist in this desktop surface. The documented
manual-reviewer mode also retains the workspace sandbox. Do not edit policy or
use another execution channel to bypass an explicit rejection.

After those material security improvements, one setup request was submitted
through the same escalation channel. Automatic approval review again rejected it
before execution, explicitly stating that even with TLS hardening the owner
authorization appeared in untrusted transcript history. No token prompt, NAS
directory creation, credential read or storage occurred. Further equivalent
retries are stopped. The remaining dependency is an actual execution-approval
override or supported manual review, not another ordinary-chat consent message.

## October 21 token custody correction

The owner changed execution approval and requested another attempt. The bundled
`prepare-key` command executed, then stopped at `filesystem.mkdir` before opening
the token dialog. Read-only reconciliation found `/mnt/Lake/Data/website` absent;
its parent uses a nontrivial NFSv4 ACL. The failed immediate chmod is consistent
with TrueNAS's documented removal-on-chmod-error behavior. The bounded middleware
audit query contained no matching mkdir record, so the specific server exception
was not recovered. No mutation was blindly replayed and the parent was unchanged.

The owner challenged the root requirement. Root ownership was an agent-selected
NAS staging design, not a requirement for Mac Keychain or for the UID-1001 app.
Coupling local token capture to NAS directory preparation was unnecessary. The
NAS staging approach is stopped and must be reviewed separately; do not resume
root-directory creation merely using the earlier approval.

The local-only `website-keychain.swift ensure-ingest-key` dialog then completed
with nonsecret status `created`. The website production entry is saved in the
operator's Keychain under the identifiers above; no NAS connection or root
operation is part of that local command. This does not prove NAS delivery or
telemetry export. Publication approval and owner readback remain pending.

The exact Keychain entry was independently confirmed by a metadata-only lookup;
its value was not read back for QA. The local execution UID is 501. Sandbox
escalation is not Unix root execution. Existing NAS administration authority is
needed to configure the app and its mount through the normal management API;
the application and its eventual credential file remain UID/GID 1001.

Read-only storage discovery found `/mnt/Lake` is a root-owned 0755 POSIX1E parent
with a trivial ACL, and `/mnt/Lake/website-openwoof` is absent. The proposed
replacement is a private app-owned directory there, with its `secrets` child
also UID/GID 1001 and mode 0700, and a UID/GID-1001 mode-0400 ingest file mounted
read-only at the existing container path. Pool and `Data` permissions remain
unchanged. This is a source preparation contract, not evidence that the new NAS
directory or file exists. Local `prepare-key` is now permanently separated from
NAS preparation so obtaining the token cannot trigger remote filesystem
operations or read the NAS credential.

The corrected CLI has three distinct steps:

- `bun scripts/observability/website-openwoof.mjs --mode prepare-key`: local
  Keychain capture/reuse only; outputs nonsecret status and `nasAccess:false`.
- `--mode prepare-delivery`: nonsecret app-directory staging through the existing
  NAS management API, with final UID/GID 1001, mode 0700 and trivial ACL. It checks
  the fixed POSIX parent and exact app baseline; it never reads the ingest entry.
- `--mode apply --source-sha <verified-sha> --image-digest <verified-digest> --confirm website`:
  gated deployment after CI/publication, preserving the current app values and
  creating only a fresh private secrets child. It verifies the app-owned directory
  before reading the key privately for delivery; existing paths and uncertain
  mutations still stop for reconciliation.

All 19 helper tests pass after this correction, including proof that local
capture cannot connect to the NAS, directory ownership is 1001, parent ACL/mode
drift blocks before mutation, existing secrets are preserved, and the harmless
private Swift pipe works. No new NAS staging or upload has been performed.
The 23-test application package result remains applicable to unchanged Java/UI
source. Publication is still awaiting explicit approval; the token-first request
has now been completed.

The corrected custody/delivery preparation is committed as `06c9214`. Upstream
main advanced to `a940867` with the independent receipt-503 retry fix; that change
was merged without conflict, producing release candidate
`ecfad2a28f3aa85e3b189c5c20bd8ba50d325e5e`. The receipt script syntax check and
diff checks passed. Unrelated dirty maintenance notes remain unchanged.
The owner is being asked to authorize publication of this concrete candidate
and continuation through gated CI/image publication and UID-1001 app delivery.
No NAS staging or key upload is claimed at this checkpoint.

The owner approved publication and continuation. `ecfad2a` was pushed to main;
matching [CI run 39611203872](https://github.com/javaDevJT/website/actions/runs/39611203872)
started for that full SHA. The nonsecret `prepare-delivery` step then completed:
`/mnt/Lake/website-openwoof` is verified UID/GID 1001, mode 0700, trivial ACL;
the `secrets` child remains absent and no ingest-key read/upload occurred.
The new application image and runtime update remain gated on CI/publication.

### Candidate CI failure retained (2026-10-21)

CI run `39611203872`, attempt 1, completed **failure** for full source
`ecfad2a28f3aa85e3b189c5c20bd8ba50d325e5e`. Its backend tests / linked-runtime
step passed at 13:56:53 UTC; the separate SBOM High/Critical gate failed at
14:00:26 UTC. Grype exited 2 with one High finding: `CVE-2026-92392` in Alpine
`curl 8.22.0-r0`, from `/lib/apk/db/installed`, platform `linux/amd64`.
The retained [security artifact](https://github.com/javaDevJT/website/actions/runs/39611203872/artifacts/12351871141)
reports `highCriticalCount: 1`. This candidate does not qualify for publication
or deployment. A later passing run must remain distinct from this attempt.

The downstream [production workflow](https://github.com/javaDevJT/website/actions/runs/39613309154)
reported success only for cleanup; its image-build/publication job was skipped
after failed CI. No image or TrueNAS runtime update is inferred from that overall
workflow conclusion. The security threshold is unchanged. Vendor remediation
is being investigated before another candidate is prepared. The NAS secrets
child remains absent; the production ingest key has not been delivered.

### Curl removal candidate

The [curl vendor advisory](https://curl.se/docs/CVE-2026-92392.html) identifies
8.23.0 as fixed. The [Alpine v3.24 amd64 index](https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/)
still supplied 8.22.0-r0 when checked on October 21. Curl was used only for the
container health probe and its smoke check. The runtime package list now omits
curl; the pinned stable base and scan threshold remain unchanged.

`docker/healthcheck/WebsiteHealthcheck.java` replaces that probe using
`HttpURLConnection` in `java.base`. It is compiled by the existing JDK 25 build
stage and runs with the linked runtime as UID 1001, with an 8–32 MiB heap. The
fixed numeric loopback URL bypasses proxies, rejects redirects, and succeeds
only on HTTP 200. Connect/read timeouts of 500/1500 ms leave room within Docker's
three-second outer timeout. The existing application JSON `status=UP` smoke
assertion remains; smoke now also runs the exact production probe and checks
that neither the curl executable nor libcurl shared library is present.

Focused local checks passed after the final source change:

- Compiled with `javac --release 25`; `jdeps` reports only `java.base`.
- The probe returned 0 for HTTP 200 with a broken proxy configured, and 1 for
  HTTP 500, HTTP 302, a delayed response (1.56 seconds), and a refused connection.
  It requested only `/actuator/health` and emitted no stdout/stderr in every case.
- A clean rootless Podman transaction using the pinned Alpine image and the
  remaining package list, explicitly on `linux/amd64`, found both `curl` and
  `libcurl` absent. The temporary container was automatically removed.
- Independent source review checked the probe, image copy, UID, module and smoke
  wiring. The compilation output directory is created explicitly.
- `git diff --check` passed. The prior 23-test CI application step passed for
  unchanged application/UI source; this replacement still requires a new full
  image smoke check, Trivy scan and Grype gate before release.

The initial localhost test attempt was blocked by the filesystem/network
sandbox before its server bound; the authorized rerun completed. This local
fixture and package check do not establish production telemetry acceptance.

The reviewed fix was committed as
`3ca0b8cafeaf436b1771dcebd9701f1223d1c0ba` and pushed to main under the owner's
approved continuation. Its exact matching
[CI run 39614953896](https://github.com/javaDevJT/website/actions/runs/39614953896),
attempt 1, was queued at 14:13:23 UTC. No successful image/publication or new
runtime is claimed while that run is pending.

### Probe permission failure and correction

CI `39614953896`, attempt 1, failed its build/runtime check at 14:18:15 UTC and
settled failure at 14:20:45 UTC. All 23 application tests passed. The log confirms
that the probe compiled and copied successfully, then UID 1001 received
`ClassNotFoundException: WebsiteHealthcheck` at the probe invocation. The SBOM
gate was skipped, so this attempt produced no qualifying scan result.

The file-only `COPY --chmod=0444` had created a new parent directory. Upstream
[BuildKit issue 2414](https://github.com/moby/buildkit/issues/2414) documents that
non-default copy modes can also apply to newly created parents, making mode
0444 unsuitable for directory traversal. The class is now copied directly into
the existing `/app` directory, which already serves the application jar to UID
1001. Both health-check invocations use `-cp /app`, and smoke explicitly checks
that `/app/WebsiteHealthcheck.class` is readable after switching to UID 1001.

A separate rootless `linux/amd64` container check compiled with the exact pinned
Temurin 25 image, created a `java.base`-only linked runtime, reproduced the
corrected file copy, and ran as UID/GID 1001. It verified a silent exit 1 with no
server, then exit 0 against an actual loopback HTTP 200 server. The initial
fixture attempt lacked Alpine's optional HTTP-server applet; after adding that
test-only package the fixture passed. No test-server package enters production.
Independent review found no stale classpath or copy-path reference. This remains
preparation evidence; another complete CI image smoke/scan is required.

The reviewed correction was pushed as
`d9148ff9650c145434bfcd225481894c6d65cbff`. Its exact
[CI run 39616596851](https://github.com/javaDevJT/website/actions/runs/39616596851),
attempt 1, failed before checkout at 14:30:44 UTC. Runner
`truenas-website-storage-16g-c9372f98` reported that the mandatory
`/opt/ci-storage/ci-storage-policy-job-start.js` hook exceeded its 300-second
deadline. No source build, tests or scans ran in this attempt. Missing checkout
files and the missing native-start baseline during later cleanup are downstream
failures, not evidence of an application defect. The storage hook and unrelated
infrastructure remain unchanged; a bounded same-source retry is the next step.

The first job-scoped retry request was rejected while the original workflow was
still finalizing; read-only reconciliation confirmed attempt 1 remained the only
attempt. After the run settled at 14:37:14 UTC, one `--failed` rerun request was
accepted for the same source/run. This reuses the required hooks and all gates;
no infrastructure guard was disabled or modified.

Attempt 2 passed the mandatory runner setup and checkout and reached the full
build/runtime check. A concurrent artifact-janitor workflow refused to clean an
active rerun; that separate workflow is not source or scan evidence.

A fresh read-only website configuration check at approximately 14:41 UTC found
`run_as_custom_user=false`, `privileged=false`, `host_network=false`, and no
command or entrypoint override. Thus the app retains its image's UID/GID-1001
execution contract. This check read no environment values or ingest credential.

CI `39616596851` attempt 2 completed the full build/test/linked-runtime/Trivy step
successfully at 14:47:07 UTC. The separate SBOM/Grype High/Critical gate then
started; this checkpoint is not yet evidence of a successful overall CI or
published image.

Completed-job evidence for attempt 2 confirms 23 tests, zero failures/errors/
skips, and Trivy reporting zero vulnerabilities. The retained
[Grype summary artifact 12354144472](https://github.com/javaDevJT/website/actions/runs/39616596851/artifacts/12354144472)
binds full revision `d9148ff9650c145434bfcd225481894c6d65cbff` and platform
`linux/amd64`, with `highCriticalCount: 0` and `findings: []`. These are successful
CI build-job results; registry publication and runtime adoption remain separate.

CI `39616596851` attempt 2 fully settled **success**, including cleanup at
14:57:57 UTC. The exact matching
[production publication run 39621542367](https://github.com/javaDevJT/website/actions/runs/39621542367)
then started. Its image job `119296035492` passed setup and the current-main
identity gate and entered build/push at approximately 15:00 UTC. Publication
must still pass its own scan and provide the immutable digest/receipt.

The production image job succeeded. Its
[scan artifact 12355847389](https://github.com/javaDevJT/website/actions/runs/39621542367/artifacts/12355847389)
binds full source `d9148ff9650c145434bfcd225481894c6d65cbff`, platform
`linux/amd64`, and zero High/Critical findings (`findings: []`). Scan and storage
checks succeeded at 15:10:55 UTC; current-main validation, release tagging and
the portable receipt marker succeeded by 15:11:02 UTC. The immutable image is:

`ghcr.io/javadevjt/website@sha256:1503012ccfb80167fdf38f041d4f2f2404ece43b9d4f117b1c56359995a2fddd`

The read-only deployment dry-run passed for that exact source/digest. The live
catalogue 1.4.4 website still uses the guarded `a1a24c3f...` baseline, with no
environment, mounts, command or entrypoint overrides. Proposed delivery changes
only the image, eight telemetry/identity environment entries, and the single
read-only file mount at `/run/secrets/openwoof-ingest-key`; the host file is
UID/GID 1001 mode 0400 under mode-0700 app-owned directories. No ingest key was
read or uploaded by the dry-run. Workflow cleanup and the signed receipt remain
separate pending gates before applying this configuration.

Publication attempt 1's cleanup failed at 15:17:15 UTC on the same mandatory
storage-hook 300-second deadline, despite the successful image job. Its receipt
publisher skipped; no accepted receipt was produced. A cleanup-only retry made
publication attempt 2 successful at 15:20:14 UTC, reusing the original image job.
However, the copied job log still carries `run_attempt=1`, while the receipt
verifier requires a marker bound to the verified current attempt. The primary
missed that constraint before choosing the cleanup-only retry. It does not
qualify as a valid attempt-2 receipt and the verifier remains unchanged.

A fresh image-job rerun, including dependent cleanup, was then accepted for the
same source as publication attempt 3. This must generate a fresh matching marker,
pass the gates and produce an accepted receipt. The image digest may change;
the selected runtime digest must follow that new verified publication. No app
update or ingest-key delivery has been attempted.

The actual attempt-2 receipt producer
[run 39624705376](https://github.com/javaDevJT/website/actions/runs/39624705376)
failed at 15:23:00 UTC before marker validation: `GitHub check runs do not cover
every successful source job.` Its artifact list is empty. The stale-marker
condition above is an additional confirmed incompatibility; it was not the
first error emitted by this producer. Publication attempt 3 passed setup and
entered its fresh image build at 15:24:30 UTC. The primary also assigned a bounded
read-only CI-platform source investigation of the repeated storage-hook timeout;
no shared infrastructure changes are authorized or performed by this task.

Read-only platform investigation found that the protected 300-second deadline
wraps the native start hook, which polls `/v1/usage` while storage-policy
admission is pending. The cache bootstrap has a separate non-fatal 17-second
bound. A start baseline is captured only after admission resolves, explaining
the subsequent missing-baseline 404 when start times out. Source references:
[storage runtime](/Users/joshuaterk/Documents/ChatGPT/Quarterback-ci/output/runner-source-20261020/storage_runtime.go:71),
[native storage client](/Users/joshuaterk/Documents/ChatGPT/Quarterback-ci/output/runner-source-20261020/storage-client.mjs:933),
and [policy binding](/Users/joshuaterk/Documents/ChatGPT/Quarterback-ci/output/runner-source-20261020/storage_policy_runtime.go:911).

An existing [platform incident record](/Users/joshuaterk/Documents/ChatGPT/Quarterback-ci/output/qualification/shared-runner-admission-2026-10-21.md:21)
shows SDK/GitHub REST job-binding mismatches leading to pending admission and
the same timeout. That supports a shared failure path but does not establish the
website-specific mismatched field; no controller logs or shared runtime were
queried by this investigation. Existing ownership notes reserve the admission
correction to the runner owner. This task leaves that ownership and the
fail-closed policy intact.

Publication attempt 3's fresh image job `119307591797` completed success at
15:35:29 UTC. Its marker now correctly binds run `39621542367`, attempt **3**,
source `d9148ff9650c145434bfcd225481894c6d65cbff`, and this selected image:

`ghcr.io/javadevjt/website@sha256:a5b9571006e5517b86ed024c08c9cf114f8e78b6562075ba4b8dba8291dbd611`

The [attempt-3 scan artifact 12358441278](https://github.com/javaDevJT/website/actions/runs/39621542367/artifacts/12358441278)
independently binds that source, digest and `linux/amd64`, with zero High/Critical
findings. This replaces the earlier publication digest as the runtime candidate;
neither image has been deployed by this task. A new read-only dry-run for the
selected digest passed against the unchanged app baseline. Ingest-key delivery
is still held for matching receipt acceptance after workflow cleanup.

Publication run `39621542367` attempt 3 then fully settled **success**: cleanup
job `119314881455` passed on runner
`truenas-website-storage-8g-90d8d18f`. The matching receipt producer
[run 39627368753](https://github.com/javaDevJT/website/actions/runs/39627368753)
was queued at 15:37:36 UTC. Its actual receipt/acceptance is the remaining
publication evidence; earlier skipped/failed producers do not qualify.

Receipt producer `39627368753` succeeded at 15:39:34 UTC. Its verified inputs
were publication run `39621542367`, attempt 3, source `d9148ff...`, and selected
digest `a5b957...dbd611`. Code inspection and the successful submission step
establish signed-receipt endpoint acceptance (the helper requires HTTP 200/201).
The response body is intentionally unlogged and no GitHub receipt artifact is
emitted; an independent Quarterback persisted-record ID/readback was not
observed. This does not establish OpenWoof telemetry persistence.

The approved website-only apply command started at 15:41:22 UTC for the full
selected source/digest. It remains one-shot: any mutation ambiguity must be
reconciled read-only before another operation. No key value is logged or passed
in command arguments.

The initial delivery completed credential storage and submitted app-update job
`30687`. The helper then reported an unavailable job-status read and exited.
Read-only reconciliation confirmed that **the job succeeded**; no upload or
update was replayed. The NAS credential file is UID/GID 1001, mode 0400, beneath
mode-0700 app-owned directories. Its bytes were not read for verification.

The updated image failed actual telemetry-enabled startup. Bounded container
logs at 15:46:28 UTC show `NoClassDefFoundError` and `ClassNotFoundException` for
`io.opentelemetry.proto.resource.v1.Resource` while creating `otlpMeterRegistry`.
The app was restarting rather than healthy. The POM's direct test-scoped
`opentelemetry-proto` dependency suppressed Micrometer's transitive runtime
scope, so source tests had the class but the packaged application did not.
The earlier image smoke used telemetry disabled and missed this failure.
Passing CI, publication and receipt acceptance above therefore do **not**
constitute runtime telemetry acceptance.

To restore availability, job `30703` changed only
`OPENWOOF_TELEMETRY_ENABLED` to `false`. It succeeded; the website returned HTTP
200 with actuator status `UP` and exact source
`d9148ff9650c145434bfcd225481894c6d65cbff`. The current restored container is
`374b277663b2fd933947ee763ce877f58d23b5a42e4d7692ad0935ad141be641`.
The image, identity settings, protected credential file and mount remain in
place for reuse. No credential was rotated, revoked, overwritten or re-uploaded.
The packaging fix must pass a new telemetry-enabled packaged-runtime check,
publication gates and a fresh accepted receipt before another app promotion.

The corrected POM removes the redundant direct test-scoped proto dependency;
Micrometer now supplies the compatible `1.10.0-alpha` runtime dependency, present
in `BOOT-INF/lib`. `./mvnw --batch-mode --no-transfer-progress clean verify`
passed all 23 tests. A separate `sh scripts/telemetry-runtime-smoke.sh` passed:
it starts through the packaged JAR's `PropertiesLauncher`, with only one
temporary test helper added outside the JAR, and delivers all three OTLP protobuf
signals to a loopback receiver while reading real portfolio content. Its
test-only exporter override and harmless fixture key do not enter the runtime
JAR or final image and do not contact OpenWoof.

The final linked-JRE Docker smoke also now enables telemetry with a UID-1001
mode-0400 fixture file and full fixture SHA. `RUN --network=none` prevents its
production-configured exporter from reaching OpenWoof. It retains the actual
health, content, PDF, assets and production-UID checks; CI must execute this
container stage before publication. These two checks cover the missed packaged
dependency and native runtime startup conditions separately.

The catalogue's stored mount has `read_only=true`, but this TrueNAS runtime's
`volume_mounts[].mode` is an empty string. That metadata does not prove effective
kernel mount flags. The [25.10 API schema](https://api.truenas.com/v25.10.0/api_methods_app.query.html)
and [documented shell UI](https://www.truenas.com/docs/scale/25.10/scaleuireference/apps/)
do not establish a supported programmatic shell handshake or default exec UID.
No guessed shell protocol or host-root command was used. Actual kernel flag
verification remains unobserved; it must not be inferred from the blank mode.

The independent packaging review found no blocking issue in dependency scope,
packaged-classpath isolation, test-helper exclusion, external-network isolation
or cleanup. `git diff --check` passed. The corrected release will retain all
existing CI/security/receipt gates and reuse the already delivered credential
through a guarded configuration-only promotion; initial delivery is not replayed.

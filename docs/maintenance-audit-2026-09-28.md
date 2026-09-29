# Repository maintenance audit — September 28, 2026

This records the pre-release audit and local verification. The owner subsequently authorized adding Discord Option Tailer and Embedify, publishing the changes, and deploying the resulting image; release execution is tracked separately.

## Release hardening follow-up

After Adoptium's version-discovery API timed out during CI, Java compilation and tests were moved into the pinned Docker builder. The current source uses Java 25 LTS, Node 26.10.0, Spring Boot 4.1.1, Exec Maven Plugin 3.6.4, and React Router 8.4.0. Java 27 is outside stable Spring Boot's documented compatibility range; Java 25 is the maintained LTS choice within that range.

The multi-stage image now derives its Java modules with `jdeps` and creates a reduced runtime with `jlink`. The final Alpine image runs as UID/GID 1001 and contains the linked runtime and application JAR, without the Node/Maven build tools. CI exercises the linked runtime, PDF text extraction, selected catalogue entries and generated assets, then scans runtime OS packages and Java libraries with Trivy. Frontend dependencies have a separate npm audit gate. These gates fail on known findings and do not claim to eliminate every possible vulnerability. The detailed baseline audit and its earlier local results follow.

## Scope and acceptance

Review all maintained backend, frontend, content, build, and deployment sources; update dependencies using verified stable releases; make the existing GitHub Actions build compatible with the user's private runner; report projects missing from the catalogue without adding them; update current job-title references to Senior Software Engineer while retaining job function.

Preserve pre-existing untracked documentation and static assets. Base revision: `1bea8f26ee30a3139f600b1f1de44703f2576a1d` on `feature/add-dockerized-imap-sync-portfolio`. No production deployment or catalogue additions are part of this change.

Acceptance checks: frontend typecheck/build, backend tests/package, focused regressions for substantive fixes, workflow validation and runner evidence, current-checkout runtime/API/browser smoke where tools permit, and a source-backed missing-project list.

## Work ownership and review ledger

The native spawn catalog inspected on 2026-09-28 exposes one Luna model, `gpt-6-luna`, with maximum effort `max`. These explicit selections follow the swarm skill's centralized configuration. Provider internals and execution speed are not exposed and are unverified.

| Task | Exclusive write scope | Consumer and focused check | State |
| --- | --- | --- | --- |
| Backend audit (`/root/backend_audit`) | `src/main/java/**`, `src/test/**`, `src/main/resources/application.properties` | Primary integration; endpoint/security/correctness regression evidence | Accepted; completed/released |
| Frontend audit and title (`/root/frontend_audit`) | `frontend/src/**`, `frontend/index.html`, existing biography/resume content under `src/main/resources` and `frontend/public` | Primary integration; build and interaction/accessibility evidence | Accepted; completed/released |
| Dependencies (`/root/dependencies`) | `pom.xml`, `frontend/package*.json`, frontend build configuration, `.mvn/**`, `mvnw*`, runtime version files | Primary integration; stable version provenance, dependency scan, build | Accepted; advisory follow-up reassigned to and completed by primary |
| CI and container audit (`/root/ci_audit`) | `.github/**`, `Dockerfile`, `.dockerignore`, container/Compose configuration, `infrastructure/nginx.conf` | Primary integration; runner labels and workflow/build validation | Accepted; completed/released |
| Catalogue inventory (`/root/catalogue_inventory`) | `docs/missing-projects-2026-09-28.md` only | User selection; compare live owned repositories with catalogue and avoid duplicates | Accepted; completed/released |
| Independent backend review (`/root/backend_review`) | Read-only Java source and tests | Primary acceptance; attempt to falsify traversal, read-only, and packaged-resource fixes | Accepted; completed/released |

Primary owns documentation index, final audit synthesis, Git hygiene, cross-scope integration, and final validation. Workers may not redelegate, publish, deploy, push, contact others, or modify catalogue entries. Their completion releases native capacity; results require primary review before acceptance. Each listed worker was explicitly requested with native `gpt-6-luna` / `max`; provider internals are not observable.

## Findings and validation

### Audit coverage

Reviewed the maintained application and its call paths: 11 backend Java files, 21 frontend source files (including inactive pages/components), eight content Markdown files, the résumé PDF, both workflows, Maven/npm/wrapper configuration, Docker/Compose/Nginx configuration, and current documentation. Generated dependencies were checked through manifests and vulnerability data rather than treated as authored source. The baseline had one backend test and 3,658 tracked files under `frontend/node_modules`.

The active site is `App.tsx` → `CustomTerminalEnhanced.tsx` → `/api/content/**`. Its seven project entries come from `src/main/resources/directories/portfolio`. The legacy `frontend/src/pages/Portfolio.tsx` is not mounted. The separate `/api/blog` controller is a legacy JPA API, not the terminal's Markdown catalogue.

### Confirmed issues addressed

| Severity | Finding and resulting behavior | Main source |
| --- | --- | --- |
| High | Public blog POST/PUT/DELETE routes allowed unauthenticated writes. The API is now read-only; writes return 405. No active authenticated editing client existed. | `BlogController.java`, `BlogControllerReadOnlyTest.java` |
| High | Content paths were interpolated into classpath lookups. Reads now allow only a single Markdown filename under `blog` or `portfolio`; traversal returns 400. Resource enumeration/read resolution is constrained to the application root. | `ContentService.java`, `ContentController.java`, `ContentServiceTest.java` |
| Medium | Filesystem-only resource enumeration failed inside executable JARs. Classpath resource enumeration now works with packaged articles. A regression also covers an identically named resource directory in another JAR. | `ContentService.java` |
| Medium | All seven portfolio files use leading unfenced metadata, but the parser accepted only `---` frontmatter. Technology/year/title fields and filtering were therefore degraded. The parser now supports both formats, and excerpts omit metadata and headings. No project entry was added or rewritten. | `ContentService.java`, `ContentServiceTest.java` |
| Medium | Month/year publication dates could not be parsed as `LocalDate`, and comparing two missing dates violated the comparator contract. Dates use the first day of the month and null-safe newest-first ordering. | `ContentService.java` |
| Medium | Maven's frontend executions lacked execution goals; builds used `npm install`, generated files into the source tree, and could clear local static assets. Maven now runs `npm ci` and builds into `target/generated-resources/static`, copying only fresh generated output into the JAR. | `pom.xml`, `frontend/vite.config.ts` |
| Medium | Dependencies and generated frontend output were committed despite ignore rules. Removed 3,658 installed dependency files and five generated static files from Git tracking, preserving files on disk. The lockfile and source public assets remain authoritative. | `.gitignore`, Git index |
| Medium | Docker's documentation exclusion also excluded the application's Markdown articles. The build context now explicitly includes runtime Markdown. | `.dockerignore` |
| Medium | Workflow builds used hosted runners/local Docker assumptions, and publication could race or precede failing tests. Builds use the private runner and remote authenticated BuildKit; publication is gated to a successful trusted main-push CI result at the exact current main commit. | `.github/workflows/*.yml` |
| Medium | Proxy configuration injected wildcard CORS and permissive script execution rules, and exposed a metrics proxy. Removed wildcard CORS and `unsafe-eval`, restricted CSP, disabled public metrics/Actuator paths at the proxy, and routed `/health` to Actuator health. | `infrastructure/nginx.conf` |
| Low | Blocking JPA, file, and PDF work ran on WebFlux request threads. It now runs on bounded-elastic workers. Public content errors no longer echo filesystem paths, and the frontend error screen no longer reveals stack traces. | Backend controllers, `ErrorBoundary.tsx` |
| Low | Browser storage restrictions could prevent startup; virtual `cd` accepted nonexistent or out-of-root directories. Storage access now has safe fallbacks and directory changes resolve against the virtual filesystem. | `App.tsx`, `useTheme.ts`, `CustomTerminalEnhanced.tsx` |
| Medium | The desktop ASCII banner and input flex sizing clipped content on phones. Narrow screens now use a compact readable header, four labelled 44px contact targets, and a full-width command field; desktop retains the ASCII banner. | `CustomTerminalEnhanced.tsx`, `index.css` |
| Low | Filenames with spaces were split and query values interpolated. Command arguments retain spaces and content requests use encoded query parameters. | `CustomTerminalEnhanced.tsx` |
| Content | Updated current title to **Senior Software Engineer**, retaining **SRE Team Lead / In-Vehicle Product Cybersecurity / General Motors** in terminal commands, banners, biography, page metadata, root README, and the tagged résumé PDF. Historical job entries remain intact. Added a terminal favicon. | Frontend, `About.md`, `ResumeATSOptimizedLoud.pdf`, `README.md` |

### Dependency changes

| Component | Baseline → updated |
| --- | --- |
| Spring Boot | 4.0.0-RC1 → 4.1.1 stable |
| PDFBox | 3.0.3 → 3.0.8 |
| Maven distribution | 3.9.11 → 3.9.16 |
| Maven resources / exec plugins | 3.3.1 → 3.5.0 / 3.1.0 → 3.6.3 |
| React / React DOM | 19.2.0 → 19.3.0 |
| Vite / React plugin | 7.2.0 → 8.3.1 / 5.1.0 → 6.1.1 |
| TypeScript | 5.9.3 → 7.0.2; Vite client types explicitly included |
| Tailwind / PostCSS plugin | 4.1.16 → 4.3.3; corrected the source CSS to Tailwind 4 imports/source scanning |
| PostCSS | 8.5.6 → 8.5.28 |
| Axios | 1.13.2 → 1.20.0 |
| Framer Motion | 12.23.24 → 13.4.4 |
| React Router | 7.9.5 → 7.18.4; kept the existing v7 API used by inactive legacy pages, rather than migrating unused routes to v8 |
| React type packages | Updated to 19.3.0 and moved to dev dependencies |

Removed unused Junrar, Jackson 2, and redundant Autoprefixer. Replaced `flexmark-all` with only the core and table-extension modules actually imported by the application, removing unused jsoup and other extensions. Updated Spring Boot's Jackson 3 BOM to 3.1.6, keeping modules aligned. `prism-react-renderer` and Flexmark's core release had no required version change. Node 24 is selected by `.nvmrc`, CI, and Docker; the local checks used Node 26.9.0 and Java 21.0.12.1. Node 24/container execution is a CI verification boundary.

The successful `npm ci` runs reported 82 packages audited and zero vulnerabilities. A separate npm audit attempt failed DNS resolution; it does not provide additional clean-scan evidence. A primary OSV scan of 112 coordinates extracted from runtime JAR metadata found Jackson advisories `GHSA-gx83-3vf8-gh7j`, `GHSA-q4xh-88c3-wmh7`, `GHSA-wjgm-6hv5-3cvf`, and jsoup advisory `GHSA-pmhh-3w7g-xqp8`. After the changes above, a complete Maven-resolved runtime list produced **123 coordinate queries and zero OSV advisory matches** on September 28. The packaged application contains 119 dependency JARs, Jackson databind 3.1.6, and neither Jackson databind 2 nor jsoup. This is known-advisory evidence at the query time, not a claim of universal vulnerability absence.

### Private-runner and publication contract

- `truenas-website` is the label confirmed in the current remote workflow and prior fleet migration records. Zero idle GitHub runner registrations is consistent with one-job transient workers; it is not proof of failure or a fresh successful run.
- Buildx uses the remote driver at `tcp://buildkit:1234`, with `/run/buildkit/tls/ca.pem`, `client.pem`, and `client.key`. No host Docker socket, privileged runner, host mounts, or persistent worker was added.
- All CI build jobs use the private runner. Docker's `smoke-test` stage starts the same packaged application as the non-root runtime user, checks health/client information/catalogue/root HTML and JavaScript/CSS assets, and stops the process. `no-cache-filters: smoke-test` prevents reusing a prior smoke result. The ordinary image target is `runtime`.
- Workflow actions are pinned to verified 40-character commit SHAs. Build/test workflows have read-only repository permissions. Existing `GHCR_PAT` publication authority is retained only for the publication job.
- Automatic image publication follows successful `CI Pipeline` completion from a push to this repository's main branch. It checks out the tested SHA and verifies it remains current main. Fork PR completions and manual/feature-branch bypasses cannot publish.
- Fork-approval policy was recorded in the September 27 runner migration, but the current connector cannot read that settings endpoint and the local GitHub CLI credentials cannot refresh it. The policy was not changed here.
- No workflow was pushed, dispatched, or remotely exercised by this task. No image was published and no runtime deployed. Local Docker/Podman daemons were unavailable, so the BuildKit smoke stage is syntax/configuration validated and awaits execution by the private runner.

### Verification evidence

The final fresh `clean verify` completed September 28, 2026 at 18:51:45 EDT. It passed the frontend TypeScript/build checks and all seven JUnit tests with zero failures or errors. The packaged JAR includes all eight Markdown resources, the updated résumé and favicon, and current hashed UI assets. The earlier TypeScript 7 CSS ambient-type failure was fixed by explicitly including `vite/client` types.

The actual executable JAR was started on `127.0.0.1:18080` using Java 21. HTTP smoke verified health UP; contact/client/blog endpoints; seven catalogue entries; biography title; a valid PDF download; 400 for traversal; and 405 for blog POST/PUT/DELETE. Served HTML, JavaScript, and CSS matched the fresh generated files byte-for-byte. Nested dependency inspection found no resources colliding with the public content directories.

Playwright verified the desktop title and terminal styling, `gm`/`cat about.txt`, invalid-directory rejection, executing a project whose filename contains spaces, and Tab completion. Visual inspection caught clipping despite a passing document-width check; after the responsive fix, the 390px view showed the complete name/title, all four social links, and a 350×44px input wholly inside the viewport. Desktop retained its ASCII header. A fresh browser page with both storage APIs forced to throw still reached the terminal. Fresh final pages reported zero console or page errors. The changed PDF title was independently inspected in its rendered page, and both pages retained clean extraction and document tagging.

### Remaining findings and limits

- The intentionally public server-information feature exposes OS/JVM/host details. Client IP display trusts `X-Forwarded-For`; it is not an authentication signal. Neither behavior was treated as proof of a trusted client identity.
- The existing public résumé includes contact details; this task preserved them and changed only the current role block. Publication/privacy choices remain the owner's.
- Remote image conversion has no explicit fetch timeout. Current Markdown does not contain remote image URLs; no external image test was performed. Content-read failures still use the existing 200/error-map or empty-list contracts, and resource cache policy remains implicit.
- Inactive navigation/command-palette components have mobile accessibility gaps; inactive Home reads dimensions/randomness during render; inactive Portfolio contains placeholder cards. They are outside the mounted terminal route and were recorded rather than promoted into active features.
- This is a full maintained-source/configuration review with local regression and runtime verification, not proof that every vulnerability is absent or that production matches the checkout. Hosted image, runner, proxy, and production verification require actual execution after review.

### Catalogue decision

The owner-reviewed inventory initially contained 24 repositories: six represented projects, four missing public candidates, eight missing private candidates, five forks, and one profile repository. The seven-entry audit baseline included one planned concept without a matching owned repository. The detailed inventory is retained locally because it names unselected private projects. After this audit, the owner selected Discord Option Tailer and Embedify for the release; their catalogue entries are the only approved additions.

### Initial local validation record

The final local build, dependency checks, workflow review, and executable-JAR/browser smoke checks are complete.

- Build: `./mvnw --batch-mode --no-transfer-progress clean verify`, using Java 21.0.12.1 and Node 26.9.0; completed September 28, 2026 at 18:51:45 EDT. Seven tests passed. CI and containers select Node 24, which was not exercised locally.
- Artifact: `target/website-0.0.1-SNAPSHOT.jar`; SHA-256 `6186ce21fa123dc9d32d584d7ffcfe583424226f5c2fa50c6274a80b778ab407`.
- Résumé: `src/main/resources/ResumeATSOptimizedLoud.pdf`; SHA-256 `c3f7075ffd9c3c914a9c8029193bb2c3f3f0002ec31db6de1c5c36c072393350`. The current role changed; historical roles and dates remain intact.
- Dependency evidence: final `npm ci` reported 82 audited packages and zero vulnerabilities. The full resolved Maven runtime list produced 123 OSV coordinate queries with zero advisory matches after remediation. These are known-advisory results, not a guarantee that all vulnerabilities are absent.
- Runtime evidence: the final executable JAR served healthy endpoints and seven catalogue entries; the Tesseract filter selected RouteListToTesla, traversal returned 400, and blog writes returned 405. Served HTML/JS/CSS/favicon and downloaded résumé matched the current build/source bytes.
- Browser evidence: desktop/mobile title, terminal interactions, storage-failure fallback, dark/light icons, and the 390px layout passed; fresh final pages had zero console/page errors.
- Workflow evidence: YAML parsing, inline shell syntax, Docker smoke shell syntax, and action pin checks passed. No local container daemon was available; private-runner/remote-BuildKit execution remains unverified.
- Cleanup: the task-owned Java runtime on port 18080 and isolated `website-audit` browser were stopped after verification. No test server is being handed off.
- Both staged and unstaged whitespace checks passed. The index contains only the deliberate dependency/generated-asset removals; source changes remain uncommitted. No push, workflow dispatch, image publication, production deployment, or catalogue addition occurred.

## Subsequent release hardening

After the initial audit, Joshua approved adding Discord Option Tailer and Embedify, committing/pushing the changes, publishing a container through CI, and deploying it to TrueNAS. The catalogue now contains nine entries. Embedify's repository visibility remains unchanged.

- Updated the build to Spring Boot 4.1.1, Java 25 LTS, Node 26.10.0, React 19.3.0, React Router 8.4.0, Vite 8.3.1, TypeScript 7.0.2, and Maven 3.9.16. Java 25 is the maintained LTS choice within Spring Boot 4.1.1's supported Java range; Java 27 is outside that range.
- The container now has separate build and runtime stages. `jdeps` and `jlink` produce the runtime; the published image runs as UID/GID 1001 and contains no Java compiler or Node toolchain.
- CI runs the complete build inside pinned containers on the private TrueNAS runner, avoiding the Adoptium setup API timeout and missing host Node library. Docker action pins use current stable releases.
- Removed Docker build-context test exclusions and enabled Maven `-DfailIfNoTests=true`; a successful container build must execute the backend tests. The seven tests also pass locally on Java 25.
- The final image depends on a fresh non-root runtime smoke test and Trivy scan of its shared runtime filesystem. All detected vulnerability severities fail the build. The preceding Linux scan reported zero Alpine and application-JAR findings, and npm reported zero known vulnerabilities.

Publication and production verification are recorded separately in the local release ledger; the earlier artifact hash and runtime checks above describe the initial audit build.

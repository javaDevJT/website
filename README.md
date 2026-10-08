# Joshua Terk's personal website

A responsive Linux-terminal-themed portfolio for Joshua Terk, Senior Software Engineer. The site presents his work, writing, technology interests, and automotive projects through a custom React terminal backed by Spring Boot APIs.

The [maintenance audit](docs/maintenance-audit-2026-09-28.md) records the code review and dependency updates. The [October 8 checkpoint](docs/maintenance-checkpoint-2026-10-08.md) records current release verification, and the [daily deploy gate repair](docs/daily-deploy-gate-repair-2026-10-08.md) describes transient API retries and the manual validation route. Current source navigation and build instructions follow.

## Requirements

- Java 25, with `JAVA_HOME` pointing to that installation.
- Node.js 26.10.0 and npm; `.nvmrc` selects the supported version.
- The checked-in Maven wrapper downloads the project's Maven distribution.

## Build and test

From the repository root:

```sh
./mvnw test
./mvnw package
java -jar target/website-0.0.1-SNAPSHOT.jar
```

The Maven lifecycle installs frontend dependencies from the lockfile, typechecks TypeScript, builds the frontend, and packages the UI with the backend. The default local server listens on port 8080. `./mvnw spring-boot:run` is also available for backend development.

For frontend development, keep the backend running and use a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Vite serves the development UI on port 3000. `npm run build` runs TypeScript checking and creates production assets; `npm run preview` previews that build. Use the packaged Spring Boot application when verifying backend-dependent terminal commands.

## Current application

- [App.tsx](frontend/src/App.tsx) renders the boot sequence and [CustomTerminalEnhanced.tsx](frontend/src/components/CustomTerminalEnhanced.tsx).
- Content such as `about`, `portfolio`, `blog`, and `resume` comes from [classpath resources](src/main/resources/directories) and the [content API](src/main/java/com/jtdev/website/controller/ContentController.java).
- Contact information is returned by `GET /api/contact`. The current site uses contact links; it does not submit or persist a contact form.
- `/api/blog` exposes read-only access to the legacy JPA-backed blog. The terminal's Markdown blog and portfolio use `/api/content/**` instead.
- The H2 database is ephemeral by default. Resource-backed articles and portfolio entries are checked-in files, independent of that database.
- `/actuator/health` reports application health. The terminal's server-information commands are deliberately public display features.

## CI and containers

[CI](.github/workflows/ci.yml) and [deployment configuration](.github/workflows/deploy.yml) contain the automated build and image-publication rules. See the [maintenance audit](docs/maintenance-audit-2026-09-28.md) for the private-runner contract, validation evidence, and activation boundaries, and the [daily deploy gate repair](docs/daily-deploy-gate-repair-2026-10-08.md) for transient API retry and manual validation behavior.

The [Dockerfile](Dockerfile) tests and builds with Java 25 and Node 26, then uses `jdeps` and `jlink` to create the Java runtime. The final Alpine image contains the application and linked runtime, runs as UID/GID 1001, and excludes Maven, Node, Java compiler tools, and source resources outside the JAR. CI boots that image, exercises PDF/content/UI routes, and scans its filesystem with Trivy before image publication. Any reported OS or Java-library vulnerability fails the scan; the scan uses current advisory data rather than guaranteeing future vulnerability absence.

Container and reverse-proxy settings live under [infrastructure](infrastructure/). Verify the locally installed Docker or Podman Compose provider before running its commands.

## Contributing

Preserve the accessible terminal navigation and existing content. Run the relevant checks before submitting changes. New catalogue entries require owner selection.

The historical session notes describe earlier designs and are not a current feature checklist or proof of deployment.

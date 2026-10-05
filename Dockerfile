# syntax=docker/dockerfile:1
# Java and Node are build tools only; the published image contains a jlink runtime.
FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS node-toolchain

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS zlib-build
RUN apk add --no-cache alpine-sdk ca-certificates dash=0.5.13.1-r2 && \
    adduser -D builder && addgroup builder abuild && \
    mkdir -p /build/zlib /build/dash /packages /out && chown -R builder:builder /build /packages /out
COPY --chown=builder:builder docker/zlib/APKBUILD /build/zlib/APKBUILD
COPY --chown=builder:builder docker/dash/APKBUILD /build/dash/APKBUILD
USER builder
WORKDIR /build/zlib
RUN abuild-keygen -an
USER root
RUN cp /home/builder/.abuild/*.rsa.pub /etc/apk/keys/
USER builder
# The SDK already contains all build dependencies. Avoid abuild's setuid APK
# installer in the rootless private BuildKit sandbox; keep package checks/tests.
RUN REPODEST=/packages abuild -d && \
    cp /packages/*/*/zlib-*.apk /out/zlib.apk && \
    cd /build/dash && REPODEST=/packages abuild -d && \
    cp /packages/*/*/dash-*.apk /out/dash.apk

FROM eclipse-temurin:25.0.4.1_1-jdk-alpine-3.24@sha256:3fd2d245c4e0eba615fe366a71b8bd25f5db7104f53e4026b24bf508b880bd2a AS backend-build
RUN apk add --no-cache libstdc++ libatomic
COPY --from=node-toolchain /usr/local/ /usr/local/
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn ./.mvn
COPY frontend ./frontend
COPY src ./src

# Run the same backend tests and frontend checks used for local verification.
RUN ./mvnw --batch-mode --no-transfer-progress -DfailIfNoTests=true clean verify && \
    cd frontend && npm audit --audit-level=low

FROM backend-build AS java-runtime
# jdeps finds static JDK dependencies. Reflection, charset and service-provider
# use in Spring/Hibernate/Netty/PDFBox needs the additional modules below.
RUN mkdir /app/unpacked && cd /app/unpacked && \
    jar -xf /app/target/website-0.0.1-SNAPSHOT.jar && \
    modules="$(jdeps --ignore-missing-deps --multi-release 25 --recursive \
      --print-module-deps --class-path 'BOOT-INF/lib/*' BOOT-INF/classes)" && \
    jlink --add-modules "$modules,java.desktop,java.instrument,java.management,java.naming,java.sql,jdk.charsets,jdk.crypto.ec,jdk.localedata,jdk.unsupported,jdk.zipfs" \
      --strip-debug --no-header-files --no-man-pages --compress=zip-6 \
      --output /opt/java-runtime

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS runtime-base
COPY --from=zlib-build /out/zlib.apk /tmp/zlib.apk
COPY --from=zlib-build /out/dash.apk /tmp/dash.apk
COPY --from=zlib-build /home/builder/.abuild/*.rsa.pub /etc/apk/keys/
# BuildKit stores snapshots on tmpfs; exported OCI layers preserve this APK DB.
RUN apk --root-tmpfs=no upgrade --no-cache && \
    apk --root-tmpfs=no add --no-cache /tmp/zlib.apk /tmp/dash.apk && rm /tmp/zlib.apk /tmp/dash.apk && \
    apk --root-tmpfs=no add --no-cache ca-certificates libstdc++ fontconfig font-dejavu curl && \
    addgroup -g 1001 -S spring && \
    adduser -u 1001 -S spring -G spring && \
    apk --root-tmpfs=no del --no-cache busybox busybox-binsh ssl_client
ENV JAVA_HOME=/opt/java
ENV PATH="$JAVA_HOME/bin:$PATH" \
    JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Djava.awt.headless=true"
WORKDIR /app
COPY --from=java-runtime /opt/java-runtime /opt/java
COPY --from=backend-build --chmod=0444 /app/target/website-0.0.1-SNAPSHOT.jar /app/app.jar
USER 1001:1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ["/usr/bin/dash", "-ec", "test \"$(curl --fail --silent --max-time 2 --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8080/actuator/health)\" = 200"]
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

# Run the packaged app as the production UID to verify the linked Java modules,
# PDF extraction, content parsing, and the actual generated web assets.
FROM runtime-base AS smoke-test
RUN --mount=type=bind,from=node-toolchain,source=/bin/busybox,target=/tmp/busybox \
    set -eu; \
    /tmp/busybox mkdir /tmp/website-smoke-tools; \
    /tmp/busybox --install -s /tmp/website-smoke-tools; \
    export PATH="/tmp/website-smoke-tools:$PATH"; \
    test "$(id -u)" = 1001; \
    test ! -e /bin/busybox; \
    test ! -e /usr/bin/ssl_client; \
    test ! -e /opt/java/bin/javac; \
    java -version; \
    java $JAVA_OPTS -jar /app/app.jar > /tmp/website-smoke.log 2>&1 & \
    app_pid=$!; \
    cleanup() { kill "$app_pid" 2>/dev/null || true; wait "$app_pid" 2>/dev/null || true; /tmp/busybox rm -rf /tmp/website-smoke-tools; }; \
    trap cleanup EXIT; \
    attempt=0; \
    while [ "$attempt" -lt 60 ]; do \
      if ! kill -0 "$app_pid" 2>/dev/null; then cat /tmp/website-smoke.log; exit 1; fi; \
      if wget -T 5 -qO /tmp/website-health.json http://127.0.0.1:8080/actuator/health; then break; fi; \
      attempt=$((attempt + 1)); \
      sleep 2; \
    done; \
    if [ "$attempt" -ge 60 ]; then cat /tmp/website-smoke.log; exit 1; fi; \
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' /tmp/website-health.json; \
    health_status="$(curl --fail --silent --max-time 5 --output /tmp/website-curl-health.json --write-out '%{http_code}' http://127.0.0.1:8080/actuator/health)"; \
    test "$health_status" = 200; \
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' /tmp/website-curl-health.json; \
    wget -T 5 -qO /tmp/website-client-info.json http://127.0.0.1:8080/api/client/info; \
    grep -Eq '"hostname"[[:space:]]*:[[:space:]]*"javadevjt[.]tech"' /tmp/website-client-info.json; \
    grep -Eq '"username"[[:space:]]*:[[:space:]]*"visitor"' /tmp/website-client-info.json; \
    wget -T 5 -qO /tmp/website-portfolio.json http://127.0.0.1:8080/api/content/portfolio/list; \
    grep -q 'Discord Option Tailer' /tmp/website-portfolio.json; \
    grep -q 'Embedify' /tmp/website-portfolio.json; \
    wget -T 5 -qO /tmp/website-resume.json http://127.0.0.1:8080/api/content/resume; \
    grep -q 'Senior Software Engineer' /tmp/website-resume.json; \
    wget -T 5 -qO /tmp/website-index.html http://127.0.0.1:8080/; \
    js_asset="$(grep -oE 'src="/assets/[^"]+[.]js"' /tmp/website-index.html | head -n 1 | cut -d '"' -f 2)"; \
    css_asset="$(grep -oE 'href="/assets/[^"]+[.]css"' /tmp/website-index.html | head -n 1 | cut -d '"' -f 2)"; \
    test -n "$js_asset" && test -n "$css_asset"; \
    wget -T 5 -qO /tmp/website-app.js "http://127.0.0.1:8080$js_asset"; \
    wget -T 5 -qO /tmp/website-app.css "http://127.0.0.1:8080$css_asset"; \
    test -s /tmp/website-app.js && test -s /tmp/website-app.css

# Scan the runtime filesystem, including OS packages and nested Java libraries.
# CI always reruns this stage against fresh vulnerability data.
FROM aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969 AS security-scan
COPY --from=smoke-test / /scan-root/
RUN trivy rootfs --scanners vuln --exit-code 1 --timeout 10m /scan-root && touch /scan-passed

# Default builds publish only the application and linked runtime.
FROM runtime-base AS runtime
# This read-only build mount forces publication to depend on a scan of this
# exact runtime-base filesystem without shipping the scanner or scan files.
RUN --mount=type=bind,from=security-scan,source=/scan-passed,target=/scan-passed \
    test -f /scan-passed

# Maven's resource lifecycle builds the Vite assets, so provide both toolchains
# to the builder while keeping the runtime image limited to the JRE.
FROM node:24-alpine AS node-toolchain

FROM maven:3.9.16-eclipse-temurin-21-alpine AS backend-build

RUN apk add --no-cache libstdc++
COPY --from=node-toolchain /usr/local/ /usr/local/

WORKDIR /app

COPY pom.xml ./
COPY mvnw ./
COPY .mvn ./.mvn
COPY frontend ./frontend
COPY src ./src

# The Maven lifecycle runs npm ci and the frontend build before packaging.
RUN ./mvnw --batch-mode clean package -DskipTests

# Stage 3: Runtime
FROM eclipse-temurin:21-jre-alpine AS runtime-base

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S spring && \
    adduser -u 1001 -S spring -G spring

# Copy JAR from build stage
COPY --from=backend-build /app/target/*.jar app.jar

# Copy resources directory (for markdown files)
COPY --from=backend-build /app/src/main/resources ./resources

# Change ownership
RUN chown -R spring:spring /app

# Switch to non-root user
USER spring:spring

# Expose port
EXPOSE 8080

# Actuator exposes the application's health status without relying on a
# client-information API as a readiness signal.
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Set JVM options
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

# Run application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

# BuildKit runs this stage as the same non-root runtime user. Starting the
# packaged application here verifies the runtime filesystem without needing a
# Docker daemon or exporting an image from the remote builder.
FROM runtime-base AS smoke-test
RUN set -eu; \
    java $JAVA_OPTS -jar app.jar > /tmp/website-smoke.log 2>&1 & \
    app_pid=$!; \
    cleanup() { kill "$app_pid" 2>/dev/null || true; wait "$app_pid" 2>/dev/null || true; }; \
    trap cleanup EXIT; \
    attempt=0; \
    while [ "$attempt" -lt 60 ]; do \
      if ! kill -0 "$app_pid" 2>/dev/null; then cat /tmp/website-smoke.log; exit 1; fi; \
        if wget -T 5 -qO /tmp/website-health.json http://127.0.0.1:8080/actuator/health; then break; fi; \
      attempt=$((attempt + 1)); \
      sleep 2; \
    done; \
    if [ "$attempt" -ge 60 ]; then cat /tmp/website-smoke.log; exit 1; fi; \
    if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' /tmp/website-health.json; then cat /tmp/website-health.json; exit 1; fi; \
    if ! wget -T 5 -qO /tmp/website-client-info.json http://127.0.0.1:8080/api/client/info; then cat /tmp/website-smoke.log; exit 1; fi; \
    grep -Eq '"hostname"[[:space:]]*:[[:space:]]*"javadevjt\.tech"' /tmp/website-client-info.json; \
    grep -Eq '"username"[[:space:]]*:[[:space:]]*"visitor"' /tmp/website-client-info.json; \
    if ! wget -T 5 -qO /tmp/website-portfolio.json http://127.0.0.1:8080/api/content/portfolio/list; then cat /tmp/website-smoke.log; exit 1; fi; \
    if ! grep -Eq '"filename"|RouteListToTesla' /tmp/website-portfolio.json; then cat /tmp/website-portfolio.json; exit 1; fi; \
    if ! wget -T 5 -qO /tmp/website-index.html http://127.0.0.1:8080/; then cat /tmp/website-smoke.log; exit 1; fi; \
    js_asset="$(grep -oE 'src="/assets/[^"]+\.js"' /tmp/website-index.html | head -n 1 | cut -d '"' -f 2)"; \
    css_asset="$(grep -oE 'href="/assets/[^"]+\.css"' /tmp/website-index.html | head -n 1 | cut -d '"' -f 2)"; \
    test -n "$js_asset" && test -n "$css_asset"; \
    wget -T 5 -qO /tmp/website-app.js "http://127.0.0.1:8080$js_asset"; \
    wget -T 5 -qO /tmp/website-app.css "http://127.0.0.1:8080$css_asset"; \
    test -s /tmp/website-app.js && test -s /tmp/website-app.css

# Keep normal image builds on the production runtime stage; CI explicitly
# selects smoke-test to execute the verification above.
FROM runtime-base AS runtime

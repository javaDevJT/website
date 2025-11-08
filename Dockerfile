# Multi-stage Dockerfile for Spring Boot + React Application
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (outputs to ../src/main/resources/static)
RUN npm run build

# Stage 2: Build Backend
FROM maven:3.9-eclipse-temurin-21-alpine AS backend-build

WORKDIR /app

# Copy Maven files
COPY pom.xml ./
COPY mvnw ./
COPY .mvn ./.mvn

# Copy source code
COPY src ./src

# Copy built frontend from previous stage
COPY --from=frontend-build /app/src/main/resources/static ./src/main/resources/static

# Build Spring Boot application (skip frontend build in Maven)
RUN mvn clean package -DskipTests -Dexec.skip=true

# Stage 3: Runtime
FROM eclipse-temurin:21-jre-alpine

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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/client/info || exit 1

# Set JVM options
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

# Run application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

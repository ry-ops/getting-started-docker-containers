# Docker Optimization Guide

Advanced techniques for optimizing Docker images and containers for production.

## Table of Contents

- [Image Size Optimization](#image-size-optimization)
- [Build Performance](#build-performance)
- [Runtime Performance](#runtime-performance)
- [Multi-Stage Builds](#multi-stage-builds)
- [Layer Caching](#layer-caching)
- [BuildKit Features](#buildkit-features)
- [Language-Specific Optimizations](#language-specific-optimizations)
- [Production Optimizations](#production-optimizations)
- [Monitoring and Profiling](#monitoring-and-profiling)

## Image Size Optimization

### 1. Choose the Right Base Image

```dockerfile
# Comparison (approximate sizes)
FROM node:20                    # ~1000 MB
FROM node:20-slim              # ~200 MB
FROM node:20-alpine            # ~150 MB
FROM gcr.io/distroless/nodejs  # ~100 MB
```

**Recommendation**: Start with Alpine, use distroless for production.

### 2. Multi-Stage Builds

Separate build dependencies from runtime:

```dockerfile
# Build stage (larger)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install  # Includes dev dependencies
COPY . .
RUN npm run build

# Production stage (smaller)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

**Size reduction**: 50-70% smaller final image.

### 3. Clean Up in Same Layer

```dockerfile
# Bad: Creates 3 layers, cleanup doesn't reduce size
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get clean

# Good: Single layer, cleanup effective
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### 4. Use .dockerignore

Exclude unnecessary files:

```dockerignore
# Version control
.git
.gitignore

# Dependencies
node_modules
vendor/

# Documentation
*.md
docs/

# Tests
tests/
*.test.js

# Development files
.env
.env.local
docker-compose*.yml

# Build artifacts
dist/
build/
*.log

# OS files
.DS_Store
Thumbs.db
```

**Impact**: Faster builds, smaller context, fewer cache invalidations.

### 5. Remove Build Dependencies

```dockerfile
# Python example
FROM python:3.12-alpine AS builder
RUN apk add --no-cache gcc musl-dev linux-headers
RUN pip install --user -r requirements.txt

FROM python:3.12-alpine
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
```

### 6. Minimize Installed Packages

```dockerfile
# Bad: Installs recommended packages
RUN apt-get install curl

# Good: Minimal installation
RUN apt-get install -y --no-install-recommends curl
```

## Build Performance

### 1. Layer Caching Strategy

Order Dockerfile instructions from least to most frequently changing:

```dockerfile
FROM node:20-alpine

# 1. OS packages (rarely change)
RUN apk add --no-cache git curl

# 2. Dependencies (change occasionally)
COPY package*.json ./
RUN npm ci --only=production

# 3. Application code (changes frequently)
COPY . .

# 4. Build step (depends on code)
RUN npm run build
```

### 2. Separate Dependencies from Code

```dockerfile
# Efficient caching
COPY package*.json ./
RUN npm install
COPY . .

# Not efficient (invalidates cache on any file change)
COPY . .
RUN npm install
```

### 3. BuildKit Cache Mounts

Enable BuildKit:
```bash
export DOCKER_BUILDKIT=1
```

Use cache mounts:
```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine

# Cache npm packages across builds
RUN --mount=type=cache,target=/root/.npm \
    npm install

# Cache pip packages
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Cache Go modules
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
```

**Benefit**: Dependencies don't rebuild unless files change.

### 4. Parallel Builds

Build multiple images simultaneously:

```bash
# Build multiple services in parallel
docker-compose build --parallel

# Or with BuildKit
docker buildx build --platform linux/amd64,linux/arm64 .
```

### 5. Build Cache from Registry

```dockerfile
# Build with inline cache
docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t myapp:latest .

# Push to registry
docker push myapp:latest

# On another machine, use cached layers
docker build --cache-from myapp:latest -t myapp:latest .
```

## Runtime Performance

### 1. Resource Limits

```bash
# Memory limits
docker run -m 512m --memory-swap 512m myapp

# CPU limits
docker run --cpus="1.5" myapp

# Combined
docker run -m 512m --cpus="1.5" myapp
```

In docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. Read-Only Root Filesystem

```bash
docker run --read-only --tmpfs /tmp myapp
```

In Dockerfile:
```dockerfile
# Make sure app doesn't write to root filesystem
USER appuser
VOLUME /tmp
```

### 3. Optimize Application Startup

```dockerfile
# Node.js: Use production mode
ENV NODE_ENV=production

# Python: Disable bytecode generation
ENV PYTHONDONTWRITEBYTECODE=1

# Java: Optimize JVM flags
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC"
```

### 4. Use Init System

Properly handle signals and zombie processes:

```dockerfile
# Use tini
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

Or:
```bash
docker run --init myapp
```

### 5. Logging Optimization

```dockerfile
# Stdout/stderr logging (Docker handles it)
CMD ["node", "server.js"]
```

Configure log rotation:
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Multi-Stage Builds

### Advanced Pattern: Multiple Architectures

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.21-alpine AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o app

FROM alpine:latest
COPY --from=builder /app/app /app
CMD ["/app"]
```

Build for multiple platforms:
```bash
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t myapp:latest .
```

### Pattern: Shared Base

```dockerfile
# Base stage with common dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development
FROM base AS development
RUN npm install  # Include dev dependencies
COPY . .
CMD ["npm", "run", "dev"]

# Test
FROM development AS test
RUN npm test

# Production
FROM base AS production
COPY --from=test /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### Pattern: Build-Time Tests

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Test the build
FROM builder AS test
RUN npm test
RUN npm run lint

# Production (fails if tests fail)
FROM node:20-alpine
COPY --from=test /app/dist ./dist
CMD ["node", "dist/index.js"]
```

## Layer Caching

### Understanding Cache Invalidation

```dockerfile
# Any change to Dockerfile line invalidates all subsequent layers
FROM node:20-alpine          # Layer 1: Cached
COPY package*.json ./        # Layer 2: Cached if files unchanged
RUN npm install              # Layer 3: Cached if Layer 2 cached
COPY . .                     # Layer 4: Invalidated on any code change
RUN npm run build            # Layer 5: Invalidated because Layer 4 changed
```

### Optimizing Cache Hits

```dockerfile
# Separate frequently changing files
COPY package*.json ./
RUN npm install

# Copy source last
COPY src/ ./src/
COPY public/ ./public/

# Each COPY is cached independently
```

### Cache for Package Managers

```dockerfile
# syntax=docker/dockerfile:1

# Node.js
FROM node:20-alpine
RUN --mount=type=cache,target=/root/.npm \
    npm install

# Python
FROM python:3.12-alpine
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Go
FROM golang:1.21-alpine
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Rust
FROM rust:1.75-alpine
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release
```

## BuildKit Features

### 1. Enable BuildKit

```bash
# Permanently
export DOCKER_BUILDKIT=1
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc

# Per-build
DOCKER_BUILDKIT=1 docker build .
```

### 2. Syntax Parser

```dockerfile
# syntax=docker/dockerfile:1.4

# Enables latest Dockerfile features
FROM node:20-alpine
```

### 3. Secret Mounts

Don't bake secrets into images:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine

# Mount secret at build time (not stored in image)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install private-package
```

Build with secret:
```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

### 4. SSH Mounts

For private repositories:

```dockerfile
# syntax=docker/dockerfile:1

FROM alpine:latest

RUN apk add git openssh-client

# Mount SSH keys (not stored in image)
RUN --mount=type=ssh \
    git clone git@github.com:user/private-repo.git
```

Build with SSH:
```bash
docker build --ssh default .
```

### 5. Bind Mounts

Mount files at build time:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine

# Mount local node_modules (don't copy)
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci
```

### 6. BuildKit Progress

```bash
# Plain output
BUILDKIT_PROGRESS=plain docker build .

# Auto (default, fancy UI)
BUILDKIT_PROGRESS=auto docker build .
```

## Language-Specific Optimizations

### Node.js

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Build
COPY . .
RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production files
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Optimizations:**
- Multi-stage build
- Production dependencies only
- Layer caching for dependencies
- Non-root user
- Minimal base image

### Python

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-alpine AS builder

WORKDIR /app

# Build dependencies
RUN apk add --no-cache gcc musl-dev linux-headers

# Virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Cache pip packages
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

FROM python:3.12-alpine

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# Copy virtual environment
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

**Optimizations:**
- Virtual environment isolation
- Build dependencies removed
- Pip cache mount
- Bytecode generation disabled
- Non-root user

### Go

```dockerfile
# syntax=docker/dockerfile:1

FROM golang:1.21-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Build
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

COPY --from=builder --chown=appuser:appuser /app/app .

USER appuser

EXPOSE 8080

CMD ["./app"]
```

**Optimizations:**
- Static binary (CGO_ENABLED=0)
- Minimal runtime (Alpine)
- Go module cache
- Build cache

### Java

```dockerfile
# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn dependency:go-offline

# Build
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S spring && \
    adduser -S spring -u 1001

COPY --from=builder --chown=spring:spring /app/target/*.jar app.jar

USER spring

EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

**Optimizations:**
- Maven dependency cache
- JRE instead of JDK
- Optimized JVM flags
- Non-root user

## Production Optimizations

### 1. Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1
```

### 2. Graceful Shutdown

Application code:
```javascript
// Node.js
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### 3. Security Scanning

```bash
# Docker scan
docker scan myapp:latest

# Trivy
trivy image myapp:latest

# Snyk
snyk container test myapp:latest

# Anchore
anchore-cli image scan myapp:latest
```

### 4. Image Signing

```bash
# Enable content trust
export DOCKER_CONTENT_TRUST=1

# Sign and push
docker trust sign myapp:latest
```

### 5. Metadata Labels

```dockerfile
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/user/repo"
```

## Monitoring and Profiling

### 1. Analyze Image Layers

```bash
# View layer history
docker history myapp:latest

# Detailed layer analysis with dive
dive myapp:latest
```

### 2. Image Size Analysis

```bash
# List images with sizes
docker images

# Detailed size breakdown
docker system df -v
```

### 3. Build Time Analysis

```bash
# BuildKit progress output
BUILDKIT_PROGRESS=plain docker build . 2>&1 | tee build.log

# Analyze build time per layer
grep "DONE" build.log
```

### 4. Runtime Monitoring

```bash
# Container stats
docker stats

# Detailed container info
docker inspect myapp

# Resource usage
docker top myapp
```

### 5. Benchmark Tools

```bash
# Apache Bench
ab -n 1000 -c 10 http://localhost:3000/

# wrk
wrk -t12 -c400 -d30s http://localhost:3000/

# Load testing with Docker
docker run --rm williamyeh/wrk -t12 -c400 -d30s http://host.docker.internal:3000/
```

## Optimization Checklist

### Image Size
- [ ] Use Alpine or distroless base images
- [ ] Implement multi-stage builds
- [ ] Clean up in same RUN layer
- [ ] Use .dockerignore
- [ ] Remove build dependencies
- [ ] Minimize installed packages

### Build Performance
- [ ] Order Dockerfile efficiently
- [ ] Separate dependencies from code
- [ ] Use BuildKit cache mounts
- [ ] Enable BuildKit
- [ ] Use build cache from registry

### Runtime Performance
- [ ] Set resource limits
- [ ] Use read-only filesystem where possible
- [ ] Optimize application startup
- [ ] Use init system for process management
- [ ] Configure logging properly

### Security
- [ ] Run as non-root user
- [ ] Scan for vulnerabilities
- [ ] Use specific image tags
- [ ] Don't store secrets in images
- [ ] Keep base images updated

### Production
- [ ] Add health checks
- [ ] Implement graceful shutdown
- [ ] Add metadata labels
- [ ] Test builds regularly
- [ ] Monitor resource usage

## Tools

### Image Analysis
- **dive**: Layer-by-layer image analysis
- **docker-slim**: Automated image optimization
- **hadolint**: Dockerfile linter

### Security
- **trivy**: Vulnerability scanner
- **snyk**: Container security
- **anchore**: Image scanning
- **clair**: Vulnerability static analysis

### Build
- **buildx**: Extended build capabilities
- **buildkit**: Enhanced build engine
- **kaniko**: Daemonless builds

### Monitoring
- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **cAdvisor**: Container metrics

## Summary

Key optimization strategies:

1. **Image Size**: Use minimal base images, multi-stage builds, and proper cleanup
2. **Build Speed**: Leverage layer caching, BuildKit features, and parallel builds
3. **Runtime**: Set resource limits, optimize startup, and use proper process management
4. **Security**: Scan regularly, use non-root users, and keep images updated

Always measure before and after optimizations to ensure real improvements.

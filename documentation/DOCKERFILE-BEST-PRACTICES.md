# Dockerfile Best Practices

A comprehensive guide to writing efficient, secure, and maintainable Dockerfiles.

## Table of Contents

- [General Principles](#general-principles)
- [Image Selection](#image-selection)
- [Layer Optimization](#layer-optimization)
- [Security](#security)
- [Multi-Stage Builds](#multi-stage-builds)
- [Caching Strategies](#caching-strategies)
- [Health Checks](#health-checks)
- [Examples](#examples)

## General Principles

### 1. Use .dockerignore

Exclude unnecessary files from the build context:

```dockerignore
node_modules
.git
.env
*.md
.DS_Store
coverage
dist
```

**Benefits:**
- Faster build times
- Smaller build context
- Prevents accidental inclusion of secrets

### 2. Order Instructions Properly

Place instructions from least to most frequently changing:

```dockerfile
# Good: Stable instructions first
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Bad: Frequently changing instructions first
FROM node:20-alpine
COPY . .                    # Changes often
RUN npm install             # Invalidates cache
```

### 3. Minimize Layers

Combine related RUN commands:

```dockerfile
# Good: Single layer
RUN apk add --no-cache \
    git \
    curl \
    && rm -rf /tmp/*

# Bad: Multiple layers
RUN apk add --no-cache git
RUN apk add --no-cache curl
RUN rm -rf /tmp/*
```

## Image Selection

### Choose Minimal Base Images

```dockerfile
# Best: Alpine (5-10 MB)
FROM node:20-alpine

# Good: Slim (100-200 MB)
FROM node:20-slim

# Avoid: Full (800+ MB)
FROM node:20
```

### Use Specific Tags

```dockerfile
# Good: Specific version
FROM node:20.10.0-alpine3.19

# Bad: Latest tag
FROM node:latest
```

### Consider Distroless

For maximum security and minimal size:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /app /app
WORKDIR /app
CMD ["app.js"]
```

## Layer Optimization

### 1. Leverage Build Cache

Copy dependency files before application code:

```dockerfile
# Dependencies change less frequently
COPY package*.json ./
RUN npm install

# Application code changes frequently
COPY . .
```

### 2. Clean Up in Same Layer

```dockerfile
# Good: Clean up in same RUN command
RUN apt-get update && \
    apt-get install -y build-essential && \
    # ... build steps ... && \
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Bad: Separate RUN commands
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get purge -y build-essential  # Size already committed
```

### 3. Use --no-cache Flags

```dockerfile
# APK (Alpine)
RUN apk add --no-cache curl

# APT (Debian/Ubuntu)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# NPM
RUN npm install --production && \
    npm cache clean --force

# PIP
RUN pip install --no-cache-dir -r requirements.txt
```

## Security

### 1. Run as Non-Root User

```dockerfile
# Create user and group
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# Set ownership
COPY --chown=appuser:appuser . .

# Switch to user
USER appuser
```

### 2. Use Read-Only Root Filesystem

```dockerfile
# In Dockerfile
USER appuser

# Run with read-only flag
docker run --read-only --tmpfs /tmp myapp
```

### 3. Scan for Vulnerabilities

```bash
# Use Docker scan
docker scan myimage:latest

# Use Trivy
trivy image myimage:latest

# Use Snyk
snyk container test myimage:latest
```

### 4. Don't Store Secrets

```dockerfile
# Bad: Hardcoded secrets
ENV DATABASE_PASSWORD=supersecret

# Good: Use secrets at runtime
docker run -e DATABASE_PASSWORD=$DB_PASS myapp

# Best: Use Docker secrets
docker secret create db_password password.txt
```

### 5. Use Specific Versions

```dockerfile
# Good: Pinned versions
RUN pip install flask==3.0.0 gunicorn==21.2.0

# Bad: Unpinned versions
RUN pip install flask gunicorn
```

## Multi-Stage Builds

### Pattern 1: Build and Runtime Separation

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### Pattern 2: Multiple Targets

```dockerfile
# Base stage
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
RUN npm ci --only=production
COPY . .
CMD ["node", "index.js"]
```

Build specific target:
```bash
docker build --target development -t myapp:dev .
docker build --target production -t myapp:prod .
```

### Pattern 3: Testing in Build

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Test stage
FROM builder AS test
RUN npm test

# Production (automatically fails if tests fail)
FROM node:20-alpine AS production
COPY --from=test /app/dist ./dist
```

## Caching Strategies

### 1. BuildKit Cache Mounts

Enable BuildKit:
```bash
export DOCKER_BUILDKIT=1
```

Use cache mounts:
```dockerfile
# Syntax directive
# syntax=docker/dockerfile:1

FROM node:20-alpine

# Cache npm packages
RUN --mount=type=cache,target=/root/.npm \
    npm install

# Cache pip packages
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

### 2. External Cache

```bash
# Export cache
docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t myapp .

# Use cache from registry
docker build --cache-from myapp:latest -t myapp:new .
```

### 3. Layer Caching Best Practices

```dockerfile
# Good order: least to most frequently changing
FROM node:20-alpine

# 1. System dependencies (rarely change)
RUN apk add --no-cache git

# 2. Application dependencies (change occasionally)
COPY package*.json ./
RUN npm install

# 3. Application code (changes frequently)
COPY . .

# 4. Build step (changes with code)
RUN npm run build
```

## Health Checks

### Basic Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### HTTP Health Check (No curl)

```dockerfile
# Node.js
HEALTHCHECK CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Python
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
```

### TCP Health Check

```dockerfile
HEALTHCHECK CMD nc -z localhost 3000 || exit 1
```

### Custom Script

```dockerfile
COPY healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/healthcheck.sh
HEALTHCHECK CMD healthcheck.sh
```

## Examples

### Optimized Node.js Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
```

### Optimized Python Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev linux-headers

# Copy and install Python dependencies
COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    python -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt

FROM python:3.12-alpine

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# Copy virtual environment
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

## Common Pitfalls to Avoid

### 1. Using Latest Tag

```dockerfile
# Bad
FROM node:latest

# Good
FROM node:20.10.0-alpine3.19
```

### 2. Installing Unnecessary Dependencies

```dockerfile
# Bad
RUN apt-get install -y build-essential python3 curl wget vim

# Good
RUN apt-get install -y --no-install-recommends build-essential
```

### 3. Running as Root

```dockerfile
# Bad: No USER instruction

# Good: Non-root user
USER nodejs
```

### 4. Copying Everything First

```dockerfile
# Bad: Invalidates cache on any file change
COPY . .
RUN npm install

# Good: Copy dependencies first
COPY package*.json ./
RUN npm install
COPY . .
```

### 5. Multiple FROM Without Multi-Stage

```dockerfile
# Bad: Last FROM is the only one used
FROM node:20-alpine
RUN npm install
FROM python:3.12-alpine  # Previous stage wasted
```

## Tools and Resources

### Linting and Analysis

- **hadolint**: Dockerfile linter
  ```bash
  docker run --rm -i hadolint/hadolint < Dockerfile
  ```

- **dive**: Explore image layers
  ```bash
  dive myimage:latest
  ```

- **docker-slim**: Minify and optimize images
  ```bash
  docker-slim build myimage:latest
  ```

### Build Tools

- **BuildKit**: Enhanced build engine
  ```bash
  export DOCKER_BUILDKIT=1
  ```

- **Buildx**: Extended build capabilities
  ```bash
  docker buildx build --platform linux/amd64,linux/arm64 .
  ```

## Summary Checklist

- [ ] Use specific base image tags
- [ ] Implement multi-stage builds
- [ ] Run as non-root user
- [ ] Optimize layer caching
- [ ] Include .dockerignore file
- [ ] Add health checks
- [ ] Clean up in same layer
- [ ] Use --no-cache flags for package managers
- [ ] Pin dependency versions
- [ ] Scan for vulnerabilities
- [ ] Test builds regularly
- [ ] Document custom build arguments
- [ ] Set appropriate resource limits
- [ ] Use BuildKit features
- [ ] Keep images small and focused

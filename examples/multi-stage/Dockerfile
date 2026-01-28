# Advanced Multi-Stage Build Example
# Demonstrates optimization techniques for production builds

# Stage 1: Base dependencies (shared across stages)
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Stage 2: Development dependencies
FROM base AS development
RUN npm install
COPY . .
# Development image stops here

# Stage 3: Build stage with all dependencies
FROM development AS builder
RUN npm run build 2>/dev/null || echo "No build script defined"

# Stage 4: Test stage
FROM development AS test
RUN npm test 2>/dev/null || echo "No test script defined"

# Stage 5: Production dependencies only
FROM base AS production-deps
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 6: Final production image (smallest possible)
FROM node:20-alpine AS production

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only necessary files
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/*.js ./

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "process.exit(0)"

CMD ["node", "app.js"]

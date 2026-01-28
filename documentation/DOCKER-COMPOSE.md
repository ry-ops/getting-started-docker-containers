# Docker Compose Guide

Comprehensive guide to using Docker Compose for multi-container applications.

## Table of Contents

- [Introduction](#introduction)
- [Basic Concepts](#basic-concepts)
- [Compose File Structure](#compose-file-structure)
- [Service Configuration](#service-configuration)
- [Networks](#networks)
- [Volumes](#volumes)
- [Environment Variables](#environment-variables)
- [Dependencies and Health Checks](#dependencies-and-health-checks)
- [Common Patterns](#common-patterns)
- [Commands Reference](#commands-reference)
- [Best Practices](#best-practices)

## Introduction

Docker Compose is a tool for defining and running multi-container Docker applications. With Compose, you use a YAML file to configure your application's services, networks, and volumes.

### When to Use Docker Compose

- Local development environments
- Automated testing environments
- Single-host deployments
- CI/CD pipelines

### When NOT to Use Docker Compose

- Production orchestration (use Kubernetes, Docker Swarm)
- Multi-host deployments
- Auto-scaling requirements
- Complex service mesh requirements

## Basic Concepts

### Services

A service is a containerized application component:

```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
```

### Networks

Networks enable communication between containers:

```yaml
networks:
  frontend:
  backend:
```

### Volumes

Volumes persist data and share it between containers:

```yaml
volumes:
  db-data:
  app-logs:
```

## Compose File Structure

### Basic Template

```yaml
version: '3.8'

services:
  service-name:
    # Service configuration

networks:
  network-name:
    # Network configuration

volumes:
  volume-name:
    # Volume configuration
```

### Version Compatibility

- `3.8`: Docker Engine 19.03.0+
- `3.7`: Docker Engine 18.06.0+
- `3.0-3.6`: Older versions

**Recommendation**: Use version 3.8 for modern features.

## Service Configuration

### Using Pre-built Images

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Building from Dockerfile

```yaml
services:
  app:
    build:
      context: ./app
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
      target: production
    image: myapp:latest
```

### Port Mapping

```yaml
services:
  web:
    ports:
      # HOST:CONTAINER
      - "8080:80"           # Bind to all interfaces
      - "127.0.0.1:8081:80" # Bind to localhost only
      - "3000-3005:3000"    # Range mapping
```

### Environment Variables

```yaml
services:
  app:
    environment:
      # Key-value pairs
      - NODE_ENV=production
      - PORT=3000
      # Or as a map
      DATABASE_URL: postgresql://db:5432/mydb
      REDIS_URL: redis://redis:6379
```

### Environment Files

```yaml
services:
  app:
    env_file:
      - ./config/.env
      - ./config/.env.production
```

`.env` file:
```
NODE_ENV=production
DATABASE_URL=postgresql://db:5432/mydb
API_KEY=your-api-key
```

### Volume Mounts

```yaml
services:
  app:
    volumes:
      # Named volume
      - app-data:/app/data

      # Bind mount (host path)
      - ./config:/app/config:ro  # Read-only

      # Anonymous volume
      - /app/node_modules

volumes:
  app-data:
```

### Resource Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Restart Policies

```yaml
services:
  app:
    restart: unless-stopped
    # Options: "no", "always", "on-failure", "unless-stopped"
```

### Commands and Entrypoints

```yaml
services:
  app:
    # Override default command
    command: ["npm", "start"]

    # Or as a string
    command: npm run dev

    # Override entrypoint
    entrypoint: /app/docker-entrypoint.sh
```

## Networks

### Default Network

By default, Compose creates a single network for your app:

```yaml
services:
  web:
    # Automatically joins default network
  db:
    # Can communicate with web via service name
```

### Custom Networks

```yaml
version: '3.8'

services:
  web:
    networks:
      - frontend
      - backend

  app:
    networks:
      - backend

  db:
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access
```

### Network Aliases

```yaml
services:
  app:
    networks:
      backend:
        aliases:
          - api
          - app-server
```

### External Networks

```yaml
networks:
  existing-network:
    external: true
    name: my-pre-existing-network
```

## Volumes

### Named Volumes

```yaml
services:
  db:
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
    driver: local
```

### Bind Mounts

```yaml
services:
  app:
    volumes:
      # Development: live code reload
      - ./src:/app/src

      # Configuration files
      - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
```

### Volume Configuration

```yaml
volumes:
  db-data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=10.0.0.1,rw
      device: ":/path/to/dir"
```

### External Volumes

```yaml
volumes:
  data:
    external: true
    name: my-existing-volume
```

### Temporary File Systems

```yaml
services:
  app:
    tmpfs:
      - /tmp
      - /run
```

## Environment Variables

### Substitution in Compose File

```yaml
services:
  app:
    image: myapp:${APP_VERSION:-latest}
    ports:
      - "${APP_PORT:-3000}:3000"
```

Environment file `.env`:
```
APP_VERSION=1.0.0
APP_PORT=8080
```

### Precedence Order

1. Compose file
2. Environment variables
3. .env file
4. Dockerfile

### Special Variables

- `${VARIABLE:-default}`: Use default if not set
- `${VARIABLE-default}`: Use default if not set (keeps empty values)
- `${VARIABLE:?error}`: Error if not set

## Dependencies and Health Checks

### Service Dependencies

```yaml
services:
  app:
    depends_on:
      - db
      - redis

  db:
    image: postgres:15

  redis:
    image: redis:7-alpine
```

**Note**: `depends_on` only waits for container to start, not for service to be ready.

### Health-Based Dependencies

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

### Health Check Examples

**PostgreSQL:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**MySQL:**
```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Redis:**
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 3
```

**HTTP Service:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s
```

**Custom Script:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "/app/healthcheck.sh"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Common Patterns

### Full-Stack Web Application

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - frontend-network

  # Backend API
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://db:5432/myapp
      - REDIS_URL=redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    networks:
      - frontend-network
      - backend-network

  # Database
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: secret
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - backend-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s

  # Cache
  cache:
    image: redis:7-alpine
    networks:
      - backend-network
    volumes:
      - cache-data:/data

networks:
  frontend-network:
  backend-network:
    internal: true

volumes:
  db-data:
  cache-data:
```

### Development Environment

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: development
    volumes:
      # Live code reload
      - ./src:/app/src
      # Preserve node_modules
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DEBUG=app:*
    ports:
      - "3000:3000"
      - "9229:9229"  # Debugger port
    command: npm run dev
```

### Microservices Architecture

```yaml
version: '3.8'

services:
  # API Gateway
  gateway:
    build: ./gateway
    ports:
      - "80:80"
    networks:
      - public
      - services

  # User Service
  user-service:
    build: ./services/user
    environment:
      - DB_HOST=user-db
    networks:
      - services
    depends_on:
      - user-db

  user-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: users
    volumes:
      - user-db-data:/var/lib/postgresql/data
    networks:
      - services

  # Order Service
  order-service:
    build: ./services/order
    environment:
      - DB_HOST=order-db
    networks:
      - services
    depends_on:
      - order-db

  order-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: orders
    volumes:
      - order-db-data:/var/lib/postgresql/data
    networks:
      - services

  # Message Queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"  # Management UI
    networks:
      - services

networks:
  public:
  services:
    internal: true

volumes:
  user-db-data:
  order-db-data:
```

## Commands Reference

### Basic Operations

```bash
# Start services
docker-compose up

# Start in detached mode
docker-compose up -d

# Start specific services
docker-compose up app db

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

### Building and Images

```bash
# Build or rebuild services
docker-compose build

# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build app

# Pull images
docker-compose pull
```

### Service Management

```bash
# List running services
docker-compose ps

# List all services (including stopped)
docker-compose ps -a

# Start stopped services
docker-compose start

# Stop running services (don't remove)
docker-compose stop

# Restart services
docker-compose restart

# Pause services
docker-compose pause

# Unpause services
docker-compose unpause
```

### Logs and Debugging

```bash
# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Logs for specific service
docker-compose logs app

# Last N lines
docker-compose logs --tail=100

# Timestamps
docker-compose logs -t
```

### Executing Commands

```bash
# Execute command in running container
docker-compose exec app sh

# Run one-off command
docker-compose run app npm test

# Run without dependencies
docker-compose run --no-deps app npm test

# Remove container after run
docker-compose run --rm app npm test
```

### Scaling

```bash
# Scale specific service
docker-compose up -d --scale app=3

# Scale multiple services
docker-compose up -d --scale app=3 --scale worker=5
```

### Validation and Configuration

```bash
# Validate compose file
docker-compose config

# View resolved configuration
docker-compose config --services

# View volumes
docker-compose config --volumes
```

## Best Practices

### 1. Use Version Control

```bash
# Commit docker-compose.yml
git add docker-compose.yml

# Don't commit .env files
echo ".env" >> .gitignore

# Provide .env.example
cp .env .env.example
# Remove sensitive values from .env.example
```

### 2. Environment-Specific Files

```
docker-compose.yml          # Base configuration
docker-compose.override.yml # Local development (auto-loaded)
docker-compose.prod.yml     # Production
docker-compose.test.yml     # Testing
```

Use multiple files:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### 3. Use Named Volumes

```yaml
# Good: Named volume
volumes:
  - db-data:/var/lib/postgresql/data

volumes:
  db-data:

# Avoid: Anonymous volumes (hard to manage)
volumes:
  - /var/lib/postgresql/data
```

### 4. Health Checks for Critical Services

```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### 5. Explicit Dependencies

```yaml
app:
  depends_on:
    db:
      condition: service_healthy
```

### 6. Resource Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
```

### 7. Network Isolation

```yaml
networks:
  frontend:
    # Public facing
  backend:
    internal: true  # No external access
```

### 8. Logging Configuration

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 9. Use .dockerignore

Create `.dockerignore` for each service:
```
node_modules
.git
*.md
.env
```

### 10. Security Practices

```yaml
services:
  app:
    # Don't run as root
    user: "1001:1001"

    # Read-only root filesystem
    read_only: true

    # Drop capabilities
    cap_drop:
      - ALL

    # No new privileges
    security_opt:
      - no-new-privileges:true
```

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
docker-compose logs service-name

# Check service status
docker-compose ps

# Validate compose file
docker-compose config
```

**Port already in use:**
```bash
# Check what's using the port
lsof -i :3000

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

**Can't connect between services:**
```bash
# Ensure services are on same network
# Use service name, not localhost
DATABASE_URL=postgresql://db:5432/mydb
```

**Volume permission issues:**
```bash
# Set correct user in container
user: "1001:1001"

# Or fix permissions in Dockerfile
RUN chown -R appuser:appuser /app/data
```

### Debugging Commands

```bash
# Inspect service
docker-compose exec app sh

# Check networks
docker network ls

# Inspect network
docker network inspect myproject_default

# Check volumes
docker volume ls

# Inspect volume
docker volume inspect myproject_db-data
```

## Migration from v2 to v3

Key changes:

```yaml
# v2
version: '2'
services:
  app:
    mem_limit: 512m
    cpu_shares: 512

# v3
version: '3.8'
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

## Summary

Docker Compose is ideal for:
- Development environments
- Testing setups
- Simple production deployments
- Learning container orchestration

Key concepts:
- Services: Containerized components
- Networks: Communication between containers
- Volumes: Data persistence
- Health checks: Service readiness
- Dependencies: Startup order

Use Docker Compose as a stepping stone to understanding container orchestration before moving to Kubernetes for production.

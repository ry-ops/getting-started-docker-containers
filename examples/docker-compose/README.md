# Docker Compose Full-Stack Example

A complete full-stack application demonstrating Docker Compose with multiple services.

## Architecture

- **App**: Node.js/Express web server
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

## Features

- Multi-container orchestration
- Service dependencies and health checks
- Persistent data with volumes
- Network isolation
- Environment variable configuration
- Database initialization
- Graceful shutdown handling

## Quick Start

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/stats` - User statistics (cached)
- `GET /api/cache/test` - Test Redis cache
- `GET /api/db/test` - Test database connection

## Testing the Stack

```bash
# Wait for services to be healthy
docker-compose ps

# Test the API
curl http://localhost:3000
curl http://localhost:3000/api/users
curl http://localhost:3000/api/stats

# Create a new user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Test database connection
curl http://localhost:3000/api/db/test

# Test Redis cache
curl http://localhost:3000/api/cache/test
```

## Service Management

```bash
# View running containers
docker-compose ps

# View logs for specific service
docker-compose logs app
docker-compose logs postgres

# Execute commands in containers
docker-compose exec app sh
docker-compose exec postgres psql -U appuser -d appdb
docker-compose exec redis redis-cli

# Restart specific service
docker-compose restart app

# Scale services (if stateless)
docker-compose up -d --scale app=3
```

## Data Persistence

Volumes are used for data persistence:
- `postgres-data`: PostgreSQL database files
- `redis-data`: Redis persistence files

Data persists even after containers are stopped or removed.

## Network Configuration

All services communicate via the `app-network` bridge network:
- Services can reference each other by service name
- Isolated from other Docker networks
- Internal DNS resolution

## Environment Variables

Configure via `.env` file or docker-compose.yml:
- `NODE_ENV`: Application environment
- `DB_HOST`, `DB_PORT`, `DB_NAME`: Database configuration
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration

## Health Checks

All services have health checks:
- App: HTTP health endpoint
- PostgreSQL: `pg_isready` check
- Redis: `redis-cli ping` check

Use `docker-compose ps` to view health status.

## Best Practices Demonstrated

- Dependency management with `depends_on`
- Health check conditions
- Named volumes for persistence
- Custom networks
- Environment variables
- Restart policies
- Database initialization scripts
- Connection pooling
- Graceful shutdown handling
- Non-root users in containers

# Getting Started with Docker Containers

A comprehensive guide to Docker containerization with practical examples and best practices.

## Quick Start

1. **Prerequisites**
   - Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
   - Basic understanding of command line

2. **Clone this repository**
   ```bash
   git clone https://github.com/ry-ops/getting-started-docker-containers.git
   cd getting-started-docker-containers
   ```

3. **Try the examples**
   ```bash
   # Node.js application
   cd examples/node-app
   docker build -t node-app .
   docker run -p 3000:3000 node-app

   # Python application
   cd examples/python-app
   docker build -t python-app .
   docker run -p 8000:8000 python-app

   # Multi-stage build
   cd examples/multi-stage
   docker build -t multi-stage-app .

   # Docker Compose full-stack
   cd examples/docker-compose
   docker-compose up
   ```

## Repository Structure

```
.
├── examples/
│   ├── node-app/           # Simple Node.js application
│   ├── python-app/         # Simple Python application
│   ├── multi-stage/        # Optimized multi-stage builds
│   └── docker-compose/     # Full-stack app with database
└── documentation/
    ├── DOCKERFILE-BEST-PRACTICES.md
    ├── DOCKER-COMPOSE.md
    └── OPTIMIZATION.md
```

## Examples

### Node.js Application
A simple Express.js web server demonstrating:
- Multi-stage builds for smaller images
- Non-root user for security
- Proper dependency caching
- Health checks

### Python Application
A Flask web application showing:
- Minimal base images (Alpine)
- Virtual environment best practices
- Layer optimization
- Security considerations

### Multi-Stage Builds
Advanced examples demonstrating:
- Build-time vs runtime dependencies
- Image size optimization
- Different patterns for various languages

### Docker Compose
Full-stack application with:
- Web application
- PostgreSQL database
- Redis cache
- Network configuration
- Volume management

## Best Practices

### Image Size Optimization
- Use multi-stage builds to separate build and runtime dependencies
- Choose minimal base images (Alpine, distroless)
- Combine RUN commands to reduce layers
- Use .dockerignore to exclude unnecessary files

### Security
- Run containers as non-root users
- Scan images for vulnerabilities
- Keep base images updated
- Use specific image tags, not `latest`
- Minimize installed packages

### Build Efficiency
- Order Dockerfile instructions from least to most frequently changing
- Cache dependencies separately from application code
- Use build cache effectively
- Leverage BuildKit features

### Production Ready
- Include health checks
- Use environment variables for configuration
- Implement proper logging
- Set resource limits
- Use restart policies

## Documentation

Comprehensive guides available in the `documentation/` directory:

- **[Dockerfile Best Practices](documentation/DOCKERFILE-BEST-PRACTICES.md)** - Writing efficient and secure Dockerfiles
- **[Docker Compose Guide](documentation/DOCKER-COMPOSE.md)** - Multi-container applications
- **[Optimization Techniques](documentation/OPTIMIZATION.md)** - Advanced optimization strategies

## Common Commands

```bash
# Build an image
docker build -t image-name .

# Run a container
docker run -p host-port:container-port image-name

# View running containers
docker ps

# Stop a container
docker stop container-id

# Remove containers
docker rm container-id

# View images
docker images

# Remove images
docker rmi image-name

# View logs
docker logs container-id

# Execute command in running container
docker exec -it container-id /bin/sh

# Docker Compose
docker-compose up           # Start services
docker-compose down         # Stop services
docker-compose logs         # View logs
docker-compose ps           # List services
```

## Resources

- [Docker Official Documentation](https://docs.docker.com/)
- [Docker Hub](https://hub.docker.com/)
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**ry-ops**

---

**Happy Containerizing!**

# Multi-Stage Build Example

This example demonstrates advanced multi-stage build techniques for optimizing Docker images.

## Key Benefits

1. **Smaller Image Size**: Only production dependencies in final image
2. **Better Security**: Separate build tools from runtime environment
3. **Layer Caching**: Efficient rebuilds with proper layer ordering
4. **Flexibility**: Target specific stages for different environments

## Build Stages

1. **base**: Common dependencies shared across stages
2. **development**: All dependencies including dev tools
3. **builder**: Compile/build application
4. **test**: Run tests in isolated environment
5. **production-deps**: Production dependencies only
6. **production**: Final minimal runtime image

## Usage

```bash
# Build production image (default)
docker build -t multi-stage-app .

# Build specific stage (e.g., development)
docker build --target development -t multi-stage-app:dev .

# Build test stage
docker build --target test -t multi-stage-app:test .

# Run production image
docker run -p 3000:3000 multi-stage-app
```

## Image Size Comparison

```bash
# Check image sizes
docker images | grep multi-stage

# You'll see production image is significantly smaller than development
```

## Best Practices Demonstrated

- Shared base stage for consistency
- Separate build and runtime dependencies
- Non-root user in production
- Minimal final image
- Layer caching optimization
- Health checks

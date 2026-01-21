# Testing Guide

## Overview

This project uses **Testcontainers** for integration tests that require external services like Redis.

## Prerequisites

### Docker

Integration tests require Docker to be installed and running:

```bash
# Check if Docker is running
docker info

# If not running, start Docker Desktop or Docker daemon
```

## Test Types

### Unit Tests

Run without Docker dependency:

```bash
npm test tests/unit/
npm test tests/contract/ # Fake drivers only
```

### Integration Tests

Require Docker to be running:

```bash
# Start Docker first, then:
npm test tests/integration/
npm test tests/contract/drivers.test.ts # Includes Redis contract tests
```

## Behavior When Docker is Unavailable

Tests that require Docker will be **automatically skipped** if:
- Docker is not installed
- Docker daemon is not running
- Docker is not accessible

**No timeouts or failures** - tests simply skip gracefully with a clear message.

## Adding New Integration Tests

When creating tests that require external services:

1. Import the helper:
   ```typescript
   import { isDockerAvailable } from '../support/testcontainers'
   ```

2. Check Docker availability:
   ```typescript
   const DOCKER_AVAILABLE = isDockerAvailable()
   ```

3. Skip the test suite conditionally:
   ```typescript
   describe.skipIf(!DOCKER_AVAILABLE)('My Integration Tests', () => {
     // ...
   })
   ```

4. Use Testcontainers for service setup:
   ```typescript
   import { RedisContainer } from '@testcontainers/redis'

   let container: StartedRedisContainer

   beforeAll(async () => {
     container = await new RedisContainer('redis:7-alpine').start()
     // Use container.getConnectionUrl() for connection
   }, 120_000) // Allow time for container startup

   afterAll(async () => {
     if (container) {
       await container.stop()
     }
   }, 30_000)
   ```

## Why Testcontainers?

- ✅ **Automatic port management** - no conflicts
- ✅ **Automatic cleanup** - containers stopped even on test failure
- ✅ **Industry standard** - widely adopted solution
- ✅ **Real service testing** - not mocks, actual Redis/PostgreSQL/etc
- ✅ **CI/CD friendly** - works in GitHub Actions, GitLab CI, etc

## CI/CD Integration

Testcontainers works automatically in CI environments that support Docker:

- GitHub Actions: Use `docker` service
- GitLab CI: Use `docker:dind` service
- CircleCI: Use `docker` executor

Example GitHub Actions workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test # Testcontainers will use GitHub's Docker
```

No additional configuration needed!

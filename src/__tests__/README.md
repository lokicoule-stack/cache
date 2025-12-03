# Test Suite Documentation

This comprehensive test suite follows FAANG-level testing practices, covering unit tests,
integration tests, chaos engineering, and performance benchmarks.

## Test Structure

```
src/__tests__/
├── utils/
│   └── test-helpers.ts          # Test utilities and mocks
├── unit/
│   ├── bus.test.ts              # Bus unit tests
│   ├── bus-manager.test.ts      # BusManager unit tests
│   └── codec.test.ts            # Codec tests (JSON & MessagePack)
├── integration/
│   ├── integration.test.ts      # Integration tests with real scenarios
│   └── redis.test.ts            # Redis integration tests with Testcontainers
├── chaos/
│   └── chaos.test.ts            # Chaos engineering tests
└── performance/
    └── performance.test.ts      # Performance and load tests
```

## Test Categories

### 1. Unit Tests (`unit/`)

Comprehensive unit tests with edge cases covering:

#### Bus Tests

- Constructor variations (JSON, MessagePack, custom codecs)
- Connection lifecycle (connect, disconnect, reconnect)
- Publish operations (all data types, edge cases)
- Subscribe/unsubscribe operations
- Error handling (handler errors, transport failures)
- Edge cases (empty channels, special characters, large payloads)
- Concurrency (concurrent publishes, subscribes, unsubscribes)
- Channel management

**Key Features:**

- Tests all primitive types and complex nested objects
- Validates error propagation and recovery
- Tests rapid publish/subscribe cycles (100+ operations)
- Validates memory cleanup

#### BusManager Tests

- Multi-transport management
- Type-safe transport names
- Bus lifecycle (start, stop, restart)
- Proxy methods (publish, subscribe, unsubscribe)
- Isolation between buses
- Error scenarios and recovery

**Key Features:**

- Tests bus instance caching
- Validates transport isolation
- Tests partial failure scenarios
- Validates state management across buses

#### Codec Tests

- JSON encoding/decoding
- MessagePack encoding/decoding
- Round-trip data integrity
- Error handling (invalid data)
- Edge cases (empty, null, undefined)
- Performance comparison
- Compression ratio analysis

**Key Features:**

- Validates data integrity for all types
- Compares JSON vs MessagePack performance
- Tests unicode and special characters
- Validates error handling for malformed data

### 2. Integration Tests (`integration/`)

Real-world scenarios and patterns with MemoryTransport and Redis:

- **Full publish-subscribe cycles**
- **Multi-channel communication**
- **Request-response pattern**
- **Event sourcing pattern**
- **CQRS (Command Query Responsibility Segregation)**
- **Saga pattern** (distributed transactions)
- **Distributed tracing** (trace propagation)
- **Circuit breaker pattern**
- **Order processing workflow** (complete e-commerce flow)
- **Multi-bus orchestration**

**Key Features:**

- Tests complete business workflows
- Validates complex message routing
- Tests cross-bus communication
- Simulates real production scenarios

#### Redis Integration Tests (Testcontainers)

Complete integration tests with real Redis using Testcontainers:

- **Basic Operations**

  - Connection/disconnection
  - Multiple connect/disconnect cycles
  - Error handling for missing connections

- **Multi-Bus Communication**

  - Cross-bus publish/subscribe
  - Multiple subscribers on same channel
  - Independent channel isolation
  - Complex data types

- **Codec Support**

  - JSON codec with Redis
  - MessagePack codec with Redis
  - Binary data efficiency

- **Real-World Patterns**

  - Fan-out pattern (broadcast to multiple subscribers)
  - Event filtering pattern
  - Distributed task queue
  - Request-reply pattern

- **Error Handling**

  - Connection failures
  - Reconnection scenarios
  - Handler errors isolation

- **Performance**
  - High throughput tests (1000+ msg)
  - Latency measurements (avg, p95)
  - Burst handling

**Key Features:**

- Uses Testcontainers for real Redis instance
- No mocks - tests against actual Redis
- Automatic container lifecycle management
- Tests distributed scenarios
- Validates production-like behavior

### 3. Chaos Engineering Tests (`chaos/`)

Testing system resilience under failure conditions:

#### Network Failures

- Connection failures
- Publish failures
- Subscribe failures
- Transient failures and recovery

#### Intermittent Failures

- Flaky transport (30% failure rate)
- Sporadic message delivery failures
- Random operation failures

#### Latency and Timeouts

- Slow transport operations (100ms+ latency)
- Concurrent slow operations
- Timeout scenarios

#### Race Conditions

- Rapid subscribe/unsubscribe cycles
- Concurrent subscribes to same channel
- Publish during subscribe
- Unsubscribe during message processing
- Disconnect during message processing
- Rapid channel switching

#### Memory Pressure

- Large number of subscriptions (1000+)
- Large number of channels (1000+)
- Large payloads (1MB+)
- Rapid message bursts (1000+ messages)

#### Handler Errors Under Stress

- All handlers throwing errors
- Mix of successful and failing handlers
- Async handlers timing out
- Errors in rapid succession

#### Resource Exhaustion

- Memory growth from subscriptions
- Repeated connect/disconnect cycles
- Multiple bus instances
- Codec failures

#### Complex Chaos Scenarios

- Combined failures (flaky + slow + errors)
- Complete system chaos simulation

**Key Features:**

- Uses FlakyTransport (configurable failure rate)
- Uses SlowTransport (configurable latency)
- Tests recovery mechanisms
- Validates system stability under stress

### 4. Performance Tests (`performance/`)

Benchmarking and performance validation:

#### Throughput

- High message throughput (10,000+ msg/s)
- Concurrent publishes
- Multi-channel throughput

#### Latency

- Publish latency (avg, p50, p95, p99)
- End-to-end latency
- Target: <10ms avg, <20ms p95

#### Memory Usage

- Memory leak detection
- Large handler sets (10,000+ handlers)
- Cleanup validation

#### Codec Performance

- JSON vs MessagePack encoding speed
- Decoding performance comparison
- Payload size comparison
- Compression ratios

#### Scalability

- Linear scaling with message count
- Handler count scaling
- Channel count scaling

#### Stress Tests

- Sustained load (5 seconds continuous)
- Burst traffic (10 bursts × 1000 messages)
- Mixed operations under load

#### Optimization Opportunities

- Batching benefits demonstration
- Performance improvement suggestions

**Key Features:**

- Measures actual performance metrics
- Compares codec performance
- Tests at scale (10,000+ operations)
- Validates linear scaling

## Test Utilities (`utils/test-helpers.ts`)

### MockTransport

Fully controllable transport for testing:

- Configurable delays (connect, disconnect, publish, subscribe)
- Configurable failures (shouldFail flags)
- Message history tracking
- Subscriber tracking
- Reset functionality

### FlakyTransport

Simulates unreliable network:

- Configurable failure rate (default 30%)
- Random operation failures
- Tests resilience

### SlowTransport

Simulates high latency:

- Configurable latency (default 100ms)
- Tests timeout handling
- Tests performance under load

### Helper Functions

- `waitFor()`: Wait for condition with timeout
- `delay()`: Promise-based delay
- `createDeferred()`: Deferred promise pattern
- `setupTestEnvironment()`: Mock cleanup

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test bus.test
npm test chaos
npm test performance

# Run specific test category
npm test -- unit
npm test -- integration
npm test -- chaos
npm test -- performance
```

## Test Coverage Goals

- **Unit Tests**: 100% code coverage
- **Integration Tests**: All major patterns covered
- **Chaos Tests**: All failure modes tested
- **Performance Tests**: Baseline metrics established

## Performance Benchmarks

Expected performance characteristics:

- **Throughput**: >1,000 msg/s (synchronous), >10,000 msg/s (concurrent)
- **Latency**: <10ms average, <20ms p95
- **Memory**: No leaks, proper cleanup
- **Scalability**: Linear scaling up to 10,000 operations

## Writing New Tests

### Unit Test Template

```typescript
describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  })

  it('should handle normal case', async () => {
    // Arrange
    // Act
    // Assert
  })

  it('should handle edge case', async () => {
    // Test edge cases
  })

  it('should handle error case', async () => {
    // Test error handling
  })
})
```

### Chaos Test Template

```typescript
it('should survive [failure scenario]', async () => {
  // Configure failure conditions
  // Attempt operation
  // Verify graceful degradation or recovery
})
```

### Performance Test Template

```typescript
it('should meet performance target for [operation]', async () => {
  // Setup
  const start = performance.now()
  // Execute operation N times
  const elapsed = performance.now() - start
  // Assert performance metrics
  console.log(`Metric: ${value}`)
})
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always disconnect buses and clear state
3. **Timeouts**: Use `waitFor()` with appropriate timeouts
4. **Assertions**: Use specific assertions, avoid generic `toBeTruthy()`
5. **Edge Cases**: Test empty, null, undefined, large values
6. **Error Cases**: Test all failure paths
7. **Performance**: Log metrics for tracking trends
8. **Documentation**: Comment complex test scenarios

## Continuous Integration

These tests are designed for CI/CD pipelines:

- **Fast unit tests**: Run on every commit
- **Integration tests**: Run on pull requests
- **Chaos tests**: Run nightly or weekly
- **Performance tests**: Run on release branches with baseline comparison

## Debugging Tests

```bash
# Run single test with verbose output
npm test -- -t "should handle specific case" --reporter=verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest run

# Run tests with full error stack
npm test -- --no-coverage
```

## Contributing

When adding new features:

1. Add unit tests covering all code paths
2. Add integration tests for user-facing functionality
3. Consider chaos tests for reliability-critical features
4. Add performance tests if feature impacts throughput/latency
5. Update this README if adding new test categories

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Performance Testing Guide](https://web.dev/rail/)

# @lokiverse/bus Benchmarks

Performance benchmark suite for [@lokiverse/bus](../README.md), measuring codec efficiency,
transport overhead, and real-world throughput.

## Methodology

- **Hardware**: MacBook Pro 16,1 (Intel x86_64), 16GB RAM
- **OS**: macOS 14+ (Darwin 25.1.0)
- **Runtime**: Node.js v23.3.0
- **Tooling**: tinybench (statistically sound benchmarking)
- **Redis**: Docker container (redis:7-alpine)
- **Timing**: 1500ms duration, 200ms warmup, 50 iterations per test
- **Payloads**: 10 standardized sizes (12B to 500KB)

## Quick Start

```bash
cd benchmarks
pnpm install

# Run all benchmarks
pnpm bench:all

# Run specific suite
pnpm bench:codecs    # Codec encoding/decoding
pnpm bench:redis     # Redis transport vs raw Redis
pnpm bench:bus       # End-to-end bus performance
```

Requires Docker for Redis-based benchmarks.

## Results

### Codec Performance

Compares JSON vs MessagePack encoding/decoding speed and size efficiency.

| Payload Size  | JSON Encode | MsgPack Encode | JSON Decode | MsgPack Decode | Size Reduction |
| ------------- | ----------- | -------------- | ----------- | -------------- | -------------- |
| Nano (12B)    | TBD ops/s   | TBD ops/s      | TBD ops/s   | TBD ops/s      | 31.8%          |
| Small (60B)   | TBD ops/s   | TBD ops/s      | TBD ops/s   | TBD ops/s      | 26%            |
| Medium (150B) | TBD ops/s   | TBD ops/s      | TBD ops/s   | TBD ops/s      | 18.6%          |
| Large (15KB)  | TBD ops/s   | TBD ops/s      | TBD ops/s   | TBD ops/s      | 34.2%          |

**Key findings**:

- MessagePack achieves 17-34% bandwidth savings
- JSON decoding slightly faster for <100B payloads
- MessagePack wins on network-bound workloads

### Bus End-to-End Performance

Measures full publish/subscribe cycle including serialization, transport, and deserialization.

| Payload Size  | JSON ops/s | MessagePack ops/s | Wrapper Overhead |
| ------------- | ---------- | ----------------- | ---------------- |
| Small (30B)   | 1,455      | 1,382             | 5.5%             |
| Medium (350B) | 1,432      | 1,368             | 6.8%             |
| Large (15KB)  | 1,110      | 879               | 14.7%            |

**Wrapper overhead**: Minimal 5-15% cost for type safety, retry logic, and middleware stack.

### Redis Transport vs Raw Redis

Compares @lokiverse/bus Redis transport against raw `ioredis` pub/sub.

| Operation         | Raw Redis | @lokiverse/bus | Overhead |
| ----------------- | --------- | -------------- | -------- |
| Publish (small)   | TBD ops/s | TBD ops/s      | TBD%     |
| Subscribe (small) | TBD ops/s | TBD ops/s      | TBD%     |
| Publish (large)   | TBD ops/s | TBD ops/s      | TBD%     |

**Overhead analysis**: Abstraction cost vs productivity gains (retries, type safety, middleware).

## Payload Sizes

Benchmarks use 10 standardized payloads representing real-world use cases:

| Size     | Bytes  | Description                       | Use Case                |
| -------- | ------ | --------------------------------- | ----------------------- |
| Nano     | ~12B   | Simple ACK                        | Health checks, pings    |
| Tiny     | ~30B   | Ping with timestamp               | Heartbeats              |
| Small    | ~60B   | Basic event                       | Click tracking          |
| Medium   | ~150B  | User action + metadata            | Analytics events        |
| Large    | ~350B  | Order with 10 items               | E-commerce transactions |
| XLarge   | ~1.5KB | Order with 50 items               | Bulk orders             |
| XXLarge  | ~15KB  | Analytics session (100 events)    | Session replays         |
| Huge     | ~75KB  | Analytics session (500 events)    | Heavy analytics         |
| Massive  | ~200KB | Dataset (500 records, 20 values)  | Data exports            |
| Enormous | ~500KB | Dataset (1000 records, 50 values) | Large batch processing  |

## Reproduction

### Prerequisites

```bash
# Install dependencies
cd benchmarks
pnpm install

# Start Redis (Docker required)
docker run -d -p 6379:6379 redis:7-alpine
```

### Run Benchmarks

```bash
# All benchmarks
pnpm bench:all

# Individual suites
pnpm bench:codecs       # Codec encoding/decoding
pnpm bench:transport    # Memory transport performance
pnpm bench:redis        # Redis transport comparison
pnpm bench:bus          # End-to-end bus performance
pnpm bench:bandwidth    # Network bandwidth analysis
```

### Configuration

Edit [support/config.ts](support/config.ts) to adjust:

```typescript
export const benchmarkConfig = {
  redis: {
    image: 'redis:7-alpine', // Redis Docker image
  },
  timing: {
    warmup: 200, // Warmup duration (ms)
    duration: 1500, // Benchmark duration (ms)
    iterations: 50, // Iterations per test
  },
  thresholds: {
    smallPayloadBoundary: 100, // Payload size thresholds
    mediumPayloadBoundary: 500,
    largePayloadBoundary: 5000,
  },
}
```

## Interpreting Results

### When to use MessagePack

- Network-constrained environments
- Bandwidth costs matter
- Payloads >100B
- Production deployments

### When to use JSON

- Development/debugging (human-readable)
- Payloads <50B (negligible difference)
- Interop with non-binary systems

### Compression guidelines

- Enable gzip for payloads >5KB
- Trades CPU for 60-80% bandwidth reduction
- Test with your actual workload

## Benchmark Architecture

Fully isolated package with independent dependencies:

```text
benchmarks/
├── package.json              # Own dependencies (tinybench, testcontainers)
├── tsconfig.json             # Independent TypeScript config
├── suites/                   # Benchmark test suites
│   ├── codecs.bench.ts      # Codec encoding/decoding
│   ├── bus.bench.ts         # Bus-level pub/sub
│   ├── redis.bench.ts       # Redis transport comparison
│   ├── transport.bench.ts   # Memory transport
│   └── bandwidth.bench.ts   # Network bandwidth
└── support/                  # Shared utilities
    ├── config.ts            # Centralized configuration
    ├── fixtures/
    │   └── payloads.ts     # Standardized test payloads
    └── helpers/
        ├── reporting.ts    # Result formatting
        └── setup.ts        # Redis/container setup
```

**Path aliases**:

- `@/` → Main project source code
- `@bench/` → Benchmark support utilities

No pollution of main project. Zero shared dependencies.

## Caveats

- Results use synthetic payloads; real-world patterns may differ
- Network latency not measured (local Redis)
- CPU-bound benchmarks; disk I/O and GC pauses excluded
- Single-threaded; multi-core scaling not evaluated
- Results may vary on different hardware architectures

## Contributing

Useful additions:

- Benchmarks on different hardware (ARM, AMD)
- Production workload profiles
- Comparison with alternative libraries (BullMQ, EventEmitter2)
- Memory profiling and GC pressure analysis

## License

MIT

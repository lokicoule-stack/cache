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

Testcontainers handles Redis automatically.

## Results

### Redis Transport: Bus vs Raw Redis

Compares @lokiverse/bus wrapper overhead against raw Redis pub/sub.

| Payload  | Raw Redis | Bus + JSON | Bus + MessagePack | JSON Overhead | MsgPack Overhead | Size Reduction |
| -------- | --------- | ---------- | ----------------- | ------------- | ---------------- | -------------- |
| 70B      | 1,424     | 1,485      | 1,395             | -4.3%         | 2.0%             | 17.1%          |
| 486B     | 1,452     | 1,467      | 1,382             | -1.0%         | 4.8%             | 17.3%          |
| 15KB     | 1,311     | 1,056      | 783               | 19.5%         | 40.3%            | 25.8%          |

**Key findings**:

- **JSON overhead**: Negative on small payloads (faster than raw Redis!), 19.5% on large (15KB)
- **MessagePack overhead**: 2-40% slower but saves 17-26% bandwidth
- Average wrapper overhead: JSON ~4.7%, MessagePack ~15.7%

### Codec Performance

Raw encoding/decoding performance (no transport).

| Payload       | Bytes | JSON Encode   | MsgPack Encode | JSON Decode   | MsgPack Decode | Size Reduction |
| ------------- | ----- | ------------- | -------------- | ------------- | -------------- | -------------- |
| Nano (ack)    | 11    | 1,348,769/s   | 954,751/s      | 2,536,593/s   | 1,973,365/s    | 54.5%          |
| Tiny (ping)   | 43    | 1,131,656/s   | 769,470/s      | 1,688,863/s   | 1,509,424/s    | 25.6%          |
| Small (event) | 70    | 1,165,827/s   | 675,429/s      | 1,580,841/s   | 1,038,267/s    | 17.1%          |
| Medium        | 173   | 917,987/s     | 357,654/s      | 934,630/s     | 603,194/s      | 15.6%          |
| Large         | 486   | 339,760/s     | 189,173/s      | 296,411/s     | 237,537/s      | 17.3%          |
| XLarge        | 2160  | 94,476/s      | 53,949/s       | 66,212/s      | 61,087/s       | 22.0%          |
| XXLarge       | 15KB  | 20,022/s      | 10,206/s       | 13,649/s      | 12,016/s       | 25.8%          |
| Huge          | 75KB  | 3,366/s       | 1,735/s        | 2,769/s       | 2,317/s        | 25.7%          |
| Massive       | 238KB | 641/s         | 980/s          | 729/s         | 1,799/s        | 43.0%          |
| Enormous      | 1MB   | 149/s         | 310/s          | 172/s         | 673/s          | 47.0%          |

**Key findings**:

- JSON faster for encoding/decoding on payloads <100B
- MessagePack wins on very large payloads (>200KB): 2-4x faster decode
- Size reduction: 15-26% for typical workloads, 43-47% for very large payloads

### Bus-Level Performance (In-Memory)

End-to-end pub/sub with serialization (no network).

| Payload       | JSON ops/s | MessagePack ops/s |
| ------------- | ---------- | ----------------- |
| Nano (11B)    | 582,936    | 428,665           |
| Tiny (43B)    | 462,446    | 401,595           |
| Small (70B)   | 439,275    | 323,970           |
| Medium (173B) | 374,887    | 187,762           |
| Large (486B)  | 138,097    | 103,484           |
| XLarge (2KB)  | 37,526     | 28,437            |
| XXLarge (15KB)| 7,639      | 5,747             |

**Wrapper overhead**: Type safety + middleware cost is visible but acceptable for production use.

## Payload Sizes

Benchmarks use 10 standardized payloads representing real-world use cases:

| Size     | Bytes  | Description                       | Use Case                |
| -------- | ------ | --------------------------------- | ----------------------- |
| Nano     | 11B    | Simple ACK                        | Health checks, pings    |
| Tiny     | 43B    | Ping with timestamp               | Heartbeats              |
| Small    | 70B    | Basic event                       | Click tracking          |
| Medium   | 173B   | User action + metadata            | Analytics events        |
| Large    | 486B   | Order with 10 items               | E-commerce transactions |
| XLarge   | 2.1KB  | Order with 50 items               | Bulk orders             |
| XXLarge  | 15KB   | Analytics session (100 events)    | Session replays         |
| Huge     | 75KB   | Analytics session (500 events)    | Heavy analytics         |
| Massive  | 238KB  | Dataset (500 records, 20 values)  | Data exports            |
| Enormous | 1MB    | Dataset (1000 records, 50 values) | Large batch processing  |

## Reproduction

### Prerequisites

```bash
cd benchmarks
pnpm install
```

Testcontainers will automatically start/stop Redis containers as needed.

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

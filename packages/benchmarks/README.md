# @lokiverse/benchmarks

FAANG-level benchmark suite comparing **@lokiverse/cache** against **Redis (direct)** and **BentoCache**.

## Features

- **Statistical Rigor**: 95% confidence intervals, percentile latencies (p50, p95, p99, p99.9)
- **Outlier Detection**: IQR-based outlier removal for clean statistics
- **Warmup Periods**: Proper JIT warmup before measurement
- **Fair Comparison**: Same Redis instance, same serialization, same configuration
- **Multiple Categories**: Micro, throughput, real-world scenarios, memory efficiency

## Installation

```bash
# From workspace root
pnpm install
```

## Usage

### Run All Benchmarks

```bash
pnpm --filter @lokiverse/benchmarks bench
```

### Run Specific Categories

```bash
# Micro-benchmarks only
pnpm --filter @lokiverse/benchmarks bench:micro

# Throughput tests
pnpm --filter @lokiverse/benchmarks bench:throughput

# Real-world scenarios (stampede, SWR, hit ratios)
pnpm --filter @lokiverse/benchmarks bench:scenarios

# Memory efficiency
pnpm --filter @lokiverse/benchmarks bench:memory
```

## Benchmark Categories

### Micro-benchmarks

- **Single Get**: L1 hit, L2 hit, cache miss latencies
- **Single Set**: Write latencies for different payload sizes
- **Batch Operations**: getMany, setMany performance
- **Delete Operations**: Single and bulk delete latency

### Throughput

- **Saturation**: Maximum ops/sec under load
- **Concurrent Scaling**: Performance with 1, 10, 50, 100 concurrent clients
- **Payload Impact**: How payload size affects throughput

### Scenarios

- **Stampede Protection**: 50+ concurrent requests for same key (showcases deduplication)
- **Stale-While-Revalidate**: Serving stale data while refreshing in background
- **Hit Ratio Impact**: Performance at 0%, 50%, 90%, 99% hit rates
- **Mixed Workloads**: Read-heavy, balanced, write-heavy patterns
- **Cold vs Warm**: Cache startup vs steady-state performance

### Memory

- **Overhead per Entry**: Bytes consumed per cached item
- **GC Pressure**: Garbage collection impact
- **Scaling**: Memory usage at different cache sizes

## Output

Benchmarks generate results in multiple formats:

- **Console**: Colored terminal output with comparison summaries
- **JSON**: `results/latest/results.json` for automated analysis
- **Markdown**: `results/latest/results.md` for README inclusion
- **CSV**: `results/latest/results.csv` for graphing tools

## Example Output

```
================================================================================
  BENCHMARK RESULTS
================================================================================

  Environment: Node v22.0.0 on darwin
  Total benchmarks: 45
  Duration: 127.3s

────────────────────────────────────────────────────────────────────────────────
  MICRO
────────────────────────────────────────────────────────────────────────────────

  L1 Hit (small payload):
  ------------------------------------------------------------------------------
  Adapter                      Ops/sec    p50 (µs)   p99 (µs)       95% CI
  ------------------------------------------------------------------------------
  @lokiverse/cache           2,847,391         0.3        1.2        ±0.02
  Redis (direct)                45,123        21.8       45.3        ±1.24
  BentoCache                 2,512,847         0.4        1.5        ±0.03

================================================================================
  COMPARISON SUMMARY (vs Redis baseline)
================================================================================

  L1 Hit (small payload):
    @lokiverse/cache: +63.1x faster
    BentoCache: +55.7x faster
```

## Architecture

```
packages/benchmarks/
├── src/
│   ├── adapters/           # Wrapper adapters for fair comparison
│   ├── config/             # Benchmark configuration
│   ├── fixtures/           # Test payloads and keys
│   ├── harness/            # Runner and statistical analysis
│   ├── infra/              # Redis testcontainer
│   ├── reporters/          # Console, JSON, MD, CSV output
│   └── suites/             # Benchmark test suites
│       ├── micro/
│       ├── throughput/
│       ├── scenarios/
│       └── memory/
└── bin/                    # Entry point scripts
```

## Configuration

Edit `src/config/benchmark.config.ts` to adjust:

- Warmup/measurement durations
- Minimum iterations
- Confidence level (default: 95%)
- Outlier threshold (default: 1.5 IQR)
- Payload sizes
- Concurrency levels

## Fair Comparison Guarantees

| Parameter      | @lokiverse/cache | Redis (direct) | BentoCache |
|----------------|------------------|----------------|------------|
| Redis Instance | Same testcontainer | Same | Same |
| Serialization  | JSON | JSON | JSON |
| Connection     | Single client | Single client | Single client (ioredis) |
| L1 Size        | 10,000 items | N/A | 10MB |

## What Each Library Shows

- **@lokiverse/cache**: Multi-tier L1+L2, stampede protection, SWR, deduplication
- **Redis (direct)**: Baseline raw performance, no abstractions
- **BentoCache**: Competing multi-tier solution

## License

MIT

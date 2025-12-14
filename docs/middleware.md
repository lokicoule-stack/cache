# Middleware

Middleware wraps the transport layer to add cross-cutting concerns without modifying business logic.

## Middleware Stack

```mermaid
flowchart LR
    subgraph Publish Flow
        P[publish] --> T[Tracing]
        T --> R[Retry]
        R --> I[Integrity]
        I --> C[Compression]
        C --> TR[Transport]
    end
```

```mermaid
flowchart RL
    subgraph Subscribe Flow
        TR2[Transport] --> C2[Decompression]
        C2 --> I2[Verify Integrity]
        I2 --> H[Handler]
    end
```

Middleware is applied in this order for publish operations:

1. **Tracing** - Creates spans and injects trace context
2. **Retry** - Wraps transport calls with retry logic
3. **Integrity** - Signs payload with HMAC
4. **Compression** - Compresses payload if above threshold

For subscribe operations, the reverse happens: decompress, verify signature, then deliver to
handler.

## Retry

Automatically retry failed publish operations with configurable backoff strategies.

### Basic Configuration

```typescript
middleware: {
  retry: {
    maxAttempts: 5,
    delay: 1000,           // Base delay in ms
    backoff: 'exponential' // 'exponential' | 'linear' | 'fibonacci'
  }
}
```

### Shortcuts

```typescript
retry: true // 3 attempts, exponential backoff, 1000ms base delay
retry: 5 // 5 attempts, exponential backoff
retry: false // Disabled (default)
```

### Backoff Strategies

```mermaid
graph TD
    subgraph Exponential
        E1[Attempt 1: 1s]
        E2[Attempt 2: 2s]
        E3[Attempt 3: 4s]
        E4[Attempt 4: 8s]
        E1 --> E2 --> E3 --> E4
    end

    subgraph Linear
        L1[Attempt 1: 1s]
        L2[Attempt 2: 2s]
        L3[Attempt 3: 3s]
        L4[Attempt 4: 4s]
        L1 --> L2 --> L3 --> L4
    end

    subgraph Fibonacci
        F1[Attempt 1: 1s]
        F2[Attempt 2: 1s]
        F3[Attempt 3: 2s]
        F4[Attempt 4: 3s]
        F1 --> F2 --> F3 --> F4
    end
```

| Strategy    | Formula                | Use Case                        |
| ----------- | ---------------------- | ------------------------------- |
| Exponential | `delay * 2^attempt`    | Network failures, rate limiting |
| Linear      | `delay * attempt`      | Predictable load patterns       |
| Fibonacci   | `delay * fib(attempt)` | Balanced growth                 |

### Dead Letter Handling

When all retry attempts are exhausted, the message becomes a "dead letter":

```typescript
middleware: {
  retry: {
    maxAttempts: 3,
    onRetry: (channel, data, attempt) => {
      logger.warn('Retrying message', { channel, attempt })
    },
    onDeadLetter: (channel, data, error, attempts) => {
      logger.error('Message failed permanently', { channel, attempts })
      deadLetterQueue.push({ channel, data, error })
    }
  }
}
```

```mermaid
sequenceDiagram
    participant App
    participant Retry
    participant Transport

    App->>Retry: publish(data)
    Retry->>Transport: attempt 1
    Transport-->>Retry: error
    Note over Retry: onRetry(attempt=1)
    Retry->>Transport: attempt 2
    Transport-->>Retry: error
    Note over Retry: onRetry(attempt=2)
    Retry->>Transport: attempt 3
    Transport-->>Retry: error
    Note over Retry: onDeadLetter()
    Retry-->>App: DeadLetterError
```

### Custom Backoff

Compose backoff strategies with utilities:

```typescript
import {
  exponentialBackoff,
  withJitter,
  withMaxDelay
} from '@lokiverse/bus'

// Exponential with 20% jitter and max 30s delay
const customBackoff = withMaxDelay(
  withJitter(exponentialBackoff, 0.2),
  30000
)

middleware: {
  retry: {
    maxAttempts: 10,
    backoff: customBackoff
  }
}
```

Jitter adds randomness to prevent thundering herd:

```mermaid
graph LR
    subgraph Without Jitter
        A1[Client 1: 1s] --> A2[Client 1: 2s]
        B1[Client 2: 1s] --> B2[Client 2: 2s]
        C1[Client 3: 1s] --> C2[Client 3: 2s]
    end

    subgraph With Jitter 20%
        D1[Client 1: 0.9s] --> D2[Client 1: 1.8s]
        E1[Client 2: 1.1s] --> E2[Client 2: 2.2s]
        F1[Client 3: 0.95s] --> F2[Client 3: 2.1s]
    end
```

## Compression

Compress payloads above a threshold using gzip.

### Configuration

```typescript
middleware: {
  compression: {
    type: 'gzip',
    threshold: 5120  // Compress payloads > 5KB (default)
  }
}
```

### Compression Shortcuts

```typescript
compression: true // gzip, 5KB threshold
compression: false // Disabled (default)
```

### Compression Logic

```mermaid
flowchart TD
    A[Payload] --> B{Size > threshold?}
    B -->|No| C[Send uncompressed]
    B -->|Yes| D[Compress with gzip]
    D --> E{Compressed < 90% original?}
    E -->|Yes| F[Send compressed + marker]
    E -->|No| C
```

The middleware only compresses when beneficial:

- Payload must exceed threshold
- Compressed size must be at least 10% smaller than original
- A marker byte (0x00 = uncompressed, 0x01 = gzip) is prepended

### Size Reduction Examples

| Payload Type          | Original | Compressed | Reduction    |
| --------------------- | -------- | ---------- | ------------ |
| JSON (repetitive)     | 15KB     | 3KB        | 80%          |
| JSON (unique strings) | 15KB     | 12KB       | 20%          |
| Binary data           | 15KB     | 14KB       | 7% (skipped) |

## Integrity

HMAC message authentication to detect tampering. Uses timing-safe comparison to prevent timing
attacks.

### Integrity Configuration

```typescript
middleware: {
  integrity: {
    type: 'hmac',
    key: process.env.HMAC_SECRET,
    algorithm: 'sha256'  // Default. Also: 'sha384', 'sha512'
  }
}
```

### Integrity Flow

```mermaid
sequenceDiagram
    participant Publisher
    participant Integrity
    participant Transport
    participant Subscriber

    Publisher->>Integrity: payload
    Note over Integrity: signature = HMAC(key, payload)
    Integrity->>Transport: signature + payload
    Transport->>Integrity: signature + payload
    Note over Integrity: expected = HMAC(key, payload)
    Note over Integrity: timingSafeEqual(signature, expected)
    alt Valid
        Integrity->>Subscriber: payload
    else Invalid
        Integrity--xSubscriber: IntegrityError
    end
```

### Message Format

```text
┌──────────────────┬─────────────────┐
│ HMAC Signature   │ Original Payload│
│ (32/48/64 bytes) │ (variable)      │
└──────────────────┴─────────────────┘
```

| Algorithm | Signature Size |
| --------- | -------------- |
| sha256    | 32 bytes       |
| sha384    | 48 bytes       |
| sha512    | 64 bytes       |

### Security Considerations

- **Timing-safe comparison**: Uses `crypto.timingSafeEqual()` to prevent timing attacks
- **Key management**: Store keys in environment variables or secret managers
- **Key rotation**: Change keys requires coordinated deployment (both publisher and subscriber)

```typescript
// Tampering detection
await manager.subscribe('secure-channel', (data) => {
  // This handler only runs if HMAC verification passes
  // IntegrityError thrown for tampered messages
})
```

## Tracing

OpenTelemetry distributed tracing with W3C TraceContext propagation.

### Tracing Configuration

```typescript
import { trace } from '@opentelemetry/api'

middleware: {
  tracing: {
    tracer: trace.getTracer('my-service'),
    recordPayloadSize: true  // Optional: record message size in span
  }
}
```

### Span Creation

```mermaid
sequenceDiagram
    participant Service A
    participant Bus
    participant Redis
    participant Service B

    Note over Service A: Span: "orders publish"
    Service A->>Bus: publish('orders', data)
    Note over Bus: Inject traceparent header
    Bus->>Redis: message + trace context
    Redis->>Bus: message + trace context
    Note over Bus: Extract traceparent header
    Note over Service B: Span: "orders process"<br/>Parent: Service A span
    Bus->>Service B: handler(data)
```

The middleware creates two types of spans:

| Span Name           | Kind     | Description                       |
| ------------------- | -------- | --------------------------------- |
| `{channel} publish` | PRODUCER | Created when publishing a message |
| `{channel} process` | CONSUMER | Created when processing a message |

### Span Attributes

Following
[OpenTelemetry Semantic Conventions for Messaging](https://opentelemetry.io/docs/specs/semconv/messaging/):

| Attribute                     | Value                                       |
| ----------------------------- | ------------------------------------------- |
| `messaging.system`            | `redis` or `memory`                         |
| `messaging.destination.name`  | Channel name                                |
| `messaging.operation.type`    | `publish` or `process`                      |
| `messaging.message.body.size` | Payload size (if `recordPayloadSize: true`) |

### Trace Propagation

```mermaid
flowchart LR
    subgraph Service A
        A1[HTTP Request] --> A2[Span: handle-request]
        A2 --> A3[Span: orders publish]
    end

    subgraph Message
        M[traceparent: 00-abc123-def456-01]
    end

    subgraph Service B
        B1[Span: orders process] --> B2[Span: save-order]
    end

    A3 --> M --> B1
```

The trace context is embedded in the message using magic bytes (`0x54 0x52` = "TR") followed by a
JSON envelope containing W3C TraceContext headers.

## Full Example

Production-ready configuration with all middleware:

```typescript
import { BusManager, redis, withJitter, exponentialBackoff } from '@lokiverse/bus'
import { trace } from '@opentelemetry/api'

const manager = new BusManager({
  default: 'critical',
  transports: {
    critical: {
      transport: redis({
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 5000) },
      }),
      codec: 'msgpack',
      middleware: {
        // Outermost: tracing captures full request lifecycle
        tracing: {
          tracer: trace.getTracer('order-service'),
          recordPayloadSize: true,
        },
        // Retry wraps everything below
        retry: {
          maxAttempts: 5,
          backoff: withJitter(exponentialBackoff, 0.2),
          onDeadLetter: (channel, data, error) => {
            deadLetterQueue.enqueue({ channel, data, error, timestamp: Date.now() })
          },
        },
        // Integrity before compression (sign uncompressed data)
        integrity: {
          type: 'hmac',
          key: process.env.HMAC_KEY,
          algorithm: 'sha256',
        },
        // Innermost: compression
        compression: {
          type: 'gzip',
          threshold: 1024,
        },
      },
    },
    // Simple transport for non-critical internal events
    internal: {
      transport: redis({ url: process.env.REDIS_URL }),
      codec: 'json', // Human-readable for debugging
    },
  },
})
```

## Middleware Execution Order

Understanding the order is important for debugging:

```mermaid
flowchart TB
    subgraph Publish
        direction TB
        P1[1. Tracing starts span]
        P2[2. Retry wraps call]
        P3[3. Integrity signs payload]
        P4[4. Compression compresses]
        P5[5. Transport sends]
        P1 --> P2 --> P3 --> P4 --> P5
    end

    subgraph Subscribe
        direction TB
        S1[1. Transport receives]
        S2[2. Compression decompresses]
        S3[3. Integrity verifies]
        S4[4. Tracing extracts context]
        S5[5. Handler executes]
        S1 --> S2 --> S3 --> S4 --> S5
    end
```

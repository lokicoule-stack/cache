# Architecture

This document describes the internal architecture of @lokiverse/bus.

## High-Level Overview

```mermaid
flowchart TB
    subgraph Application
        App[Your Code]
    end

    subgraph "@lokiverse/bus"
        BM[BusManager]
        MB[MessageBus]

        subgraph Core
            SM[SubscriptionManager]
            MD[MessageDispatcher]
        end

        subgraph Middleware Stack
            TR[TracingMiddleware]
            RT[RetryMiddleware]
            IM[IntegrityMiddleware]
            CM[CompressionMiddleware]
        end

        subgraph Infrastructure
            CO[Codec]
            TP[Transport]
        end
    end

    subgraph External
        Redis[(Redis)]
        OT[OpenTelemetry]
    end

    App --> BM
    BM --> MB
    MB --> SM
    MB --> MD
    MB --> TR
    TR --> RT
    RT --> IM
    IM --> CM
    CM --> CO
    CO --> TP
    TP --> Redis
    TR -.-> OT
```

## Component Diagram

```mermaid
classDiagram
    class BusManager~T~ {
        -buses: Map~string, Bus~
        -config: BusManagerConfig~T~
        +use(name): Bus
        +start(name?): Promise
        +stop(name?): Promise
        +publish(channel, data): Promise
        +subscribe(channel, handler): Promise
        +unsubscribe(channel, handler?): Promise
    }

    class MessageBus {
        -transport: Transport
        -codec: Codec
        -subscriptionManager: SubscriptionManager
        -dispatcher: MessageDispatcher
        -telemetry: BusTelemetry
        +connect(): Promise
        +disconnect(): Promise
        +publish(channel, data): Promise
        +subscribe(channel, handler): Promise
        +unsubscribe(channel, handler?): Promise
    }

    class SubscriptionManager {
        -subscriptions: Map~string, ChannelSubscription~
        +add(channel, handler): void
        +remove(channel, handler?): boolean
        +getHandlers(channel): MessageHandler[]
        +getAllChannels(): string[]
        +hasHandlers(channel): boolean
    }

    class MessageDispatcher {
        -codec: Codec
        -telemetry: BusTelemetry
        +dispatch(channel, data, handlers): Promise
    }

    class Transport {
        <<interface>>
        +name: string
        +connect(): Promise
        +disconnect(): Promise
        +publish(channel, data): Promise
        +subscribe(channel, handler): Promise
        +unsubscribe(channel): Promise
        +onReconnect(callback): void
    }

    class Codec {
        <<interface>>
        +encode(data): Uint8Array
        +decode(bytes): unknown
    }

    BusManager --> MessageBus : manages
    MessageBus --> SubscriptionManager : uses
    MessageBus --> MessageDispatcher : uses
    MessageBus --> Transport : wraps
    MessageBus --> Codec : uses
    MessageDispatcher --> Codec : uses
```

## Message Flow

### Publish Flow

```mermaid
sequenceDiagram
    participant App
    participant MessageBus
    participant Codec
    participant Middleware
    participant Transport
    participant Redis

    App->>MessageBus: publish(channel, data)

    alt Not connected & autoConnect
        MessageBus->>Transport: connect()
        Transport->>Redis: Connect
    end

    MessageBus->>Codec: encode(data)
    Codec-->>MessageBus: Uint8Array

    loop Each Middleware (outer to inner)
        MessageBus->>Middleware: publish(channel, encoded)
        Note over Middleware: Transform payload
    end

    Middleware->>Transport: publish(channel, finalPayload)
    Transport->>Redis: PUBLISH channel payload

    MessageBus->>MessageBus: telemetry.onPublish()
    MessageBus-->>App: Promise resolved
```

### Subscribe Flow

```mermaid
sequenceDiagram
    participant App
    participant MessageBus
    participant SubscriptionManager
    participant Transport
    participant Redis

    App->>MessageBus: subscribe(channel, handler)

    MessageBus->>SubscriptionManager: add(channel, handler)

    alt First handler for channel
        MessageBus->>Transport: subscribe(channel, internalHandler)
        Transport->>Redis: SUBSCRIBE channel
    end

    MessageBus->>MessageBus: telemetry.onSubscribe()
    MessageBus-->>App: Promise resolved

    Note over Redis: Later, message arrives...

    Redis->>Transport: Message on channel
    Transport->>MessageBus: internalHandler(data)
    MessageBus->>MessageBus: dispatch to all handlers
```

### Message Dispatch Flow

```mermaid
sequenceDiagram
    participant Transport
    participant Middleware
    participant Codec
    participant Dispatcher
    participant Handlers
    participant Telemetry

    Transport->>Middleware: rawData

    loop Each Middleware (inner to outer)
        Note over Middleware: Reverse transform
        Middleware->>Middleware: decompress/verify
    end

    Middleware->>Codec: decode(data)
    Codec-->>Dispatcher: decoded object

    Dispatcher->>Dispatcher: Get handlers for channel

    par For each handler
        Dispatcher->>Handlers: handler(data)
        Note over Dispatcher: Measure duration
        alt Success
            Handlers-->>Dispatcher: return
            Dispatcher->>Telemetry: onHandlerExecution(success)
        else Error
            Handlers--xDispatcher: throw
            Dispatcher->>Telemetry: onHandlerExecution(failure)
            Dispatcher->>Telemetry: onError
        end
    end
```

## Middleware Architecture

Middleware wraps the transport using the decorator pattern:

```mermaid
flowchart LR
    subgraph Middleware Chain
        direction LR
        TR[Tracing] --> RT[Retry]
        RT --> IM[Integrity]
        IM --> CM[Compression]
        CM --> TP[Transport]
    end

    P[publish] --> TR
    TP --> R[Redis]
```

### Middleware Interface

```mermaid
classDiagram
    class TransportMiddleware {
        <<abstract>>
        #transport: Transport
        +name: string
        +connect(): Promise
        +disconnect(): Promise
        +publish(channel, data): Promise
        +subscribe(channel, handler): Promise
        +unsubscribe(channel): Promise
        +onReconnect(callback): void
    }

    class TracingMiddleware {
        -tracer: Tracer
        +publish(): wraps with span
        +subscribe(): extracts context
    }

    class RetryMiddleware {
        -config: RetryConfig
        +publish(): retries on failure
    }

    class IntegrityMiddleware {
        -key: string
        -algorithm: string
        +publish(): signs payload
        +subscribe(): verifies signature
    }

    class CompressionMiddleware {
        -threshold: number
        +publish(): compresses if needed
        +subscribe(): decompresses
    }

    TransportMiddleware <|-- TracingMiddleware
    TransportMiddleware <|-- RetryMiddleware
    TransportMiddleware <|-- IntegrityMiddleware
    TransportMiddleware <|-- CompressionMiddleware
```

### Middleware Composition

```mermaid
flowchart TD
    subgraph Configuration
        C[MiddlewareConfig]
    end

    subgraph Factory
        F[composeMiddleware]
    end

    subgraph Result
        direction TB
        T1[TracingMiddleware]
        T2[RetryMiddleware]
        T3[IntegrityMiddleware]
        T4[CompressionMiddleware]
        T5[BaseTransport]

        T1 --> T2 --> T3 --> T4 --> T5
    end

    C --> F
    F --> Result
```

The middleware stack is built from configuration:

```typescript
// Input
middleware: {
  tracing: { tracer },
  retry: { maxAttempts: 3 },
  integrity: { type: 'hmac', key: 'secret' },
  compression: { type: 'gzip', threshold: 1024 }
}

// Creates chain:
// TracingMiddleware(
//   RetryMiddleware(
//     IntegrityMiddleware(
//       CompressionMiddleware(
//         RedisTransport
//       )
//     )
//   )
// )
```

## BusManager Architecture

```mermaid
flowchart TB
    subgraph BusManager
        Config[BusManagerConfig]
        Cache[Bus Cache]
        Default[Default Bus Name]

        subgraph Buses
            B1[Bus: critical]
            B2[Bus: internal]
            B3[Bus: analytics]
        end
    end

    subgraph Operations
        Start[start]
        Stop[stop]
        Use[use]
        Pub[publish]
        Sub[subscribe]
    end

    Config --> Buses
    Start --> Buses
    Stop --> Buses
    Use --> Cache
    Cache --> Buses
    Pub --> Default
    Sub --> Default
    Default --> B1
```

### Lazy Initialization

```mermaid
sequenceDiagram
    participant App
    participant BusManager
    participant Cache
    participant Factory

    App->>BusManager: use('analytics')

    BusManager->>Cache: get('analytics')

    alt Cache miss
        Cache-->>BusManager: undefined
        BusManager->>Factory: createBus(config.analytics)
        Factory-->>BusManager: new MessageBus
        BusManager->>Cache: set('analytics', bus)
    else Cache hit
        Cache-->>BusManager: existing bus
    end

    BusManager-->>App: Bus instance
```

## Redis Transport Internals

```mermaid
flowchart TB
    subgraph RedisTransport
        CM[ConnectionManager]
        PUB[Publisher Client]
        SUB[Subscriber Client]
        HC[Handler Cache]
    end

    subgraph Redis Server
        PS[Pub/Sub Engine]
        CH1[Channel: orders]
        CH2[Channel: events]
    end

    CM --> PUB
    CM --> SUB
    PUB -->|PUBLISH| PS
    PS -->|Messages| SUB
    SUB --> HC
    PS --> CH1
    PS --> CH2
```

### Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Connecting: connect()
    Connecting --> Connected: success
    Connecting --> Error: failure

    Connected --> Disconnecting: disconnect()
    Connected --> Reconnecting: connection lost

    Reconnecting --> Connected: success
    Reconnecting --> Error: max retries

    Disconnecting --> Idle: complete
    Error --> Idle: reset

    note right of Connected: Ready for operations
    note right of Reconnecting: Auto re-subscribe on success
```

## Error Hierarchy

```mermaid
classDiagram
    class Error {
        +message: string
        +stack: string
    }

    class BusError {
        +code: string
        +context: object
        +toJSON(): object
    }

    class TransportError {
        +code: TransportErrorCode
        +context: TransportErrorContext
    }

    class CodecError {
        +code: CodecErrorCode
    }

    class IntegrityError {
        +code: IntegrityErrorCode
    }

    class CompressionError {
        +code: CompressionErrorCode
    }

    class DeadLetterError {
        +code: 'DEAD_LETTER'
        +context: DeadLetterContext
    }

    Error <|-- BusError
    BusError <|-- TransportError
    BusError <|-- CodecError
    BusError <|-- IntegrityError
    BusError <|-- CompressionError
    BusError <|-- DeadLetterError
```

### Error Codes

| Error Class      | Codes                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| TransportError   | `CONNECTION_FAILED`, `NOT_READY`, `PUBLISH_FAILED`, `SUBSCRIBE_FAILED`, `UNSUBSCRIBE_FAILED` |
| CodecError       | `ENCODE_FAILED`, `DECODE_FAILED`, `PAYLOAD_TOO_LARGE`                                        |
| IntegrityError   | `VERIFICATION_FAILED`, `INVALID_FORMAT`                                                      |
| CompressionError | `COMPRESS_FAILED`, `DECOMPRESS_FAILED`                                                       |
| DeadLetterError  | `DEAD_LETTER`                                                                                |

## Data Flow Through Layers

```mermaid
flowchart TB
    subgraph Application Layer
        OBJ[JavaScript Object]
    end

    subgraph Codec Layer
        ENC[encode]
        DEC[decode]
        BIN1[Uint8Array]
    end

    subgraph Middleware Layer
        SIGN[Sign/Verify]
        COMP[Compress/Decompress]
        TRACE[Trace Context]
        BIN2[Uint8Array + metadata]
    end

    subgraph Transport Layer
        PUB[publish]
        SUB[subscribe]
        BIN3[Binary payload]
    end

    subgraph Network
        REDIS[(Redis)]
    end

    OBJ -->|publish| ENC
    ENC --> BIN1
    BIN1 --> SIGN
    SIGN --> COMP
    COMP --> TRACE
    TRACE --> BIN2
    BIN2 --> PUB
    PUB --> BIN3
    BIN3 --> REDIS

    REDIS --> BIN3
    BIN3 --> SUB
    SUB --> BIN2
    BIN2 --> TRACE
    TRACE --> COMP
    COMP --> SIGN
    SIGN --> BIN1
    BIN1 --> DEC
    DEC --> OBJ
```

## Performance Characteristics

### Memory Usage

```mermaid
flowchart LR
    subgraph Per Bus
        SM[SubscriptionManager<br />~100B per channel]
        HC[Handler Cache<br />~50B per handler]
    end

    subgraph Per Message
        ENC[Encoded payload]
        META[Middleware metadata<br />~100B overhead]
    end

    subgraph Transport
        CONN[2 Redis connections<br />per transport]
    end
```

### Latency Breakdown

```mermaid
flowchart LR
    subgraph Publish Latency
        direction LR
        E[Encode<br />~0.1ms] --> M[Middleware<br />~0.2ms]
        M --> N[Network<br />~1-5ms]
    end
```

| Operation           | Typical Latency                |
| ------------------- | ------------------------------ |
| Codec encode/decode | 0.01-0.5ms                     |
| Compression (5KB)   | 0.1-0.5ms                      |
| HMAC sign/verify    | 0.01-0.05ms                    |
| Redis round-trip    | 1-5ms (local), 5-50ms (remote) |

## Thread Safety

The library is designed for single-threaded Node.js environments:

```mermaid
flowchart TD
    subgraph Event Loop
        EL[Main Thread]
    end

    subgraph Async Operations
        P1[publish 1]
        P2[publish 2]
        S1[subscribe handler 1]
        S2[subscribe handler 2]
    end

    EL --> P1
    EL --> P2
    EL --> S1
    EL --> S2

    Note1[All operations are async<br />No shared mutable state]
```

- All operations return Promises
- No shared mutable state between operations
- Handler execution uses `Promise.allSettled()` for isolation
- Telemetry callbacks are fire-and-forget (non-blocking)

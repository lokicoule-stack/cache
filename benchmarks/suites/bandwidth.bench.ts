import { gzipSync } from 'node:zlib'

import { standardPayloads } from '@bench/fixtures/payloads.js'
import { calculateSizeReduction } from '@bench/helpers/reporting.js'
import { setupRedis, teardownRedis } from '@bench/helpers/setup.js'

import { MessageBus } from '@/core/bus/message-bus.js'
import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs/index.js'
import { RedisTransport } from '@/infrastructure/transports/redis/redis-transport.js'

const redis = await setupRedis()

const busJson = new MessageBus({
  transport: new RedisTransport({ url: redis.url }),
  codec: new JsonCodec(),
})

const busMsgpack = new MessageBus({
  transport: new RedisTransport({ url: redis.url }),
  codec: new MsgPackCodec(),
})

const busMsgpackGzip = new MessageBus({
  transport: new RedisTransport({ url: redis.url }),
  codec: new MsgPackCodec(),
  middleware: {
    compression: {
      type: 'gzip',
      threshold: 100,
    },
  },
})

await busJson.connect()
await busMsgpack.connect()
await busMsgpackGzip.connect()

const jsonCodec = new JsonCodec()
const msgpackCodec = new MsgPackCodec()

const payloadSizes = {
  small: {
    json: jsonCodec.encode(standardPayloads.small).length,
    msgpack: msgpackCodec.encode(standardPayloads.small).length,
    gzip: gzipSync(msgpackCodec.encode(standardPayloads.small)).length,
  },
  medium: {
    json: jsonCodec.encode(standardPayloads.large).length,
    msgpack: msgpackCodec.encode(standardPayloads.large).length,
    gzip: gzipSync(msgpackCodec.encode(standardPayloads.large)).length,
  },
  large: {
    json: jsonCodec.encode(standardPayloads.xxlarge).length,
    msgpack: msgpackCodec.encode(standardPayloads.xxlarge).length,
    gzip: gzipSync(msgpackCodec.encode(standardPayloads.xxlarge)).length,
  },
}

console.log('Bandwidth Analysis\n')
console.log('=== Payload Sizes ===\n')
console.table([
  {
    Payload: 'Small',
    JSON: `${payloadSizes.small.json}B`,
    MessagePack: `${payloadSizes.small.msgpack}B`,
    'MessagePack+Gzip': `${payloadSizes.small.gzip}B`,
    'Reduction (MP)': `${calculateSizeReduction(
      payloadSizes.small.json,
      payloadSizes.small.msgpack,
    ).toFixed(1)}%`,
    'Reduction (Gzip)': `${calculateSizeReduction(
      payloadSizes.small.json,
      payloadSizes.small.gzip,
    ).toFixed(1)}%`,
  },
  {
    Payload: 'Medium',
    JSON: `${payloadSizes.medium.json}B`,
    MessagePack: `${payloadSizes.medium.msgpack}B`,
    'MessagePack+Gzip': `${payloadSizes.medium.gzip}B`,
    'Reduction (MP)': `${calculateSizeReduction(
      payloadSizes.medium.json,
      payloadSizes.medium.msgpack,
    ).toFixed(1)}%`,
    'Reduction (Gzip)': `${calculateSizeReduction(
      payloadSizes.medium.json,
      payloadSizes.medium.gzip,
    ).toFixed(1)}%`,
  },
  {
    Payload: 'Large',
    JSON: `${payloadSizes.large.json}B`,
    MessagePack: `${payloadSizes.large.msgpack}B`,
    'MessagePack+Gzip': `${payloadSizes.large.gzip}B`,
    'Reduction (MP)': `${calculateSizeReduction(
      payloadSizes.large.json,
      payloadSizes.large.msgpack,
    ).toFixed(1)}%`,
    'Reduction (Gzip)': `${calculateSizeReduction(
      payloadSizes.large.json,
      payloadSizes.large.gzip,
    ).toFixed(1)}%`,
  },
])

const networkScenarios = [
  { name: 'Local (0.1ms RTT)', latencyMs: 0.1, bandwidthMbps: 1000 },
  { name: 'Same DC (1ms RTT)', latencyMs: 1, bandwidthMbps: 1000 },
  { name: 'Cross-region (50ms RTT)', latencyMs: 50, bandwidthMbps: 100 },
  { name: 'Slow network (100ms RTT)', latencyMs: 100, bandwidthMbps: 10 },
]

console.log('\n=== Bandwidth Savings Analysis ===\n')

const messagesPerSecond = 1000

networkScenarios.forEach(({ name }) => {
  console.log(`\n${name}:`)
  console.log('  Small events (1000 msg/s):')
  console.log(
    `    JSON:           ${((payloadSizes.small.json * messagesPerSecond) / 1024).toFixed(2)} KB/s`,
  )
  console.log(
    `    MessagePack:    ${((payloadSizes.small.msgpack * messagesPerSecond) / 1024).toFixed(
      2,
    )} KB/s  (saves ${(
      ((payloadSizes.small.json - payloadSizes.small.msgpack) * messagesPerSecond) /
      1024
    ).toFixed(2)} KB/s)`,
  )
  console.log(
    `    MP+Gzip:        ${((payloadSizes.small.gzip * messagesPerSecond) / 1024).toFixed(
      2,
    )} KB/s  (saves ${(
      ((payloadSizes.small.json - payloadSizes.small.gzip) * messagesPerSecond) /
      1024
    ).toFixed(2)} KB/s)`,
  )

  console.log('  Medium events (1000 msg/s):')
  console.log(
    `    JSON:           ${((payloadSizes.medium.json * messagesPerSecond) / 1024).toFixed(
      2,
    )} KB/s`,
  )
  console.log(
    `    MessagePack:    ${((payloadSizes.medium.msgpack * messagesPerSecond) / 1024).toFixed(
      2,
    )} KB/s  (saves ${(
      ((payloadSizes.medium.json - payloadSizes.medium.msgpack) * messagesPerSecond) /
      1024
    ).toFixed(2)} KB/s)`,
  )
  console.log(
    `    MP+Gzip:        ${((payloadSizes.medium.gzip * messagesPerSecond) / 1024).toFixed(
      2,
    )} KB/s  (saves ${(
      ((payloadSizes.medium.json - payloadSizes.medium.gzip) * messagesPerSecond) /
      1024
    ).toFixed(2)} KB/s)`,
  )

  console.log('  Large events (1000 msg/s):')
  console.log(
    `    JSON:           ${((payloadSizes.large.json * messagesPerSecond) / 1024 / 1024).toFixed(
      2,
    )} MB/s`,
  )
  console.log(
    `    MessagePack:    ${((payloadSizes.large.msgpack * messagesPerSecond) / 1024 / 1024).toFixed(
      2,
    )} MB/s  (saves ${(
      ((payloadSizes.large.json - payloadSizes.large.msgpack) * messagesPerSecond) /
      1024 /
      1024
    ).toFixed(2)} MB/s)`,
  )
  console.log(
    `    MP+Gzip:        ${((payloadSizes.large.gzip * messagesPerSecond) / 1024 / 1024).toFixed(
      2,
    )} MB/s  (saves ${(
      ((payloadSizes.large.json - payloadSizes.large.gzip) * messagesPerSecond) /
      1024 /
      1024
    ).toFixed(2)} MB/s)`,
  )
})

console.log('\n=== Estimated Total Time (Encode + Transfer + Decode) ===\n')
console.log('Note: Transfer time = payload_size / bandwidth + latency\n')

const calculateTotalTime = (
  payloadSize: number,
  encodeTimeUs: number,
  decodeTimeUs: number,
  latencyMs: number,
  bandwidthMbps: number,
): number => {
  const transferTimeMs = (payloadSize * 8) / (bandwidthMbps * 1000) + latencyMs
  return encodeTimeUs / 1000 + transferTimeMs + decodeTimeUs / 1000
}

const scenario = networkScenarios[3]
console.log(`Scenario: ${scenario.name}\n`)
console.log('Medium payload:')

const jsonEncodeUs = 1.5
const jsonDecodeUs = 1.4
const msgpackEncodeUs = 3.3
const msgpackDecodeUs = 2.1
const gzipOverheadUs = 50

const jsonTime = calculateTotalTime(
  payloadSizes.medium.json,
  jsonEncodeUs,
  jsonDecodeUs,
  scenario.latencyMs,
  scenario.bandwidthMbps,
)
const msgpackTime = calculateTotalTime(
  payloadSizes.medium.msgpack,
  msgpackEncodeUs,
  msgpackDecodeUs,
  scenario.latencyMs,
  scenario.bandwidthMbps,
)
const gzipTime = calculateTotalTime(
  payloadSizes.medium.gzip,
  msgpackEncodeUs + gzipOverheadUs,
  msgpackDecodeUs + gzipOverheadUs,
  scenario.latencyMs,
  scenario.bandwidthMbps,
)

console.table([
  {
    Method: 'JSON',
    Size: `${payloadSizes.medium.json}B`,
    'Total Time': `${jsonTime.toFixed(2)}ms`,
    'vs JSON': '-',
  },
  {
    Method: 'MessagePack',
    Size: `${payloadSizes.medium.msgpack}B`,
    'Total Time': `${msgpackTime.toFixed(2)}ms`,
    'vs JSON': `${(((jsonTime - msgpackTime) / jsonTime) * 100).toFixed(1)}% faster`,
  },
  {
    Method: 'MessagePack+Gzip',
    Size: `${payloadSizes.medium.gzip}B`,
    'Total Time': `${gzipTime.toFixed(2)}ms`,
    'vs JSON': `${(((jsonTime - gzipTime) / jsonTime) * 100).toFixed(1)}% faster`,
  },
])

console.log('\n=== Key Insights ===\n')
console.log('1. Bandwidth savings at scale:')
console.log(
  `   - 1M small msgs/day: ${(
    ((payloadSizes.small.json - payloadSizes.small.msgpack) * 1000000) /
    1024 /
    1024
  ).toFixed(2)} MB saved with MessagePack`,
)
console.log(
  `   - 1M medium msgs/day: ${(
    ((payloadSizes.medium.json - payloadSizes.medium.msgpack) * 1000000) /
    1024 /
    1024
  ).toFixed(2)} MB saved with MessagePack`,
)
console.log(
  `   - 1M large msgs/day: ${(
    ((payloadSizes.large.json - payloadSizes.large.msgpack) * 1000000) /
    1024 /
    1024 /
    1024
  ).toFixed(2)} GB saved with MessagePack`,
)

console.log('\n2. Decision guide:')
console.log('   Local/Fast network + Small payloads → JSON')
console.log('   Remote/Slow network OR Medium/Large payloads → MessagePack')
console.log('   High volume OR Bandwidth costs matter → MessagePack + Gzip')

await busJson.disconnect()
await busMsgpack.disconnect()
await busMsgpackGzip.disconnect()
await teardownRedis(redis)

console.log('\nBenchmark complete')

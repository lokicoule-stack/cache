import { benchmarkConfig } from '@bench/config.js'
import { standardPayloads } from '@bench/fixtures/payloads.js'
import {
  formatBenchmarkResults,
  displayResultsTable,
  calculateOverhead,
  calculateSizeReduction,
} from '@bench/helpers/reporting.js'
import { setupRedis, teardownRedis, waitForSubscriptions } from '@bench/helpers/setup.js'
import { Bench } from 'tinybench'

import { MessageBus } from '@/core/bus/message-bus.js'
import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs/index.js'
import { RedisTransport } from '@/infrastructure/transports/redis/redis-transport.js'

const redis = await setupRedis()

const rawPublisher = redis.publisher
const rawSubscriber = redis.subscriber

const busJson = new MessageBus({
  transport: new RedisTransport({ url: redis.url }),
  codec: new JsonCodec(),
})

const busMsgpack = new MessageBus({
  transport: new RedisTransport({ url: redis.url }),
  codec: new MsgPackCodec(),
})

await busJson.connect()
await busMsgpack.connect()

const counters = {
  raw: { small: 0, medium: 0, large: 0 },
  json: { small: 0, medium: 0, large: 0 },
  msgpack: { small: 0, medium: 0, large: 0 },
}

await rawSubscriber.subscribe('raw-small', () => {
  counters.raw.small++
})
await rawSubscriber.subscribe('raw-medium', () => {
  counters.raw.medium++
})
await rawSubscriber.subscribe('raw-large', () => {
  counters.raw.large++
})

await busJson.subscribe('bus-json-small', () => {
  counters.json.small++
})
await busJson.subscribe('bus-json-medium', () => {
  counters.json.medium++
})
await busJson.subscribe('bus-json-large', () => {
  counters.json.large++
})

await busMsgpack.subscribe('bus-msgpack-small', () => {
  counters.msgpack.small++
})
await busMsgpack.subscribe('bus-msgpack-medium', () => {
  counters.msgpack.medium++
})
await busMsgpack.subscribe('bus-msgpack-large', () => {
  counters.msgpack.large++
})

await waitForSubscriptions()

const jsonCodec = new JsonCodec()
const msgpackCodec = new MsgPackCodec()

const smallJsonStr = new TextDecoder().decode(jsonCodec.encode(standardPayloads.small))
const mediumJsonStr = new TextDecoder().decode(jsonCodec.encode(standardPayloads.large))
const largeJsonStr = new TextDecoder().decode(jsonCodec.encode(standardPayloads.xxlarge))

console.log('Running benchmarks...\n')

const benchSmall = new Bench({
  time: benchmarkConfig.timing.duration,
  iterations: benchmarkConfig.timing.iterations,
})

benchSmall
  .add('Raw Redis (small, baseline)', async () => {
    await rawPublisher.publish('raw-small', smallJsonStr)
  })
  .add('Bus + JSON (small)', async () => {
    await busJson.publish('bus-json-small', standardPayloads.small)
  })
  .add('Bus + MessagePack (small)', async () => {
    await busMsgpack.publish('bus-msgpack-small', standardPayloads.small)
  })

await benchSmall.run()

const benchMedium = new Bench({
  time: benchmarkConfig.timing.duration,
  iterations: benchmarkConfig.timing.iterations,
})

benchMedium
  .add('Raw Redis (medium, baseline)', async () => {
    await rawPublisher.publish('raw-medium', mediumJsonStr)
  })
  .add('Bus + JSON (medium)', async () => {
    await busJson.publish('bus-json-medium', standardPayloads.large)
  })
  .add('Bus + MessagePack (medium)', async () => {
    await busMsgpack.publish('bus-msgpack-medium', standardPayloads.large)
  })

await benchMedium.run()

const benchLarge = new Bench({
  time: benchmarkConfig.timing.duration,
  iterations: benchmarkConfig.timing.iterations,
})

benchLarge
  .add('Raw Redis (large, baseline)', async () => {
    await rawPublisher.publish('raw-large', largeJsonStr)
  })
  .add('Bus + JSON (large)', async () => {
    await busJson.publish('bus-json-large', standardPayloads.xxlarge)
  })
  .add('Bus + MessagePack (large)', async () => {
    await busMsgpack.publish('bus-msgpack-large', standardPayloads.xxlarge)
  })

await benchLarge.run()

const smallJsonSize = jsonCodec.encode(standardPayloads.small).length
const smallMsgpackSize = msgpackCodec.encode(standardPayloads.small).length
const mediumJsonSize = jsonCodec.encode(standardPayloads.large).length
const mediumMsgpackSize = msgpackCodec.encode(standardPayloads.large).length
const largeJsonSize = jsonCodec.encode(standardPayloads.xxlarge).length
const largeMsgpackSize = msgpackCodec.encode(standardPayloads.xxlarge).length

console.log(`\n=== Small Payload (~${smallJsonSize} bytes) ===\n`)
const smallResults = formatBenchmarkResults(benchSmall.tasks)
displayResultsTable(smallResults)

const rawSmallOps = smallResults[0].opsPerSecond
const busJsonSmallOps = smallResults[1].opsPerSecond
const busMsgpackSmallOps = smallResults[2].opsPerSecond

console.log(
  `\nOverhead: JSON=${calculateOverhead(rawSmallOps, busJsonSmallOps).toFixed(
    1,
  )}%, MessagePack=${calculateOverhead(rawSmallOps, busMsgpackSmallOps).toFixed(1)}%`,
)
console.log(
  `Size: JSON=${smallJsonSize}B, MessagePack=${smallMsgpackSize}B (${calculateSizeReduction(
    smallJsonSize,
    smallMsgpackSize,
  ).toFixed(1)}% reduction)`,
)

console.log(`\n=== Medium Payload (~${mediumJsonSize} bytes) ===\n`)
const mediumResults = formatBenchmarkResults(benchMedium.tasks)
displayResultsTable(mediumResults)

const rawMediumOps = mediumResults[0].opsPerSecond
const busJsonMediumOps = mediumResults[1].opsPerSecond
const busMsgpackMediumOps = mediumResults[2].opsPerSecond

console.log(
  `\nOverhead: JSON=${calculateOverhead(rawMediumOps, busJsonMediumOps).toFixed(
    1,
  )}%, MessagePack=${calculateOverhead(rawMediumOps, busMsgpackMediumOps).toFixed(1)}%`,
)
console.log(
  `Size: JSON=${mediumJsonSize}B, MessagePack=${mediumMsgpackSize}B (${calculateSizeReduction(
    mediumJsonSize,
    mediumMsgpackSize,
  ).toFixed(1)}% reduction)`,
)

console.log(`\n=== Large Payload (~${largeJsonSize} bytes) ===\n`)
const largeResults = formatBenchmarkResults(benchLarge.tasks)
displayResultsTable(largeResults)

const rawLargeOps = largeResults[0].opsPerSecond
const busJsonLargeOps = largeResults[1].opsPerSecond
const busMsgpackLargeOps = largeResults[2].opsPerSecond

console.log(
  `\nOverhead: JSON=${calculateOverhead(rawLargeOps, busJsonLargeOps).toFixed(
    1,
  )}%, MessagePack=${calculateOverhead(rawLargeOps, busMsgpackLargeOps).toFixed(1)}%`,
)
console.log(
  `Size: JSON=${largeJsonSize}B, MessagePack=${largeMsgpackSize}B (${calculateSizeReduction(
    largeJsonSize,
    largeMsgpackSize,
  ).toFixed(1)}% reduction)`,
)

console.log('\n=== Summary: Wrapper Overhead ===\n')
const avgJsonOverhead =
  [
    calculateOverhead(rawSmallOps, busJsonSmallOps),
    calculateOverhead(rawMediumOps, busJsonMediumOps),
    calculateOverhead(rawLargeOps, busJsonLargeOps),
  ].reduce((a, b) => a + b, 0) / 3

const avgMsgpackOverhead =
  [
    calculateOverhead(rawSmallOps, busMsgpackSmallOps),
    calculateOverhead(rawMediumOps, busMsgpackMediumOps),
    calculateOverhead(rawLargeOps, busMsgpackLargeOps),
  ].reduce((a, b) => a + b, 0) / 3

console.log(`Average wrapper overhead (JSON):        ~${avgJsonOverhead.toFixed(1)}%`)
console.log(`Average wrapper overhead (MessagePack): ~${avgMsgpackOverhead.toFixed(1)}%`)

await busJson.disconnect()
await busMsgpack.disconnect()
await teardownRedis(redis)

console.log('\nBenchmark complete')

import { benchmarkConfig } from '@bench/config.js'
import { standardPayloads } from '@bench/fixtures/payloads.js'
import { formatBenchmarkResults, displayResultsTable } from '@bench/helpers/reporting.js'
import { Bench } from 'tinybench'

import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs/index.js'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport.js'

const bench = new Bench({ time: benchmarkConfig.timing.duration })

const jsonCodec = new JsonCodec()
const msgpackCodec = new MsgPackCodec()

const memoryTransportJson = new MemoryTransport()
const memoryTransportMsgpack = new MemoryTransport()

await memoryTransportJson.connect()
await memoryTransportMsgpack.connect()

let messageCount = 0
await memoryTransportJson.subscribe('test-channel', () => {
  messageCount++
})
await memoryTransportMsgpack.subscribe('test-channel-msgpack', () => {
  messageCount++
})

bench
  .add('Memory transport publish (JSON, small)', async () => {
    await memoryTransportJson.publish('test-channel', jsonCodec.encode(standardPayloads.small))
  })
  .add('Memory transport publish (MessagePack, small)', async () => {
    await memoryTransportMsgpack.publish(
      'test-channel-msgpack',
      msgpackCodec.encode(standardPayloads.small),
    )
  })
  .add('Memory transport publish (JSON, medium)', async () => {
    await memoryTransportJson.publish('test-channel', jsonCodec.encode(standardPayloads.medium))
  })
  .add('Memory transport publish (MessagePack, medium)', async () => {
    await memoryTransportMsgpack.publish(
      'test-channel-msgpack',
      msgpackCodec.encode(standardPayloads.medium),
    )
  })
  .add('Memory transport publish (JSON, large)', async () => {
    await memoryTransportJson.publish('test-channel', jsonCodec.encode(standardPayloads.large))
  })
  .add('Memory transport publish (MessagePack, large)', async () => {
    await memoryTransportMsgpack.publish(
      'test-channel-msgpack',
      msgpackCodec.encode(standardPayloads.large),
    )
  })

await bench.run()

console.log('\n=== Transport Benchmarks ===\n')
const results = formatBenchmarkResults(bench.tasks)
displayResultsTable(results)

await memoryTransportJson.disconnect()
await memoryTransportMsgpack.disconnect()

console.log(`\nTotal messages processed: ${messageCount}`)

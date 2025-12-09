import { benchmarkConfig } from '@bench/config.js'
import { standardPayloads } from '@bench/fixtures/payloads.js'
import {
  formatBenchmarkResults,
  displayResultsTable,
  calculateSizeReduction,
} from '@bench/helpers/reporting.js'
import { Bench } from 'tinybench'

import { MessageBus } from '@/core/bus/message-bus.js'
import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs/index.js'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport.js'

const bench = new Bench({
  time: benchmarkConfig.timing.duration,
  iterations: benchmarkConfig.timing.iterations / 5,
})

const busJson = new MessageBus({
  transport: new MemoryTransport(),
  codec: new JsonCodec(),
})

const busMsgpack = new MessageBus({
  transport: new MemoryTransport(),
  codec: new MsgPackCodec(),
})

await busJson.connect()
await busMsgpack.connect()

let messageCountJson = 0
let messageCountMsgpack = 0

await busJson.subscribe('events', () => {
  messageCountJson++
})
await busMsgpack.subscribe('events', () => {
  messageCountMsgpack++
})

bench
  .add('Bus JSON: nano (ack)', async () => busJson.publish('events', standardPayloads.nano))
  .add('Bus MessagePack: nano (ack)', async () =>
    busMsgpack.publish('events', standardPayloads.nano),
  )
  .add('Bus JSON: tiny (ping)', async () => busJson.publish('events', standardPayloads.tiny))
  .add('Bus MessagePack: tiny (ping)', async () =>
    busMsgpack.publish('events', standardPayloads.tiny),
  )
  .add('Bus JSON: small (event)', async () => busJson.publish('events', standardPayloads.small))
  .add('Bus MessagePack: small (event)', async () =>
    busMsgpack.publish('events', standardPayloads.small),
  )
  .add('Bus JSON: medium (user action)', async () =>
    busJson.publish('events', standardPayloads.medium),
  )
  .add('Bus MessagePack: medium (user action)', async () =>
    busMsgpack.publish('events', standardPayloads.medium),
  )
  .add('Bus JSON: large (order 10 items)', async () =>
    busJson.publish('events', standardPayloads.large),
  )
  .add('Bus MessagePack: large (order 10 items)', async () =>
    busMsgpack.publish('events', standardPayloads.large),
  )
  .add('Bus JSON: xlarge (order 50 items)', async () =>
    busJson.publish('events', standardPayloads.xlarge),
  )
  .add('Bus MessagePack: xlarge (order 50 items)', async () =>
    busMsgpack.publish('events', standardPayloads.xlarge),
  )
  .add('Bus JSON: xxlarge (100 events)', async () =>
    busJson.publish('events', standardPayloads.xxlarge),
  )
  .add('Bus MessagePack: xxlarge (100 events)', async () =>
    busMsgpack.publish('events', standardPayloads.xxlarge),
  )

await bench.run()

console.log('\n=== Bus-Level Performance Comparison ===\n')
const results = formatBenchmarkResults(bench.tasks)
displayResultsTable(results)

const jsonCodec = new JsonCodec()
const msgpackCodec = new MsgPackCodec()

console.log('\n=== Payload Size Analysis ===\n')
const payloadAnalysis = [
  { label: 'Nano (ack)', payload: standardPayloads.nano },
  { label: 'Tiny (ping)', payload: standardPayloads.tiny },
  { label: 'Small (event)', payload: standardPayloads.small },
  { label: 'Medium (user action)', payload: standardPayloads.medium },
  { label: 'Large (order 10)', payload: standardPayloads.large },
  { label: 'XLarge (order 50)', payload: standardPayloads.xlarge },
  { label: 'XXLarge (100 events)', payload: standardPayloads.xxlarge },
]

console.table(
  payloadAnalysis.map(({ label, payload }) => {
    const jsonSize = jsonCodec.encode(payload).length
    const msgpackSize = msgpackCodec.encode(payload).length
    return {
      'Event Type': label,
      'JSON (bytes)': jsonSize,
      'MessagePack (bytes)': msgpackSize,
      Reduction: `${calculateSizeReduction(jsonSize, msgpackSize).toFixed(1)}%`,
    }
  }),
)

console.log(`\nTotal messages processed: ${messageCountJson + messageCountMsgpack}`)

await busJson.disconnect()
await busMsgpack.disconnect()

import { benchmarkConfig } from '@bench/config.js'
import { standardPayloads } from '@bench/fixtures/payloads.js'
import {
  formatBenchmarkResults,
  displayResultsTable,
  calculateSizeReduction,
} from '@bench/helpers/reporting.js'
import { Bench } from 'tinybench'

import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs/index.js'

const bench = new Bench({
  time: benchmarkConfig.timing.duration * 2,
  iterations: benchmarkConfig.timing.iterations * 2,
})

const jsonCodec = new JsonCodec()
const msgpackCodec = new MsgPackCodec()

const encodedPayloads = {
  nano: {
    json: jsonCodec.encode(standardPayloads.nano),
    msgpack: msgpackCodec.encode(standardPayloads.nano),
  },
  tiny: {
    json: jsonCodec.encode(standardPayloads.tiny),
    msgpack: msgpackCodec.encode(standardPayloads.tiny),
  },
  small: {
    json: jsonCodec.encode(standardPayloads.small),
    msgpack: msgpackCodec.encode(standardPayloads.small),
  },
  medium: {
    json: jsonCodec.encode(standardPayloads.medium),
    msgpack: msgpackCodec.encode(standardPayloads.medium),
  },
  large: {
    json: jsonCodec.encode(standardPayloads.large),
    msgpack: msgpackCodec.encode(standardPayloads.large),
  },
  xlarge: {
    json: jsonCodec.encode(standardPayloads.xlarge),
    msgpack: msgpackCodec.encode(standardPayloads.xlarge),
  },
  xxlarge: {
    json: jsonCodec.encode(standardPayloads.xxlarge),
    msgpack: msgpackCodec.encode(standardPayloads.xxlarge),
  },
  huge: {
    json: jsonCodec.encode(standardPayloads.huge),
    msgpack: msgpackCodec.encode(standardPayloads.huge),
  },
  massive: {
    json: jsonCodec.encode(standardPayloads.massive),
    msgpack: msgpackCodec.encode(standardPayloads.massive),
  },
  enormous: {
    json: jsonCodec.encode(standardPayloads.enormous),
    msgpack: msgpackCodec.encode(standardPayloads.enormous),
  },
}

bench
  .add('JSON encode (nano: ack)', () => jsonCodec.encode(standardPayloads.nano))
  .add('MessagePack encode (nano: ack)', () => msgpackCodec.encode(standardPayloads.nano))
  .add('JSON encode (tiny: ping)', () => jsonCodec.encode(standardPayloads.tiny))
  .add('MessagePack encode (tiny: ping)', () => msgpackCodec.encode(standardPayloads.tiny))
  .add('JSON encode (small: event)', () => jsonCodec.encode(standardPayloads.small))
  .add('MessagePack encode (small: event)', () => msgpackCodec.encode(standardPayloads.small))
  .add('JSON encode (medium: user action)', () => jsonCodec.encode(standardPayloads.medium))
  .add('MessagePack encode (medium: user action)', () =>
    msgpackCodec.encode(standardPayloads.medium),
  )
  .add('JSON encode (large: order 10 items)', () => jsonCodec.encode(standardPayloads.large))
  .add('MessagePack encode (large: order 10 items)', () =>
    msgpackCodec.encode(standardPayloads.large),
  )
  .add('JSON encode (xlarge: order 50 items)', () => jsonCodec.encode(standardPayloads.xlarge))
  .add('MessagePack encode (xlarge: order 50 items)', () =>
    msgpackCodec.encode(standardPayloads.xlarge),
  )
  .add('JSON encode (xxlarge: 100 events)', () => jsonCodec.encode(standardPayloads.xxlarge))
  .add('MessagePack encode (xxlarge: 100 events)', () =>
    msgpackCodec.encode(standardPayloads.xxlarge),
  )
  .add('JSON encode (huge: 500 events)', () => jsonCodec.encode(standardPayloads.huge))
  .add('MessagePack encode (huge: 500 events)', () => msgpackCodec.encode(standardPayloads.huge))
  .add('JSON encode (massive: 500 records)', () => jsonCodec.encode(standardPayloads.massive))
  .add('MessagePack encode (massive: 500 records)', () =>
    msgpackCodec.encode(standardPayloads.massive),
  )
  .add('JSON encode (enormous: 1000 records)', () => jsonCodec.encode(standardPayloads.enormous))
  .add('MessagePack encode (enormous: 1000 records)', () =>
    msgpackCodec.encode(standardPayloads.enormous),
  )
  .add('JSON decode (nano)', () => jsonCodec.decode(encodedPayloads.nano.json))
  .add('MessagePack decode (nano)', () => msgpackCodec.decode(encodedPayloads.nano.msgpack))
  .add('JSON decode (tiny)', () => jsonCodec.decode(encodedPayloads.tiny.json))
  .add('MessagePack decode (tiny)', () => msgpackCodec.decode(encodedPayloads.tiny.msgpack))
  .add('JSON decode (small)', () => jsonCodec.decode(encodedPayloads.small.json))
  .add('MessagePack decode (small)', () => msgpackCodec.decode(encodedPayloads.small.msgpack))
  .add('JSON decode (medium)', () => jsonCodec.decode(encodedPayloads.medium.json))
  .add('MessagePack decode (medium)', () => msgpackCodec.decode(encodedPayloads.medium.msgpack))
  .add('JSON decode (large)', () => jsonCodec.decode(encodedPayloads.large.json))
  .add('MessagePack decode (large)', () => msgpackCodec.decode(encodedPayloads.large.msgpack))
  .add('JSON decode (xlarge)', () => jsonCodec.decode(encodedPayloads.xlarge.json))
  .add('MessagePack decode (xlarge)', () => msgpackCodec.decode(encodedPayloads.xlarge.msgpack))
  .add('JSON decode (xxlarge)', () => jsonCodec.decode(encodedPayloads.xxlarge.json))
  .add('MessagePack decode (xxlarge)', () => msgpackCodec.decode(encodedPayloads.xxlarge.msgpack))
  .add('JSON decode (huge)', () => jsonCodec.decode(encodedPayloads.huge.json))
  .add('MessagePack decode (huge)', () => msgpackCodec.decode(encodedPayloads.huge.msgpack))
  .add('JSON decode (massive)', () => jsonCodec.decode(encodedPayloads.massive.json))
  .add('MessagePack decode (massive)', () => msgpackCodec.decode(encodedPayloads.massive.msgpack))
  .add('JSON decode (enormous)', () => jsonCodec.decode(encodedPayloads.enormous.json))
  .add('MessagePack decode (enormous)', () => msgpackCodec.decode(encodedPayloads.enormous.msgpack))

await bench.run()

console.log('\n=== Codec Benchmarks ===\n')
const results = formatBenchmarkResults(bench.tasks)
displayResultsTable(results)

console.log('\n=== Size Comparison ===\n')
const sizeComparisons = [
  { label: 'Nano (ack)', ...encodedPayloads.nano },
  { label: 'Tiny (ping)', ...encodedPayloads.tiny },
  { label: 'Small (event)', ...encodedPayloads.small },
  { label: 'Medium (user action)', ...encodedPayloads.medium },
  { label: 'Large (order 10)', ...encodedPayloads.large },
  { label: 'XLarge (order 50)', ...encodedPayloads.xlarge },
  { label: 'XXLarge (100 events)', ...encodedPayloads.xxlarge },
  { label: 'Huge (500 events)', ...encodedPayloads.huge },
  { label: 'Massive (500 records)', ...encodedPayloads.massive },
  { label: 'Enormous (1000 records)', ...encodedPayloads.enormous },
]

console.table(
  sizeComparisons.map(({ label, json, msgpack }) => ({
    Payload: label,
    'JSON (bytes)': json.length,
    'MessagePack (bytes)': msgpack.length,
    Reduction: `${calculateSizeReduction(json.length, msgpack.length).toFixed(1)}%`,
  })),
)

console.log('\n=== Recommendations ===\n')
sizeComparisons.forEach(({ label, json, msgpack }) => {
  const size = json.length
  const reduction = calculateSizeReduction(json.length, msgpack.length)

  let recommendation: string
  if (size < benchmarkConfig.thresholds.smallPayloadBoundary) {
    recommendation = 'JSON (overhead dominates)'
  } else if (size < benchmarkConfig.thresholds.mediumPayloadBoundary) {
    recommendation = reduction > 10 ? 'MessagePack' : 'Either'
  } else if (size < benchmarkConfig.thresholds.largePayloadBoundary) {
    recommendation = 'MessagePack'
  } else {
    recommendation = 'MessagePack + compression'
  }

  console.log(`${label.padEnd(25)} ${size.toString().padStart(8)}B → ${recommendation}`)
})

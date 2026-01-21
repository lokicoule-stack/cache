import { FakeL1Driver } from '../drivers/fake-l1'
import { FakeL2Driver, type FakeL2Config } from '../drivers/fake-l2'

// Automatically connects the driver - use for tests that need ready-to-use L2
export async function createConnectedL2(
  name = 'test',
  options: Partial<FakeL2Config> = {},
): Promise<FakeL2Driver> {
  const driver = new FakeL2Driver({ name, ...options })
  await driver.connect()
  return driver
}

export function createL1(name = 'memory'): FakeL1Driver {
  return new FakeL1Driver({ name })
}

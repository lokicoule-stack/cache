import type { createClient, createCluster, RedisClientOptions, RedisClusterOptions } from 'redis'

/**
 * Configuration for creating a new Redis transport.
 *
 * @public
 */
export type RedisTransportConfig = RedisClientOptions | RedisClusterOptions

/**
 * Configuration for using an existing Redis client.
 *
 * @public
 */
export interface RedisTransportExternalConfig {
  client: RedisInstance
}

/**
 * Redis client instance type.
 * @public
 */
export type RedisInstance = ReturnType<typeof createClient> | ReturnType<typeof createCluster>

export function isClusterConfig(config: RedisTransportConfig): config is RedisClusterOptions {
  return typeof config === 'object' && 'rootNodes' in config
}

export function isExternalConfig(
  config: RedisTransportConfig | RedisTransportExternalConfig,
): config is RedisTransportExternalConfig {
  return typeof config === 'object' && 'client' in config
}

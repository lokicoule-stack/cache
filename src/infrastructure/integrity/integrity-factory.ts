import { HMACIntegrity } from './hmac-integrity'
import { IntegrityConfigError } from './integrity-errors'

import type { Integrity } from '@/contracts/integrity'
import type { IntegrityOption } from '@/core/middleware/integrity/integrity-config'

/**
 * Create integrity instance from configuration
 * @internal
 */
export function createIntegrity(option: IntegrityOption): Integrity {
  if (typeof option === 'string') {
    throw new IntegrityConfigError(`String integrity type not supported: "${option}"`, {
      context: { integrityType: option },
    })
  }

  switch (option.type) {
    case 'hmac': {
      if (!option.key) {
        throw new IntegrityConfigError('HMAC requires a key', {
          context: { integrityType: 'hmac' },
        })
      }

      if (typeof option.key === 'string' && option.key.length < 32) {
        throw new IntegrityConfigError('HMAC key must be at least 32 characters (hex)', {
          context: { integrityType: 'hmac', keyLength: option.key.length },
        })
      }

      return new HMACIntegrity(option.key)
    }

    default:
      throw new IntegrityConfigError(`Unknown integrity type: ${(option as { type: string }).type}`, {
        context: { integrityType: (option as { type: string }).type },
      })
  }
}

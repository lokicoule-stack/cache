import { ChannelSubscription } from './channel-subscription'

/**
 * @internal
 */
export class SubscriptionManager {
  readonly #subscriptions = new Map<string, ChannelSubscription>()

  has(channel: string): boolean {
    return this.#subscriptions.has(channel)
  }

  get(channel: string): ChannelSubscription | undefined {
    return this.#subscriptions.get(channel)
  }

  getOrCreate(channel: string): ChannelSubscription {
    let subscription = this.#subscriptions.get(channel)

    if (!subscription) {
      subscription = new ChannelSubscription()
      this.#subscriptions.set(channel, subscription)
    }

    return subscription
  }

  delete(channel: string): boolean {
    return this.#subscriptions.delete(channel)
  }

  getAllChannels(): string[] {
    return Array.from(this.#subscriptions.keys())
  }
}

import type { TabChannel } from '../tab-guard'

type Listener = (event: { data: unknown }) => void

/** In-memory stand-in for BroadcastChannel: delivers synchronously to every other open channel. */
export function createFakeTabBus() {
  const channels = new Set<{ listeners: Set<Listener> }>()
  const open = (): TabChannel & { closed: boolean } => {
    const self = { listeners: new Set<Listener>() }
    channels.add(self)
    const channel = {
      closed: false,
      postMessage(message: unknown) {
        for (const other of channels) {
          if (other !== self) for (const listener of other.listeners) listener({ data: message })
        }
      },
      addEventListener(_type: 'message', listener: Listener) {
        self.listeners.add(listener)
      },
      removeEventListener(_type: 'message', listener: Listener) {
        self.listeners.delete(listener)
      },
      close() {
        channels.delete(self)
        channel.closed = true
      },
    }
    return channel
  }
  const broadcast = (message: unknown): void => {
    for (const other of channels) for (const listener of other.listeners) listener({ data: message })
  }
  return { open, broadcast }
}

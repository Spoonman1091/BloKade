import { z } from 'zod'
import { newId } from '../document/factory'

export const TAB_CHANNEL_NAME = 'blokade'

type MessageListener = (event: { data: unknown }) => void

/** The part of BroadcastChannel the guard uses (so tests can inject a fake). */
export interface TabChannel {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: MessageListener): void
  removeEventListener(type: 'message', listener: MessageListener): void
  close(): void
}

export interface TabGuard {
  /** This tab just opened `designId` (startup or Designs → Open). Clears any lock. */
  opened(designId: string): void
  /** This tab just saved `designId`. */
  saved(designId: string): void
  /** True when another, newer tab owns `designId`, so this tab must not write it. */
  isLocked(designId: string): boolean
  dispose(): void
}

const tabMessage = z.object({
  type: z.enum(['opened', 'saved']),
  designId: z.string(),
  tabId: z.string(),
  openedAt: z.number(),
})

/** BroadcastChannel works over plain HTTP; very old browsers (and jsdom) lack it, so the guard is skipped. */
export function openTabChannel(): TabChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(TAB_CHANNEL_NAME)
}

/** Stops two tabs overwriting the same design: the tab that opened it most recently wins. */
export function createTabGuard(options: {
  channel: TabChannel | null
  onLocked(designId: string): void
  tabId?: string
  now?: () => number
}): TabGuard {
  const { channel, onLocked } = options
  const tabId = options.tabId ?? newId()
  const now = options.now ?? Date.now
  let current: { designId: string; openedAt: number } | null = null
  let lockedId: string | null = null
  let disposed = false

  const post = (type: 'opened' | 'saved', designId: string): void => {
    if (disposed || !current || current.designId !== designId) return
    channel?.postMessage({ type, designId, tabId, openedAt: current.openedAt })
  }

  const onMessage: MessageListener = (event) => {
    const parsed = tabMessage.safeParse(event.data)
    if (!parsed.success || !current) return
    const message = parsed.data
    if (message.tabId === tabId || message.designId !== current.designId || lockedId === message.designId) return
    // Only a tab that opened the design after us may take it over; an older tab's late save is ignored.
    if (message.type === 'saved' && message.openedAt <= current.openedAt) return
    lockedId = message.designId
    onLocked(message.designId)
  }
  channel?.addEventListener('message', onMessage)

  return {
    opened(designId) {
      current = { designId, openedAt: now() }
      lockedId = null
      post('opened', designId)
    },
    saved: (designId) => post('saved', designId),
    isLocked: (designId) => lockedId === designId,
    dispose() {
      if (disposed) return
      disposed = true
      channel?.removeEventListener('message', onMessage)
      channel?.close()
    },
  }
}

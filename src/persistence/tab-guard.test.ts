import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTabGuard, openTabChannel } from './tab-guard'
import { createFakeTabBus } from './testing/fake-tab-channel'

afterEach(() => vi.unstubAllGlobals())

function twoTabs() {
  const bus = createFakeTabBus()
  let clock = 0
  const now = () => ++clock
  const lockedA = vi.fn()
  const lockedB = vi.fn()
  const a = createTabGuard({ channel: bus.open(), onLocked: lockedA, tabId: 'A', now })
  const b = createTabGuard({ channel: bus.open(), onLocked: lockedB, tabId: 'B', now })
  return { bus, a, b, lockedA, lockedB }
}

describe('tab guard', () => {
  it('locks the older tab when another tab opens the same design', () => {
    const { a, b, lockedA, lockedB } = twoTabs()
    a.opened('x')
    b.opened('x')
    expect(a.isLocked('x')).toBe(true)
    expect(lockedA).toHaveBeenCalledExactlyOnceWith('x')
    expect(b.isLocked('x')).toBe(false)
    expect(lockedB).not.toHaveBeenCalled()
  })

  it('ignores tabs working on a different design', () => {
    const { a, b, lockedA } = twoTabs()
    a.opened('x')
    b.opened('y')
    b.saved('y')
    expect(a.isLocked('x')).toBe(false)
    expect(lockedA).not.toHaveBeenCalled()
  })

  it('locks when a newer tab saves the same design', () => {
    const bus = createFakeTabBus()
    const onLocked = vi.fn()
    const a = createTabGuard({ channel: bus.open(), onLocked, tabId: 'A', now: () => 5 })
    a.opened('x')
    bus.broadcast({ type: 'saved', designId: 'x', tabId: 'B', openedAt: 9 })
    expect(a.isLocked('x')).toBe(true)
    expect(onLocked).toHaveBeenCalledExactlyOnceWith('x')
  })

  it('keeps the newest opener working when an older tab saves', () => {
    const { a, b, lockedB } = twoTabs()
    a.opened('x')
    b.opened('x')
    a.saved('x')
    expect(b.isLocked('x')).toBe(false)
    expect(lockedB).not.toHaveBeenCalled()
  })

  it('clears the lock when the locked tab opens another design', () => {
    const { a, b } = twoTabs()
    a.opened('x')
    b.opened('x')
    a.opened('y')
    expect(a.isLocked('x')).toBe(false)
    expect(a.isLocked('y')).toBe(false)
  })

  it('ignores its own messages and junk', () => {
    const bus = createFakeTabBus()
    const onLocked = vi.fn()
    const a = createTabGuard({ channel: bus.open(), onLocked, tabId: 'A' })
    a.opened('x')
    bus.broadcast({ type: 'opened', designId: 'x', tabId: 'A', openedAt: 1e15 })
    bus.broadcast('nonsense')
    bus.broadcast({ type: 'party', designId: 'x', tabId: 'B', openedAt: 1e15 })
    bus.broadcast(null)
    expect(a.isLocked('x')).toBe(false)
    expect(onLocked).not.toHaveBeenCalled()
  })

  it('locks only once per design', () => {
    const { a, b, lockedA } = twoTabs()
    a.opened('x')
    b.opened('x')
    b.saved('x')
    expect(lockedA).toHaveBeenCalledOnce()
  })

  it('does nothing without a channel', () => {
    const guard = createTabGuard({ channel: null, onLocked: vi.fn() })
    guard.opened('x')
    guard.saved('x')
    expect(guard.isLocked('x')).toBe(false)
    guard.dispose()
  })

  it('stops listening and closes the channel on dispose', () => {
    const bus = createFakeTabBus()
    const channel = bus.open()
    const onLocked = vi.fn()
    const a = createTabGuard({ channel, onLocked, tabId: 'A' })
    a.opened('x')
    a.dispose()
    bus.broadcast({ type: 'opened', designId: 'x', tabId: 'B', openedAt: 1e15 })
    expect(onLocked).not.toHaveBeenCalled()
    expect(channel.closed).toBe(true)
  })

  it('has no channel in browsers without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    expect(openTabChannel()).toBeNull()
  })

  it('opens the shared blokade channel when available', () => {
    const made: string[] = []
    vi.stubGlobal('BroadcastChannel', class { constructor(name: string) { made.push(name) } })
    expect(openTabChannel()).not.toBeNull()
    expect(made).toEqual(['blokade'])
  })
})

import { describe, expect, it } from 'vitest'
import { createRegistry } from '../plugins/registry'
import { NO_NAME } from './definition'
import { loadFolderPlugins } from './folder'

const build = () => null

describe('loadFolderPlugins', () => {
  it('turns plugin files into plugins that use the friendly toolkit', () => {
    const { plugins, problems } = loadFolderPlugins({
      '../../plugins/robot-head.js': { name: 'Robot head', icon: '🤖', build, settings: { size: { type: 'mm', default: 20 } } },
    })
    expect(problems).toEqual([])
    expect(plugins[0]).toMatchObject({
      id: 'robot-head', name: 'Robot head', icon: '🤖', version: 1, toolkit: 'kade',
      params: { size: { type: 'mm', default: 20, label: 'size' } },
    })
    expect(plugins[0]?.build).toBe(build)
    expect(createRegistry(plugins).problems).toEqual([])
  })
  it('keeps an id and version written in the file', () => {
    const { plugins } = loadFolderPlugins({ '../../plugins/x.js': { id: 'robot', version: 3, name: 'Robot', build } })
    expect(plugins[0]).toMatchObject({ id: 'robot', version: 3 })
  })
  it('makes an id from an awkward file name', () => {
    const { plugins } = loadFolderPlugins({ '../../plugins/sub/My Robot!.ts': { name: 'Robot', build } })
    expect(plugins[0]?.id).toBe('my-robot')
  })
  it('reports a broken file by name and leaves it out', () => {
    const { plugins, problems } = loadFolderPlugins({ '../../plugins/broken.js': { build } })
    expect(plugins).toEqual([])
    expect(problems).toEqual([`Plugin file "broken.js" has a problem: ${NO_NAME}`])
  })
})

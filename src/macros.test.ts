import { describe, expect, it } from 'vitest'
import { parseMacros } from './macros'

describe('local macros', () => {
  it('loads valid buttons and ignores corrupt or duplicate entries', () => {
    const macro = { id: 'one', tab: 1, name: 'Attack', notation: '2d20+5' }
    expect(parseMacros(JSON.stringify([macro, { ...macro, name: 'duplicate' }, { ...macro, id: 'bad', tab: 9 }]))).toEqual([macro])
    expect(parseMacros('{broken')).toEqual([])
  })
})

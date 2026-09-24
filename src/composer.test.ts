import { describe, expect, it } from 'vitest'
import { rollRpgDice } from '@erpg/dicecore/core'
import { addDie, parseSimplePool, removeDie } from './composer'

describe('shared pool and notation', () => {
  it('taps build the same seeded roll as typed notation', () => {
    let expression = ''
    expression = addDie(expression, 6).expression
    expression = addDie(expression, 20).expression
    expression = addDie(expression, 6).expression
    expect(expression).toBe('2d6+d20')
    expect(rollRpgDice(expression, { seed: 'same' })).toEqual(rollRpgDice('2d6+d20', { seed: 'same' }))
    expect(removeDie(expression, 6)).toBe('d6+d20')
  })

  it('preserves modifiers when a die is added', () => {
    expect(addDie('2d6+3', 20).expression).toBe('2d6+d20+3')
    expect(addDie('d20-2', 6).expression).toBe('d20+d6-2')
  })

  it('appends to valid advanced notation and leaves invalid notation unchanged', () => {
    expect(addDie('4d6kh3', 20)).toEqual({ expression: '4d6kh3+d20', valid: true })
    expect(addDie('2#d6', 20)).toEqual({ expression: '2#d6+d20', valid: true })
    expect(addDie('not dice', 20)).toEqual({ expression: 'not dice', valid: false })
    expect(parseSimplePool('5d10>=8f=1')).toBeNull()
  })

  it('resolves modifiers and success pools through Dicecore', () => {
    const modifier = rollRpgDice('4d6kh3+2', { seed: 'modifier' })
    expect(modifier.dice).toHaveLength(4)
    expect(modifier.total).toBeGreaterThanOrEqual(5)
    const pool = rollRpgDice('5d10>=8f=1', { seed: 'pool' })
    expect(pool.dice).toHaveLength(5)
    expect(pool.pool).not.toBeNull()
    expect(pool.pool!.successes + pool.pool!.failures).toBeLessThanOrEqual(5)
  })
})

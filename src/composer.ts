import { inspectRpgDiceNotation } from '@erpg/dicecore/core'

export const DICE_SIDES = [2, 4, 6, 8, 10, 12, 20, 100] as const
export type StandardSides = typeof DICE_SIDES[number]

export interface SimplePool {
  readonly dice: ReadonlyMap<StandardSides, number>
  readonly modifier: number
}

const dieTerm = /^(\d*)d(100|20|12|10|8|6|4|2)$/i
const integerTerm = /^\d+$/

export function parseSimplePool(expression: string): SimplePool | null {
  const compact = expression.replace(/\s+/g, '')
  const dice = new Map<StandardSides, number>()
  if (!compact) return { dice, modifier: 0 }
  const terms = compact.match(/[+-]?[^+-]+/g)
  if (!terms || terms.join('') !== compact) return null
  let modifier = 0
  for (const [index, signed] of terms.entries()) {
    const sign = signed[0] === '-' ? -1 : 1
    const term = /^[+-]/.test(signed) ? signed.slice(1) : signed
    if (index > 0 && !/^[+-]/.test(signed)) return null
    const die = term.match(dieTerm)
    if (die) {
      if (sign < 0) return null
      const count = die[1] ? Number(die[1]) : 1
      if (!Number.isSafeInteger(count) || count < 1 || count > 100) return null
      const sides = Number(die[2]) as StandardSides
      dice.set(sides, (dice.get(sides) ?? 0) + count)
    } else if (integerTerm.test(term)) {
      const number = Number(term)
      if (!Number.isSafeInteger(number)) return null
      modifier += sign * number
    } else return null
  }
  return { dice, modifier }
}

export function formatSimplePool(pool: SimplePool): string {
  const terms: string[] = []
  for (const [sides, count] of pool.dice) {
    if (count > 0) terms.push(`${count === 1 ? '' : count}d${sides}`)
  }
  if (pool.modifier > 0) terms.push(String(pool.modifier))
  if (pool.modifier < 0) return `${terms.join('+')}${pool.modifier}`
  return terms.join('+')
}

export function addDie(expression: string, sides: StandardSides): { expression: string; valid: boolean } {
  const simple = parseSimplePool(expression)
  if (simple) {
    const dice = new Map(simple.dice)
    dice.set(sides, (dice.get(sides) ?? 0) + 1)
    return { expression: formatSimplePool({ dice, modifier: simple.modifier }), valid: true }
  }
  const candidate = `${expression.trim()}+d${sides}`
  return inspectRpgDiceNotation(candidate).isValid
    ? { expression: candidate, valid: true }
    : { expression, valid: false }
}

export function removeDie(expression: string, sides: StandardSides): string {
  const simple = parseSimplePool(expression)
  if (!simple) return expression
  const dice = new Map(simple.dice)
  const count = dice.get(sides) ?? 0
  if (count <= 1) dice.delete(sides)
  else dice.set(sides, count - 1)
  return formatSimplePool({ dice, modifier: simple.modifier })
}

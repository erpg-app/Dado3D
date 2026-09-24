import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { english, isRtl, matchLanguage } from './i18n'
import { LOCALE_CODES } from './locale-codes'

describe('bundled languages', () => {
  it('contains 104 complete catalogs, including English', () => {
    expect(LOCALE_CODES).toHaveLength(104)
    expect(new Set(LOCALE_CODES).size).toBe(104)
    for (const code of LOCALE_CODES) {
      const catalog = code === 'en' ? english : JSON.parse(readFileSync(resolve(`public/locales/${code}.json`), 'utf8'))
      expect(Object.keys(catalog).sort(), code).toEqual(Object.keys(english).sort())
      expect(Object.values(catalog).every(value => typeof value === 'string' && value.trim().length > 0), code).toBe(true)
    }
  })

  it('inherits regional and script variants and marks RTL layouts', () => {
    expect(matchLanguage(['pt-BR'])).toBe('pt')
    expect(matchLanguage(['zh-Hant-TW'])).toBe('zh')
    expect(matchLanguage(['sr-Latn-RS'])).toBe('sr')
    expect(isRtl('ar-EG')).toBe(true)
    expect(isRtl('pt-BR')).toBe(false)
  })
})

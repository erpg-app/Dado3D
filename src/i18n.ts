import { LOCALE_CODES } from './locale-codes'
import englishSource from './english.json'

export const english = englishSource

export type MessageKey = keyof typeof english
export type Messages = Record<MessageKey, string>

const rtl = new Set(['ar', 'fa', 'he', 'ps', 'sd', 'ur', 'ug', 'yi'])
let current: Messages = english
let currentCode = 'en'

export function message(key: MessageKey): string { return current[key] }
export function languageCode(): string { return currentCode }
export function isRtl(code: string): boolean { return rtl.has(code.split('-')[0]) }

export function matchLanguage(preferences: readonly string[]): string {
  const supported = new Set<string>(LOCALE_CODES)
  for (const preference of preferences) {
    let candidate = preference.replaceAll('_', '-')
    while (candidate) {
      if (supported.has(candidate)) return candidate
      const separator = candidate.lastIndexOf('-')
      if (separator < 0) break
      candidate = candidate.slice(0, separator)
    }
  }
  return 'en'
}

export async function setLanguage(code: string): Promise<string> {
  const selected = LOCALE_CODES.includes(code) ? code : 'en'
  if (selected === 'en') { current = english; currentCode = 'en'; return 'en' }
  try {
    const url = new URL(`locales/${encodeURIComponent(selected)}.json`, document.baseURI)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Locale ${selected}: HTTP ${response.status}`)
    const catalog: unknown = await response.json()
    if (!catalog || typeof catalog !== 'object') throw new Error('Invalid locale catalog')
    const values = catalog as Record<string, unknown>
    for (const key of Object.keys(english) as MessageKey[]) {
      if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(`Missing ${key} in ${selected}`)
    }
    current = values as Messages
    currentCode = selected
    return selected
  } catch (error) {
    console.warn('Locale fallback to English', error)
    current = english
    currentCode = 'en'
    return 'en'
  }
}

export function applyMessages(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n as MessageKey
    if (key in english) element.textContent = message(key)
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = element.dataset.i18nAria as MessageKey
    if (key in english) element.setAttribute('aria-label', message(key))
  }
  document.documentElement.lang = currentCode
  document.documentElement.dir = isRtl(currentCode) ? 'rtl' : 'ltr'
}

export function languageOptions(): readonly { code: string; name: string }[] {
  return LOCALE_CODES.map(code => {
    try {
      const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
      return { code, name }
    } catch { return { code, name: code } }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

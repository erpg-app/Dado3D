// One-time catalog generator. Builds never contact a translation service.
// CLDR 48's chart computes 102 modern locales; its release note reports 104.
// Six entries unsupported by the catalog translator and five script variants
// it ignores are replaced with eleven supported languages. Akan and Bashkir
// bring the total to 104 distinct languages.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(await readFile(join(root, 'src', 'english.json'), 'utf8'))
const chart = 'https://www.unicode.org/cldr/charts/48/supplemental/locale_coverage.html'
const html = await (await fetch(chart)).text()
const modern = []
for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
  const match = row.match(/<a name='([^']+)' href='#/)
  if (!match) continue
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    .map(([, cell]) => cell.replace(/<[^>]*>/g, '').trim())
  if (cells[8] === 'modern') modern.push(match[1].replaceAll('_', '-'))
}
const unavailable = new Set(['chr', 'dsb', 'hsb', 'nn', 'pcm', 'rm', 'hi-Latn', 'kk-Arab', 'sr-Latn', 'yue-Hans', 'zh-Hant'])
const replacements = ['br', 'mi', 'xh', 'sm', 'lb', 'ku', 'eo', 'mt', 'ht', 'su', 'ny']
const codes = [...new Set([...modern.filter(code => !unavailable.has(code)), ...replacements, 'ak', 'ba'])].sort()
if (codes.length !== 104) throw new Error(`Expected 104 languages, got ${codes.length}`)
await writeFile(join(root, 'src', 'locale-codes.ts'),
  `// 104 bundled languages: CLDR Modern coverage with supported substitutions, plus Akan and Bashkir.\nexport const LOCALE_CODES: readonly string[] = ${JSON.stringify(codes)}\n`)
console.log(`Wrote ${codes.length} locale codes`)
if (!process.argv.includes('--translate')) process.exit(0)

const output = join(root, 'public', 'locales')
await mkdir(output, { recursive: true })
const keys = Object.keys(source)
// Disambiguate the English noun "die" so machine translation does not render
// it as death. These contextual phrases are only inputs to the generator.
const translationSource = {
  ...source,
  tapDice: 'Tap the dice to prepare your dice roll',
  expression: 'Dice notation',
  roll: 'Roll the dice',
  addDie: 'Add a dice',
  removeDie: 'Remove a dice',
  countDice: 'dice selected',
  preparing: 'Preparing 3D dice…',
  rolling: 'Rolling the dice…',
  invalid: 'Invalid dice notation',
  noDice: 'Choose a dice or enter dice notation',
  no3d: 'This dice roll has no compatible 3D dice. The result is shown below.',
  graphicsError: '3D graphics are unavailable. The full dice result is shown below.',
  net: 'Net successes',
  values: 'Dice faces',
}
const input = Object.values(translationSource).join('\n')
let failures = []
for (const [index, code] of codes.entries()) {
  if (code === 'en') continue
  const target = join(output, `${code}.json`)
  if (!process.argv.includes('--overwrite')) {
    try { await access(target); continue } catch { /* Generate missing catalogs. */ }
  }
  const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: code, dt: 't', q: input })
  try {
    let response
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal: AbortSignal.timeout(20_000) })
      if (response.ok) break
      await new Promise(resolveDelay => setTimeout(resolveDelay, 1000 * (attempt + 1)))
    }
    if (!response?.ok) throw new Error(`HTTP ${response?.status}`)
    const data = await response.json()
    const translated = data[0].map(part => part[0]).join('').trimEnd().split('\n')
    if (translated.length !== keys.length) throw new Error(`Expected ${keys.length} lines, got ${translated.length}`)
    const catalog = Object.fromEntries(keys.map((key, i) => [key, translated[i].trim()]))
    if (code === 'pt') Object.assign(catalog, {
      tapDice: 'Toque nos dados para montar sua rolagem', expression: 'Notação',
      roll: 'Rolar dados', light: 'Claro', addDie: 'Adicionar dado',
      removeDie: 'Remover dado', countDice: 'dados na pilha',
      preparing: 'Preparando 3D…', rolling: 'Rolando…', invalid: 'Notação inválida',
      noDice: 'Escolha um dado ou digite uma notação',
      no3d: 'Esta rolagem não possui dados 3D compatíveis. O resultado aparece abaixo.',
      graphicsError: 'O 3D não está disponível. O resultado completo aparece abaixo.',
      net: 'Saldo', values: 'Faces',
    })
    if (Object.values(catalog).some(value => !value)) throw new Error('Empty message')
    if (Object.values(catalog).every((value, i) => value === Object.values(source)[i])) throw new Error('Untranslated catalog')
    await writeFile(target, JSON.stringify(catalog) + '\n')
    console.log(`${index + 1}/${codes.length}: ${code}`)
  } catch (error) {
    failures.push(`${code}: ${error.message}`)
    console.error(`${index + 1}/${codes.length}: ${code} failed: ${error.message}`)
  }
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}

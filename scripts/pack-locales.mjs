import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const english = JSON.parse(await readFile(join(root, 'src', 'english.json'), 'utf8'))
const keys = Object.keys(english)
const folder = join(root, 'dist', 'locales')
let savedBytes = 0
let count = 0

for (const filename of await readdir(folder)) {
  if (!filename.endsWith('.json')) continue
  const path = join(folder, filename)
  const source = await readFile(path, 'utf8')
  const catalog = JSON.parse(source)
  if (Object.keys(catalog).length !== keys.length) throw new Error(`Incomplete locale: ${filename}`)
  const values = keys.map(key => {
    const value = catalog[key]
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${key} in ${filename}`)
    return value
  })
  const packed = JSON.stringify(values)
  await writeFile(path, packed)
  savedBytes += Buffer.byteLength(source) - Buffer.byteLength(packed)
  count++
}

if (count !== 103) throw new Error(`Expected 103 locale files, found ${count}`)
console.log(`Packed ${count} locales, saved ${savedBytes} raw bytes`)

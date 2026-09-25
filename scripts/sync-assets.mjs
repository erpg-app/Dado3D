import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules', '@erpg', 'dice3dview', 'dist', 'assets', 'dice-box', 'themes', 'default')
const target = join(root, 'public', 'assets', 'dice-box', 'themes', 'default')
const allowed = ['coin-1.svg', 'coin-2.svg', 'default.json', 'diffuse-light.webp', 'diffuse-dark.webp', 'glyph-orientation.json', 'normal.webp', 'theme.config.json']

if (!target.startsWith(root + sep)) throw new Error('asset target escaped the project')
await readFile(join(source, 'theme.config.json'))
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const filename of allowed) await cp(join(source, filename), join(target, filename))
for (const filename of ['glyph-orientation.json', 'theme.config.json']) {
  const path = join(target, filename)
  await writeFile(path, JSON.stringify(JSON.parse(await readFile(path, 'utf8'))))
}
console.log(`Copied ${allowed.length} default theme assets`)

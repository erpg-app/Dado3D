import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const baseline = JSON.parse(await readFile(join(root, 'size-baseline.json'), 'utf8'))
const totals = { javascript: 0, css: 0, locales: 0, assets: 0, other: 0 }
const gzipTotals = { ...totals }
const files = []

async function visit(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) { await visit(path); continue }
    const data = await readFile(path)
    const relative = path.slice(dist.length + 1).replaceAll('\\', '/')
    const kind = relative.startsWith('locales/') ? 'locales'
      : extname(entry.name) === '.js' ? 'javascript'
      : extname(entry.name) === '.css' ? 'css'
      : relative.startsWith('assets/') ? 'assets' : 'other'
    totals[kind] += data.length
    const gzipBytes = gzipSync(data, { level: 9 }).length
    gzipTotals[kind] += gzipBytes
    files.push({ path: relative, kind, rawBytes: data.length, gzipBytes })
  }
}

await visit(dist)
const total = Object.values(totals).reduce((sum, bytes) => sum + bytes, 0)
const gzip = Object.values(gzipTotals).reduce((sum, bytes) => sum + bytes, 0)
const report = { rawBytes: total, gzipBytes: gzip, rawByKind: totals, gzipByKind: gzipTotals, files: files.sort((a, b) => a.path.localeCompare(b.path)) }
console.log(JSON.stringify({ rawBytes: total, gzipBytes: gzip, rawByKind: totals, gzipByKind: gzipTotals }, null, 2))
const outputIndex = process.argv.indexOf('--output')
if (outputIndex >= 0) {
  if (!process.argv[outputIndex + 1]) throw new Error('--output requires a path')
  await writeFile(resolve(root, process.argv[outputIndex + 1]), JSON.stringify(report, null, 2) + '\n')
}

if (baseline.maxRawBytes && total > baseline.maxRawBytes * 1.05) {
  console.error(`Web payload grew more than 5% above the recorded ${baseline.maxRawBytes} bytes`)
  process.exitCode = 1
}

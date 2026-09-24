import { readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const [platform, folder, output] = process.argv.slice(2)
if (!platform || !folder || !output) throw new Error('Usage: node scripts/measure-native.mjs <platform> <folder> <output.json>')
const root = resolve(folder)
const artifacts = []

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app')) {
        const files = []
        async function appSize(dir) {
          for (const item of await readdir(dir, { withFileTypes: true })) {
            const file = join(dir, item.name)
            if (item.isDirectory()) await appSize(file)
            else files.push((await stat(file)).size)
          }
        }
        await appSize(child)
        artifacts.push({ path: child.slice(root.length + 1).replaceAll('\\', '/'), installedBytes: files.reduce((a, b) => a + b, 0) })
      } else await visit(child)
    } else if (/\.(apk|exe|deb|AppImage|zip)$/i.test(entry.name)) {
      artifacts.push({ path: child.slice(root.length + 1).replaceAll('\\', '/'), packageBytes: (await stat(child)).size })
    }
  }
}

await visit(root)
if (!artifacts.length) throw new Error(`No ${platform} artifacts found under ${root}`)
const report = { platform, folder: basename(root), artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)) }
await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))

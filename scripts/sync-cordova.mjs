import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'dist')
const target = join(root, 'www')

if (!target.startsWith(root + sep)) throw new Error('Cordova target escaped the project')
if (!(await stat(source)).isDirectory()) throw new Error('Build the web app first')
await rm(target, { recursive: true, force: true })
await mkdir(target)
await cp(source, target, { recursive: true })
const htmlPath = join(target, 'index.html')
const html = await readFile(htmlPath, 'utf8')
if (!html.includes('</head>')) throw new Error('Cordova HTML head missing')
await writeFile(htmlPath, html.replace('</head>', '    <script src="./cordova.js"></script>\n  </head>'))
console.log('Copied web build to Cordova www/')

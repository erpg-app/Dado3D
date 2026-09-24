import { defineConfig } from 'vitest/config'

// The pinned renderer contains optional dynamic imports for effects Dado3D
// never enables. Removing those imports excludes both chunks from packages.
const unusedEffects = [
  './chunks/particles-c74f72d0.js',
  './chunks/particlePresets-14780f98.js',
]

export default defineConfig({
  plugins: [{
    name: 'exclude-unused-dice-effects',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/@erpg/dice3dview/dist/dice3dview.es.js')) return null
      let code = source
      for (const effect of unusedEffects) {
        const call = `import("${effect}")`
        if (!code.includes(call)) throw new Error(`Pinned renderer changed: missing ${call}`)
        code = code.replaceAll(call, 'Promise.reject(new Error("Effect disabled in Dado3D"))')
      }
      return { code, map: null }
    },
  }],
  base: './',
  build: {
    target: 'es2022',
    cssMinify: true,
    reportCompressedSize: true,
    modulePreload: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

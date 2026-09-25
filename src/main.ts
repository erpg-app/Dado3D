import '@erpg/dice3dview/style.css'
import './styles.css'
import { createDiceEngine } from '@erpg/dicecore/core'
import type { DiceRollResult } from '@erpg/dicecore/core'
import type { DiceTimelineEvent } from '@erpg/dice3dview'
import { addDie, DICE_SIDES, parseSimplePool, removeDie } from './composer'
import type { StandardSides } from './composer'
import { applyMessages, languageCode, languageOptions, matchLanguage, message, setLanguage } from './i18n'
import { parseMacros } from './macros'
import type { Macro } from './macros'

type Viewer = import('@erpg/dice3dview').DiceResultViewer
type Theme = 'dark' | 'light'
type Color = 'violet' | 'blue' | 'mint' | 'amber'
type InputMode = 'pool' | 'notation'
type ViewMode = 'standard' | 'compact' | 'focus'

const colors: Record<Color, string> = {
  violet: '#a48bff', blue: '#67a7ff', mint: '#64d6ac', amber: '#f2b76b',
}
const supportedSides = new Set<number>(DICE_SIDES)
const timelineThreshold = 24
const themeAssets = ['default.json', 'normal.webp', 'diffuse-light.webp', 'diffuse-dark.webp', 'glyph-orientation.json', 'coin-1.svg', 'coin-2.svg']
const engine = createDiceEngine({
  limits: { maxInputLength: 300 },
})

const find = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing UI element ${selector}`)
  return element
}

const notation = find<HTMLInputElement>('#notation')
const appShell = find<HTMLElement>('#app')
const stage = find<HTMLElement>('#stage')
const rollButton = find<HTMLButtonElement>('#roll')
const clearButton = find<HTMLButtonElement>('#clear')
const compactEdit = find<HTMLButtonElement>('#compact-edit')
const viewControl = find<HTMLDetailsElement>('#view-control')
const viewTrigger = find<HTMLElement>('#view-open')
const errorNode = find<HTMLElement>('#input-error')
const stagePlaceholder = find<HTMLElement>('#stage-placeholder')
const stageHint = find<HTMLElement>('#stage-hint')
const resultPanel = find<HTMLDetailsElement>('#stage-result')
const resultMain = find<HTMLElement>('#result-main')
const resultDetail = find<HTMLElement>('#result-detail')
const resultNotation = find<HTMLElement>('#result-notation')
const resultNotice = find<HTMLElement>('#result-notice')
const stackSummary = find<HTMLElement>('#stack-summary')
const stackChips = find<HTMLElement>('#stack-chips')
const poolExpression = find<HTMLElement>('#pool-expression')
const poolPanel = find<HTMLElement>('#pool-panel')
const notationPanel = find<HTMLElement>('#notation-panel')
const poolModeButton = find<HTMLButtonElement>('[data-mode-choice="pool"]')
const settings = find<HTMLDialogElement>('#settings-dialog')
const languageSelect = find<HTMLSelectElement>('#language')
const macroList = find<HTMLElement>('#macro-list')
const macroDialog = find<HTMLDialogElement>('#macro-dialog')
const macroForm = find<HTMLFormElement>('#macro-form')
const macroDialogTitle = find<HTMLElement>('#macro-dialog-title')
const macroName = find<HTMLInputElement>('#macro-name')
const macroNotation = find<HTMLInputElement>('#macro-notation')
const macroError = find<HTMLElement>('#macro-error')
const macroDelete = find<HTMLButtonElement>('#macro-delete')

let viewer: Viewer | null = null
let viewerReady: Promise<Viewer> | null = null
let viewerAbort: AbortController | null = null
let viewerGeneration = 0
let activeRoll = 0
let theme: Theme = readStored('dado3d.theme') === 'light' ? 'light' : 'dark'
let color: Color = isColor(readStored('dado3d.color')) ? readStored('dado3d.color') as Color : 'violet'
let inputMode: InputMode = readStored('dado3d.mode') === 'notation' ? 'notation' : 'pool'
let viewMode: ViewMode = readStored('dado3d.viewMode') === 'compact' ? 'compact' : 'standard'
let previousViewMode: 'standard' | 'compact' = viewMode
let macros = parseMacros(readStored('dado3d.macros.v1'))
const storedMacroTab = Number(readStored('dado3d.macroTab'))
let activeMacroTab = Number.isInteger(storedMacroTab) && storedMacroTab >= 0 && storedMacroTab <= 2 ? storedMacroTab : 0
let editingMacroId: string | null = null
let macroDeleteArmed = false
let lastRollExpression: string | null = null

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function store(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

function isColor(value: string | null): value is Color {
  return value !== null && value in colors
}

function showError(text: string): void {
  errorNode.textContent = text
  errorNode.hidden = !text
}

function setActivePane(next: 'dice' | 'macros'): void {
  appShell.dataset.pane = next
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pane-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.paneChoice === next))
  }
}

function renderMacros(): void {
  macroList.replaceChildren()
  const visible = macros.filter(macro => macro.tab === activeMacroTab)
  macroList.setAttribute('aria-labelledby', `macro-tab-${activeMacroTab}`)
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-macro-tab]')) {
    const selected = Number(tab.dataset.macroTab) === activeMacroTab
    tab.setAttribute('aria-selected', String(selected))
    tab.setAttribute('aria-label', `${message('macros')} ${Number(tab.dataset.macroTab) + 1}`)
  }
  for (const macro of visible) {
    const row = document.createElement('div')
    row.className = 'macro-row'
    const run = document.createElement('button')
    run.type = 'button'
    run.className = 'macro-run'
    run.setAttribute('aria-label', `${message('roll')}: ${macro.name}, ${macro.notation}`)
    const name = document.createElement('strong')
    name.textContent = macro.name
    const formula = document.createElement('small')
    formula.dir = 'ltr'
    formula.textContent = macro.notation
    run.append(name, formula)
    run.addEventListener('click', () => void roll(macro.notation))
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'macro-edit'
    edit.textContent = '⋯'
    edit.setAttribute('aria-label', `${message('editMacro')}: ${macro.name}`)
    edit.addEventListener('click', () => openMacroEditor(macro))
    row.append(run, edit)
    macroList.append(row)
  }
}

function openMacroEditor(macro?: Macro): void {
  editingMacroId = macro?.id ?? null
  macroDeleteArmed = false
  macroDialogTitle.textContent = message(macro ? 'editMacro' : 'newMacro')
  macroName.value = macro?.name ?? ''
  macroNotation.value = macro?.notation ?? notation.value.trim()
  macroDelete.hidden = !macro
  macroDelete.textContent = message('deleteMacro')
  macroError.hidden = true
  macroError.textContent = ''
  macroDialog.showModal()
  macroName.focus()
}

function persistMacros(next: Macro[]): boolean {
  if (!store('dado3d.macros.v1', JSON.stringify(next))) {
    macroError.textContent = message('saveError')
    macroError.hidden = false
    return false
  }
  macros = next
  renderMacros()
  macroDialog.close()
  return true
}

function setInputMode(next: InputMode, persist = true): void {
  inputMode = next
  poolPanel.hidden = next !== 'pool'
  notationPanel.hidden = next !== 'notation'
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.modeChoice === next))
  }
  stageHint.textContent = message(next === 'pool' ? 'tapDice' : 'noDice')
  if (persist) store('dado3d.mode', next)
}

function setViewMode(next: ViewMode, persist = true): void {
  if (next === 'focus' && viewMode !== 'focus') previousViewMode = viewMode
  viewMode = next
  appShell.dataset.view = next
  viewControl.open = false
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.viewChoice === next))
  }
  resultPanel.open = false
  stage.title = next === 'focus' ? message('roll') : ''
  if (next === 'focus') {
    stage.tabIndex = 0
    stage.focus({ preventScroll: true })
  } else {
    stage.removeAttribute('tabindex')
    if (persist) store('dado3d.viewMode', next)
  }
}

function revealTextResult(notice = ''): void {
  stagePlaceholder.hidden = true
  resultNotice.textContent = notice
  resultNotice.hidden = !notice
  resultPanel.open = true
}

function applyTheme(): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('--accent', colors[color])
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101216' : '#f5f5f2')
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-color]')) {
    button.setAttribute('aria-pressed', String(button.dataset.color === color))
  }
  void viewer?.updateOptions({ themeColor: colors[color] }).catch(() => {})
}

function applyLanguage(): void {
  applyMessages()
  find<HTMLButtonElement>('#settings-open').setAttribute('aria-label', message('settings'))
  viewTrigger.title = message('view')
  compactEdit.title = message('edit')
  find<HTMLElement>('#dice-palette').setAttribute('aria-label', message('addDie'))
  for (const button of document.querySelectorAll<HTMLButtonElement>('.die-button')) {
    button.setAttribute('aria-label', `${message('addDie')} d${button.dataset.die}`)
  }
  for (const [index, button] of [...document.querySelectorAll<HTMLButtonElement>('.color-option')].entries()) {
    button.setAttribute('aria-label', `${message('diceColor')} ${index + 1}`)
  }
  setInputMode(inputMode, false)
  setViewMode(viewMode, false)
  renderStack()
  renderMacros()
  if (macroDialog.open) macroDialogTitle.textContent = message(editingMacroId ? 'editMacro' : 'newMacro')
}

function renderStack(): void {
  const expression = notation.value.trim()
  rollButton.disabled = !expression
  const simple = parseSimplePool(expression)
  stackChips.replaceChildren()
  const count = simple ? [...simple.dice.values()].reduce((sum, item) => sum + item, 0) : 0
  stackSummary.textContent = String(count)
  stackSummary.hidden = !count
  poolModeButton.setAttribute('aria-label', count ? `${message('pool')}: ${count} ${message('countDice')}` : message('pool'))
  poolExpression.textContent = expression
  poolExpression.title = expression
  poolExpression.hidden = !!simple || !expression
  for (const button of document.querySelectorAll<HTMLButtonElement>('.die-button')) {
    const sides = Number(button.dataset.die) as StandardSides
    const current = simple?.dice.get(sides) ?? 0
    button.dataset.active = String(current > 0)
    const badge = button.querySelector<HTMLElement>('.die-count')
    if (badge) { badge.textContent = String(current); badge.hidden = !current }
  }
  if (!simple) return
  for (const [sides, amount] of simple.dice) {
    if (!amount) continue
    const chip = document.createElement('span')
    chip.className = 'stack-chip'
    const label = document.createElement('span')
    label.textContent = `${amount}d${sides}`
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = '−'
    remove.setAttribute('aria-label', `${message('removeDie')} d${sides}`)
    remove.addEventListener('click', () => {
      notation.value = removeDie(notation.value, sides)
      store('dado3d.expression', notation.value)
      showError('')
      renderStack()
    })
    chip.append(label, remove)
    stackChips.append(chip)
  }
}

async function prewarmViewer(): Promise<Viewer> {
  if (viewerReady) return viewerReady
  const generation = viewerGeneration
  const controller = new AbortController()
  viewerAbort = controller
  const pending = (async () => {
    const { DiceResultViewer } = await import('@erpg/dice3dview')
    const themePath = new URL('assets/dice-box/themes/default/', document.baseURI)
    const instance = new DiceResultViewer({
      container: '#dice-stage',
      origin: '',
      assetPath: new URL('assets/dice-box/', document.baseURI).href,
      theme: 'default',
      themeColor: colors[color],
      particles: null,
      glow: null,
      // The viewer requires an integer; do not add a separate 3D dice cap.
      maxDice: Number.MAX_SAFE_INTEGER,
    })
    try {
      // Populate the local WebView cache without decoding textures or starting
      // a render loop. The renderer loads these assets on the first roll.
      await Promise.all([
        instance.init(),
        Promise.all(themeAssets.map(async name => {
          const response = await fetch(new URL(name, themePath), { signal: controller.signal })
          if (!response.ok) throw new Error(`Missing 3D asset: ${name}`)
          await response.arrayBuffer()
        })),
      ])
      if (generation !== viewerGeneration || document.hidden) {
        throw new Error('3D preparation cancelled')
      }
      viewer = instance
      if (viewerAbort === controller) viewerAbort = null
      performance.mark('dado3d:viewer-ready')
      return instance
    } catch (error) {
      if (viewerAbort === controller) viewerAbort = null
      instance.dispose()
      throw error
    }
  })
  const promise = pending()
  viewerReady = promise
  void promise.catch(() => {
    if (viewerReady === promise) viewerReady = null
    if (viewerAbort === controller) viewerAbort = null
  })
  return promise
}

function disposeViewer(): void {
  activeRoll++
  viewerGeneration++
  viewerAbort?.abort()
  viewerAbort = null
  viewer?.dispose()
  viewer = null
  viewerReady = null
  stagePlaceholder.hidden = false
}

function renderResult(result: DiceRollResult): void {
  const number = new Intl.NumberFormat(languageCode())
  resultPanel.hidden = false
  resultPanel.open = false
  resultNotice.hidden = true
  resultNotice.textContent = ''
  resultNotation.textContent = result.notation
  resultMain.textContent = result.rolls.length > 1
    ? result.rolls.map(item => number.format(item.total)).join(' · ')
    : number.format(result.total)
  const pool = result.pool
  const suffix = pool
    ? `\n${message('successes')}: ${number.format(pool.successes)} · ${message('failures')}: ${number.format(pool.failures)} · ${message('net')}: ${number.format(pool.netSuccesses)}`
    : ''
  resultDetail.textContent = result.output + suffix
}

async function roll(override?: string): Promise<void> {
  const expression = (override ?? notation.value).trim()
  if (!expression) {
    if (viewMode === 'focus') setViewMode(previousViewMode)
    showError(message('noDice'))
    if (inputMode === 'notation') notation.focus()
    return
  }
  const inspection = engine.inspect(expression)
  if (!inspection.isValid) {
    showError(message('invalid'))
    if (viewMode !== 'standard') setViewMode('standard')
    setInputMode('notation')
    notation.focus()
    return
  }
  showError('')
  const current = ++activeRoll
  performance.mark('dado3d:roll-start')
  let result: DiceRollResult
  try { result = engine.roll(inspection.plan) }
  catch { showError(message('invalid')); return }
  if (current !== activeRoll) return
  renderResult(result)
  lastRollExpression = expression
  setViewMode('focus')
  if (override === undefined) store('dado3d.expression', expression)
  performance.mark('dado3d:result-ready')
  performance.measure('dado3d:calculate', 'dado3d:roll-start', 'dado3d:result-ready')

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    viewer?.clear()
    revealTextResult()
    return
  }
  if (!result.dice.length || result.dice.some(die => typeof die.sides !== 'number' || !supportedSides.has(die.sides))) {
    viewer?.clear()
    revealTextResult(message('no3d'))
    return
  }
  stagePlaceholder.hidden = true
  try {
    const prepared = viewerReady ? await viewerReady : await prewarmViewer()
    if (current !== activeRoll) return
    const presentation = { id: `roll-${current}`, seed: `${Date.now()}-${Math.random()}` }
    if (result.dice.length > timelineThreshold) {
      // Present one physical throw. Replaying each journal event in a large pool
      // can take minutes, while the resolved faces are already known.
      await prepared.display({
        ...presentation,
        dice: result.dice.map(die => ({
          id: die.id,
          sides: die.sides as StandardSides,
          value: die.value,
          discarded: !die.included,
          themeColor: colors[color],
        })),
      })
    } else {
      const ids = new Set(result.dice.map(die => die.id))
      await prepared.displayTimeline({
        ...presentation,
        dice: result.dice.map(die => ({ id: die.id, sides: die.sides as StandardSides, themeColor: colors[color] })),
        // Dicecore's die journal is structurally compatible with the viewer's timeline.
        events: result.events.filter(event => event.subject === 'die' && ids.has(event.dieId)) as unknown as DiceTimelineEvent[],
      })
    }
    if (current !== activeRoll) return
    performance.mark('dado3d:roll-complete')
    performance.measure('dado3d:first-roll', 'dado3d:roll-start', 'dado3d:roll-complete')
  } catch {
    if (current !== activeRoll) return
    revealTextResult(message('graphicsError'))
  }
}

notation.value = readStored('dado3d.expression')?.slice(0, 300) ?? ''
applyTheme()
setInputMode(inputMode, false)
setViewMode(viewMode, false)
renderStack()
setActivePane('dice')
renderMacros()

notation.addEventListener('input', () => {
  store('dado3d.expression', notation.value)
  showError('')
  renderStack()
})
notation.addEventListener('keydown', event => { if (event.key === 'Enter') void roll() })
rollButton.addEventListener('click', () => void roll())
clearButton.addEventListener('click', () => {
  notation.value = ''
  store('dado3d.expression', '')
  showError('')
  renderStack()
  notation.focus()
})
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode-choice]')) {
  button.addEventListener('click', () => {
    setInputMode(button.dataset.modeChoice as InputMode)
    if (inputMode === 'notation') notation.focus()
  })
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view-choice]')) {
  button.addEventListener('click', () => setViewMode(button.dataset.viewChoice as ViewMode))
}
compactEdit.addEventListener('click', () => {
  setViewMode('standard')
  if (inputMode === 'notation') notation.focus()
})
stage.addEventListener('click', event => {
  if (viewMode !== 'focus') return
  if ((event.target as Element).closest('.view-control, .stage-result')) return
  if (viewControl.open) { viewControl.open = false; return }
  void roll(lastRollExpression ?? undefined)
})
document.addEventListener('keydown', event => {
  if (viewMode !== 'focus') return
  if (event.key === 'Escape') {
    if (resultPanel.open) resultPanel.open = false
    else if (viewControl.open) viewControl.open = false
    else setViewMode(previousViewMode)
    return
  }
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (event.target instanceof Element && event.target.closest('button, summary, input, select, textarea')) return
  event.preventDefault()
  void roll(lastRollExpression ?? undefined)
})
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-pane-choice]')) {
  button.addEventListener('click', () => setActivePane(button.dataset.paneChoice as 'dice' | 'macros'))
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-macro-tab]')) {
  button.addEventListener('click', () => {
    activeMacroTab = Number(button.dataset.macroTab)
    store('dado3d.macroTab', String(activeMacroTab))
    renderMacros()
  })
  button.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const offset = event.key === 'ArrowRight' ? 1 : 2
    const next = (activeMacroTab + offset) % 3
    find<HTMLButtonElement>(`[data-macro-tab="${next}"]`).click()
    find<HTMLButtonElement>(`[data-macro-tab="${next}"]`).focus()
  })
}
find<HTMLButtonElement>('#macro-add').addEventListener('click', () => openMacroEditor())
find<HTMLButtonElement>('#macro-close').addEventListener('click', () => macroDialog.close())
macroForm.addEventListener('submit', event => {
  event.preventDefault()
  const name = macroName.value.trim()
  const expression = macroNotation.value.trim()
  if (!name || !engine.inspect(expression).isValid) {
    macroError.textContent = message('invalid')
    macroError.hidden = false
    macroNotation.focus()
    return
  }
  const entry: Macro = { id: editingMacroId ?? crypto.randomUUID(), tab: activeMacroTab, name, notation: expression }
  const next = editingMacroId ? macros.map(macro => macro.id === editingMacroId ? entry : macro) : [...macros, entry]
  persistMacros(next)
})
macroDelete.addEventListener('click', () => {
  const item = macros.find(macro => macro.id === editingMacroId)
  if (!item) return
  if (!macroDeleteArmed) {
    macroDeleteArmed = true
    macroDelete.textContent = `${message('deleteMacro')} “${item.name}”?`
    return
  }
  persistMacros(macros.filter(macro => macro.id !== editingMacroId))
})
for (const button of document.querySelectorAll<HTMLButtonElement>('.die-button')) {
  button.addEventListener('click', () => {
    const sides = Number(button.dataset.die) as StandardSides
    const next = addDie(notation.value, sides)
    if (!next.valid) { showError(message('invalid')); return }
    notation.value = next.expression
    store('dado3d.expression', next.expression)
    showError('')
    renderStack()
  })
}

find<HTMLButtonElement>('#settings-open').addEventListener('click', () => settings.showModal())
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')) {
  button.addEventListener('click', () => {
    theme = button.dataset.themeChoice as Theme
    store('dado3d.theme', theme)
    applyTheme()
    applyLanguage()
  })
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-color]')) {
  button.addEventListener('click', () => {
    const next = button.dataset.color ?? null
    if (!isColor(next)) return
    color = next
    store('dado3d.color', color)
    applyTheme()
  })
}

for (const option of languageOptions()) {
  const element = document.createElement('option')
  element.value = option.code
  element.textContent = option.name
  languageSelect.append(element)
}
const preferredLanguage = readStored('dado3d.language') ?? matchLanguage(navigator.languages)
void setLanguage(preferredLanguage).then(code => {
  languageSelect.value = code
  applyLanguage()
})
languageSelect.addEventListener('change', () => {
  void setLanguage(languageSelect.value).then(code => {
    store('dado3d.language', code)
    applyLanguage()
  })
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) disposeViewer()
  else void prewarmViewer().catch(() => {})
})
document.addEventListener('pause', disposeViewer)
document.addEventListener('resume', () => { void prewarmViewer().catch(() => {}) })
window.addEventListener('pagehide', disposeViewer)
performance.mark('dado3d:interactive')
requestAnimationFrame(() => setTimeout(() => { void prewarmViewer().catch(() => {}) }, 0))

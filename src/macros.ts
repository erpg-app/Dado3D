export type Macro = { id: string; tab: number; name: string; notation: string }

export function parseMacros(raw: string | null): Macro[] {
  if (!raw) return []
  try {
    const items: unknown = JSON.parse(raw)
    if (!Array.isArray(items)) return []
    const ids = new Set<string>()
    return items.filter((item): item is Macro => {
      if (!item || typeof item !== 'object') return false
      const macro = item as Partial<Macro>
      if (typeof macro.id !== 'string' || !macro.id || ids.has(macro.id) ||
          !Number.isInteger(macro.tab) || macro.tab! < 0 || macro.tab! > 2 ||
          typeof macro.name !== 'string' || !macro.name.trim() || macro.name.length > 40 ||
          typeof macro.notation !== 'string' || !macro.notation.trim() || macro.notation.length > 300) return false
      ids.add(macro.id)
      return true
    }).slice(0, 500)
  } catch { return [] }
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Rule {
  readonly pattern: RegExp
  explain(match: RegExpMatchArray): string
}

const lastPart = (name: string): string => name.split('.').pop() ?? name

/** JavaScript's own messages (Chrome and Firefox wordings) in plain words. */
const RULES: readonly Rule[] = [
  { pattern: /^(\S+) is not defined$/, explain: (m) => `there's nothing called "${m[1]}" — check the spelling.` },
  { pattern: /^(\S+) is not a function/, explain: (m) => `"${lastPart(m[1] ?? '')}" isn't a command — check the spelling, or look in ❓ Commands.` },
  { pattern: /^Cannot read properties of (?:undefined|null) \(reading '(.+?)'\)$/, explain: (m) => `something is missing before ".${m[1]}" — check that it has a value.` },
  { pattern: /^can't access property "(.+?)", .+ is (?:undefined|null)$/, explain: (m) => `something is missing before ".${m[1]}" — check that it has a value.` },
  { pattern: /^(?:Maximum call stack size exceeded|too much recursion)$/, explain: () => 'a function keeps calling itself and never stops.' },
]

function translate(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  for (const rule of RULES) {
    const match = error.message.match(rule.pattern)
    if (match) return rule.explain(match)
  }
  return error.message
}

/** The line in Kade's code (loaded from `source`) where the error happened, read from the stack. */
export function lineOf(error: unknown, source: string): number | null {
  if (!(error instanceof Error) || !error.stack) return null
  const match = error.stack.match(new RegExp(`${escape(source)}:(\\d+):\\d+`))
  return match ? Number(match[1]) : null
}

/** A kid-friendly message, starting with "Line N: " when the line is known. */
export function friendlyError(error: unknown, source: string | null): string {
  const message = translate(error)
  const line = source ? lineOf(error, source) : null
  return line === null ? message : `Line ${line}: ${message}`
}

/** The line a problem message points at, for jumping to it in the code box. */
export function problemLine(message: string): number | null {
  const match = message.match(/Line (\d+):/)
  return match ? Number(match[1]) : null
}

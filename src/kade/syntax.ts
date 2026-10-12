import { parser } from '@lezer/javascript'

export const SYNTAX_PROBLEM = (line: number): string =>
  `Line ${line}: something here doesn't look right — check for a missing bracket, comma or quote.`

const lineAt = (code: string, position: number): number => code.slice(0, position).split('\n').length

/** Where the first syntax error starts, or null when the code parses. */
function firstErrorPosition(code: string): number | null {
  let found: number | null = null
  parser.parse(code).iterate({
    enter: (node) => {
      if (found !== null) return false
      if (node.type.isError) found = node.from
      return undefined
    },
  })
  return found
}

/** The first syntax mistake in Kade's code, found without running it. Null when the code parses. */
export function findSyntaxProblem(code: string): string | null {
  const position = firstErrorPosition(code)
  return position === null ? null : SYNTAX_PROBLEM(lineAt(code, position))
}

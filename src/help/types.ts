export interface HelpEntry {
  /** One short sentence for the hover bubble. */
  readonly tip: string
  /** A few sentences for the ❓ help card. */
  readonly card: string
  /** Something to try, shown on the help card. */
  readonly tryIt?: string
  /** A tutorial that teaches this (opens from "Learn more →"). */
  readonly tutorial?: string
}

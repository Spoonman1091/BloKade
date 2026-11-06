/** A problem the user can fix, carrying the plain-word message to show them. */
export class SplitProblem extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SplitProblem'
  }
}

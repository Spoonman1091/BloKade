import { Component, type ErrorInfo, type ReactNode } from 'react'

export const CRASH_MESSAGE = 'Something broke. Reload the page — your design is saved.'

interface ErrorBoundaryProps {
  children: ReactNode
  onReload?: () => void
}

/** Catches render crashes so Kade sees a friendly message and a Reload button instead of a blank page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { crashed: boolean }> {
  override state = { crashed: false }

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('BloKade crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.crashed) return this.props.children
    const reload = this.props.onReload ?? (() => window.location.reload())
    return (
      <div className="splash" role="alert">
        <p>{CRASH_MESSAGE}</p>
        <button type="button" className="tool-button" onClick={reload}>Reload</button>
      </div>
    )
  }
}

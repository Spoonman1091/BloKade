import { Fragment } from 'react'

/** Shows lesson and help text, where **text** is bold. That is the only markup. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/)
  return <>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>
}

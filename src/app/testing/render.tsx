import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { StoreProvider } from '../../store/context'
import type { BloKadeStore } from '../../store/store'

export function renderWithStore(ui: ReactElement, store: BloKadeStore) {
  return render(<StoreProvider store={store}>{ui}</StoreProvider>)
}

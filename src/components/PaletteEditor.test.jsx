import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ADMIN_CONFIG } from '../data/defaults'
import { PaletteEditor } from './PaletteEditor'

describe('PaletteEditor', () => {
  it('commits curated presets immediately', async () => {
    const user = userEvent.setup()
    const onCommitHex = vi.fn()

    render(
      <PaletteEditor
        palette={DEFAULT_ADMIN_CONFIG.palette}
        onCommitHex={onCommitHex}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText('Brand accent palette preset'),
      ['#144E86'],
    )

    expect(onCommitHex).toHaveBeenCalledWith('brand', '#144E86')
  })

  it('restores the last valid value when a custom hex is invalid', async () => {
    const user = userEvent.setup()
    const onCommitHex = vi.fn()

    render(
      <PaletteEditor
        palette={DEFAULT_ADMIN_CONFIG.palette}
        onCommitHex={onCommitHex}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText('Brand accent palette preset'),
      ['Custom HEX'],
    )

    const input = screen.getByLabelText('Brand accent HEX')
    await user.clear(input)
    await user.type(input, 'invalid')
    await user.tab()

    expect(input).toHaveValue(DEFAULT_ADMIN_CONFIG.palette.brand.hex)
    expect(onCommitHex).not.toHaveBeenCalled()
  })
})

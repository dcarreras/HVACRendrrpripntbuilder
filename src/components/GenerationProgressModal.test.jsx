import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GenerationProgressModal } from './GenerationProgressModal'

describe('GenerationProgressModal', () => {
  it('renders the progress dialog while the render is running', () => {
    render(
      <GenerationProgressModal
        estimatedTimeLabel="20-45 seconds"
        projectName="Valtria test project"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Please wait' }),
    ).toBeVisible()
    expect(
      screen.getByText('Keep this window open while generation is in progress.'),
    ).toBeVisible()
    expect(screen.getByText('Estimated time')).toBeVisible()
  })
})

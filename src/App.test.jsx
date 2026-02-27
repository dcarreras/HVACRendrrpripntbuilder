import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

function createStorage() {
  const data = new Map()

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
    clear() {
      data.clear()
    },
  }
}

describe('App', () => {
  it('shows the auth gate first and opens the user workspace without admin controls', async () => {
    const user = userEvent.setup()
    const generateImage = vi.fn().mockResolvedValue({
      imageDataUrl: 'data:image/png;base64,AAA',
    })

    render(<App storage={createStorage()} generateImage={generateImage} />)

    expect(screen.getByRole('heading', { name: 'Valtria Render Studio' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))

    expect(screen.getByRole('heading', { name: 'Project basics' })).toBeVisible()
    expect(screen.queryByText('OpenAI generation settings')).not.toBeInTheDocument()
    expect(screen.queryByText('Palette manager')).not.toBeInTheDocument()
  })

  it('shows the admin console and supports sign out back to the auth gate', async () => {
    const user = userEvent.setup()
    render(<App storage={createStorage()} generateImage={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Admin access' }))
    await user.click(screen.getByRole('button', { name: 'Enter as admin' }))

    expect(
      screen.getByRole('heading', { name: 'Technical generation settings' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('button', { name: 'Admin access' })).toBeVisible()
  })

  it('persists admin settings locally and uses them in the user generation request', async () => {
    const user = userEvent.setup()
    const storage = createStorage()

    const initialRender = render(<App storage={storage} generateImage={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Admin access' }))
    await user.click(screen.getByRole('button', { name: 'Enter as admin' }))
    await user.selectOptions(screen.getByLabelText('Image model'), ['gpt-image-1'])
    await user.click(screen.getByRole('button', { name: 'Save configuration' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    initialRender.unmount()

    const generateImage = vi.fn().mockResolvedValue({
      imageDataUrl: 'data:image/png;base64,BBB',
    })

    render(<App storage={storage} generateImage={generateImage} />)

    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))
    await user.click(screen.getByRole('button', { name: 'Generate image' }))

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledTimes(1)
    })

    expect(generateImage.mock.calls[0][0].generation.model).toBe('gpt-image-1')
  })

  it('uploads a reference image, carries the extra detail into the prompt, and renders the output image', async () => {
    const user = userEvent.setup()
    const generateImage = vi.fn().mockResolvedValue({
      imageDataUrl: 'data:image/png;base64,CCC',
    })
    const readReferenceFile = vi.fn().mockResolvedValue({
      dataUrl: 'data:image/png;base64,AAA',
      mimeType: 'image/png',
      name: 'dalux.png',
    })

    render(
      <App
        storage={createStorage()}
        generateImage={generateImage}
        readReferenceFile={readReferenceFile}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))
    await user.selectOptions(screen.getByLabelText('Aspect ratio'), ['1:1'])
    await user.type(
      screen.getByLabelText('Do you want to add any extra detail?'),
      'Keep the coves continuous.',
    )

    const fileInput = screen.getByLabelText('Reference image file input')
    const file = new File(['reference'], 'dalux.png', { type: 'image/png' })

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    })

    await waitFor(() => {
      expect(screen.getByAltText('Reference preview')).toBeVisible()
    })

    await user.click(screen.getByRole('button', { name: 'Generate image' }))

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledTimes(1)
    })

    expect(generateImage.mock.calls[0][0].generation.size).toBe('1024x1024')
    expect(generateImage.mock.calls[0][0].referenceImage).toEqual({
      dataUrl: 'data:image/png;base64,AAA',
      mimeType: 'image/png',
    })
    expect(generateImage.mock.calls[0][0].prompt).toContain(
      'Keep the coves continuous.',
    )
    expect(screen.getByAltText('Generated HVAC render')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Download image' })).toHaveAttribute(
      'href',
      'data:image/png;base64,CCC',
    )
  })

  it('accepts pasted images and allows removing the current reference', async () => {
    const user = userEvent.setup()
    const readReferenceFile = vi.fn().mockResolvedValue({
      dataUrl: 'data:image/png;base64,DDD',
      mimeType: 'image/png',
      name: 'clipboard.png',
    })
    const generateImage = vi.fn().mockResolvedValue({
      imageDataUrl: 'data:image/png;base64,EEE',
    })
    const file = new File(['clipboard'], 'clipboard.png', { type: 'image/png' })

    render(
      <App
        storage={createStorage()}
        generateImage={generateImage}
        readReferenceFile={readReferenceFile}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))

    fireEvent.paste(screen.getByLabelText('Reference image paste zone'), {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(screen.getByAltText('Reference preview')).toBeVisible()
    })

    await user.click(screen.getByRole('button', { name: 'Generate image' }))

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledTimes(1)
    })

    expect(generateImage.mock.calls[0][0].referenceImage.mimeType).toBe('image/png')

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.queryByAltText('Reference preview')).not.toBeInTheDocument()
  })
})

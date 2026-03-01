import { useId, useRef, useState } from 'react'
import { ACCEPTED_IMAGE_TYPES, readFileAsReferenceImage } from '../lib/referenceImage'

export function ReferenceImageInput({
  referenceImage,
  onChange,
  readReferenceFile = readFileAsReferenceImage,
}) {
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputId = useId()
  const fileInputRef = useRef(null)

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const setImageFromFile = async (file) => {
    if (!file) {
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMessage('Use PNG, JPEG, or WEBP images only.')
      return
    }

    try {
      const nextImage = await readReferenceFile(file)
      onChange(nextImage)
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'The reference image could not be loaded.')
    }
  }

  const handlePaste = async (event) => {
    const item = [...(event.clipboardData?.items || [])].find((entry) =>
      ACCEPTED_IMAGE_TYPES.includes(entry.type),
    )

    if (!item) {
      setMessage('Paste an image copied from Dalux BIM or upload a supported file.')
      return
    }

    event.preventDefault()
    await setImageFromFile(item.getAsFile())
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragging(false)
    await setImageFromFile(event.dataTransfer?.files?.[0] || null)
  }

  return (
    <div className="reference-intake">
      <div
        className={[
          'reference-dropzone',
          referenceImage ? 'reference-dropzone--filled' : '',
          isDragging ? 'reference-dropzone--dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openFilePicker()
          }
        }}
        onPaste={handlePaste}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDragging(false)
          }
        }}
        onDrop={handleDrop}
        aria-label="Reference image paste zone"
      >
        <div className="reference-dropzone__copy">
          <p className="t-section">Upload your reference image</p>
          <p className="t-small">
            Tap anywhere here or drag an image file.
          </p>
        </div>

        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="reference-dropzone__input"
          aria-label="Reference image file input"
          onChange={async (event) => {
            await setImageFromFile(event.target.files?.[0] || null)
            event.target.value = ''
          }}
        />

        {referenceImage ? (
          <div className="reference-preview">
            <img
              src={referenceImage.dataUrl}
              alt="Reference preview"
              className="reference-preview__image"
            />
            <div className="reference-preview__meta">
              <span className="badge badge--success">Ready to use</span>
              <p className="t-small">
                <strong>{referenceImage.name}</strong>
              </p>
              <p className="t-small">{referenceImage.mimeType}</p>
              <div className="reference-preview__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    openFilePicker()
                  }}
                >
                  Change
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange(null)
                    setMessage('')
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="reference-dropzone__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={(event) => {
                event.stopPropagation()
                openFilePicker()
              }}
            >
              Choose image
            </button>
          </div>
        )}
      </div>

      {message ? <p className="field-hint t-small">{message}</p> : null}
    </div>
  )
}

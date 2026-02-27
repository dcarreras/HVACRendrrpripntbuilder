export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * @param {File} file
 * @returns {Promise<import('../types/prompt').ReferenceImage>}
 */
export function readFileAsReferenceImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve({
        dataUrl: String(reader.result),
        mimeType: file.type,
        name: file.name || 'reference-image',
      })
    }

    reader.onerror = () => {
      reject(new Error('The reference image could not be read.'))
    }

    reader.readAsDataURL(file)
  })
}

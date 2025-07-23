import { generateThumbnail, ThumbnailResult, ThumbnailOptions } from './thumbnailGenerator'

/**
 * Attempt to extract thumbnail from RAW files
 * Many RAW files contain embedded JPEG previews that we can extract
 */
export async function extractRawThumbnail(
  file: File,
  options: Partial<ThumbnailOptions> = {}
): Promise<ThumbnailResult | null> {
  try {
    // First, try to find embedded JPEG preview in RAW file
    const embeddedJpeg = await extractEmbeddedJpeg(file)
    
    if (embeddedJpeg) {
      // Generate thumbnail from the extracted JPEG
      return await generateThumbnail(embeddedJpeg, options)
    }
    
    // If no embedded JPEG found, return null
    // We cannot generate thumbnails for RAW files without embedded previews
    return null
    
  } catch (error) {
    console.warn(`Failed to extract RAW thumbnail for ${file.name}:`, error)
    return null
  }
}

/**
 * Extract embedded JPEG preview from RAW file
 * Enhanced implementation that handles multiple RAW formats and preview sizes
 */
async function extractEmbeddedJpeg(file: File): Promise<File | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const fileInfo = getRawFileInfo(file)
    
    console.log(`Extracting thumbnail from ${fileInfo.format} file: ${file.name}`)
    
    // Try different extraction methods based on file format
    let extractedJpeg: Uint8Array | null = null
    
    if (fileInfo.format === 'DNG') {
      extractedJpeg = await extractDngThumbnail(uint8Array)
    } else if (fileInfo.format === 'CR2' || fileInfo.format === 'CR3') {
      extractedJpeg = await extractCanonThumbnail(uint8Array)
    } else if (fileInfo.format === 'NEF') {
      extractedJpeg = await extractNikonThumbnail(uint8Array)
    } else if (fileInfo.format === 'ARW') {
      extractedJpeg = await extractSonyThumbnail(uint8Array)
    } else {
      // Generic JPEG search for other formats
      extractedJpeg = await extractGenericJpegThumbnail(uint8Array)
    }
    
    if (extractedJpeg && extractedJpeg.length > 0) {
      // Create a new File object from the extracted JPEG data
      const jpegBlob = new Blob([extractedJpeg], { type: 'image/jpeg' })
      const jpegFile = new File([jpegBlob], `${file.name}_preview.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified
      })
      
      // Verify it's a valid JPEG by trying to load it
      if (await isValidImage(jpegFile)) {
        console.log(`Successfully extracted ${extractedJpeg.length} byte thumbnail from ${file.name}`)
        return jpegFile
      } else {
        console.warn(`Extracted data from ${file.name} is not a valid JPEG`)
      }
    }
    
    console.warn(`No embedded JPEG found in ${file.name}`)
    return null
  } catch (error) {
    console.warn('Error extracting embedded JPEG:', error)
    return null
  }
}

/**
 * Extract thumbnail from DNG files (Adobe Digital Negative)
 */
async function extractDngThumbnail(data: Uint8Array): Promise<Uint8Array | null> {
  // DNG files are TIFF-based and usually have multiple JPEG previews
  // Look for the largest preview (usually after IFD entries)
  
  // Check for TIFF header
  if (data.length < 8) return null
  
  const isLittleEndian = data[0] === 0x49 && data[1] === 0x49
  const isBigEndian = data[0] === 0x4D && data[1] === 0x4D
  
  if (!isLittleEndian && !isBigEndian) return null
  
  // Look for JPEG previews in the file
  return findBestJpegPreview(data)
}

/**
 * Extract thumbnail from Canon CR2/CR3 files
 */
async function extractCanonThumbnail(data: Uint8Array): Promise<Uint8Array | null> {
  // Canon files often have multiple previews
  // Try to find the largest one first
  return findBestJpegPreview(data)
}

/**
 * Extract thumbnail from Nikon NEF files
 */
async function extractNikonThumbnail(data: Uint8Array): Promise<Uint8Array | null> {
  // Nikon files typically have embedded JPEG previews
  return findBestJpegPreview(data)
}

/**
 * Extract thumbnail from Sony ARW files
 */
async function extractSonyThumbnail(data: Uint8Array): Promise<Uint8Array | null> {
  // Sony ARW files are TIFF-based with embedded previews
  return findBestJpegPreview(data)
}

/**
 * Generic JPEG extraction for unknown RAW formats
 */
async function extractGenericJpegThumbnail(data: Uint8Array): Promise<Uint8Array | null> {
  return findBestJpegPreview(data)
}

/**
 * Find the best (largest) JPEG preview in the RAW file
 */
function findBestJpegPreview(data: Uint8Array): Uint8Array | null {
  const jpegPreviews: Uint8Array[] = []
  let searchStart = 0
  
  // Find all JPEG segments in the file
  while (searchStart < data.length) {
    const jpegStart = findJpegMarker(data, [0xFF, 0xD8], searchStart)
    if (jpegStart < 0) break
    
    const jpegEnd = findJpegMarker(data, [0xFF, 0xD9], jpegStart + 2)
    if (jpegEnd >= 0 && jpegEnd > jpegStart) {
      const jpegData = data.slice(jpegStart, jpegEnd + 2)
      
      // Only consider JPEGs that are likely to be previews (> 1KB)
      if (jpegData.length > 1024) {
        jpegPreviews.push(jpegData)
      }
    }
    
    searchStart = jpegStart + 2
  }
  
  if (jpegPreviews.length === 0) return null
  
  // Return the largest preview (likely the best quality)
  return jpegPreviews.reduce((largest, current) => 
    current.length > largest.length ? current : largest
  )
}

/**
 * Find byte pattern in Uint8Array
 */
function findJpegMarker(
  data: Uint8Array, 
  marker: number[], 
  startOffset: number = 0
): number {
  for (let i = startOffset; i <= data.length - marker.length; i++) {
    let found = true
    for (let j = 0; j < marker.length; j++) {
      if (data[i + j] !== marker[j]) {
        found = false
        break
      }
    }
    if (found) {
      return i
    }
  }
  return -1
}

/**
 * Verify if a file is a valid image by attempting to load it
 */
function isValidImage(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(true)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve(false)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get RAW file type information
 */
export function getRawFileInfo(file: File): {
  isRaw: boolean
  format: string
  manufacturer?: string
} {
  const fileName = file.name.toLowerCase()
  const rawFormats: Record<string, { manufacturer: string; format: string }> = {
    '.cr2': { manufacturer: 'Canon', format: 'CR2' },
    '.cr3': { manufacturer: 'Canon', format: 'CR3' },
    '.nef': { manufacturer: 'Nikon', format: 'NEF' },
    '.arw': { manufacturer: 'Sony', format: 'ARW' },
    '.dng': { manufacturer: 'Adobe', format: 'DNG' },
    '.raf': { manufacturer: 'Fujifilm', format: 'RAF' },
    '.orf': { manufacturer: 'Olympus', format: 'ORF' },
    '.rw2': { manufacturer: 'Panasonic', format: 'RW2' },
    '.pef': { manufacturer: 'Pentax', format: 'PEF' },
    '.srw': { manufacturer: 'Samsung', format: 'SRW' },
    '.x3f': { manufacturer: 'Sigma', format: 'X3F' }
  }
  
  for (const [ext, info] of Object.entries(rawFormats)) {
    if (fileName.endsWith(ext)) {
      return {
        isRaw: true,
        format: info.format,
        manufacturer: info.manufacturer
      }
    }
  }
  
  return {
    isRaw: false,
    format: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN'
  }
}

/**
 * Check if RAW file likely contains embedded JPEG
 * Most modern RAW formats have embedded previews
 */
export function likelyHasEmbeddedJpeg(file: File): boolean {
  const { format } = getRawFileInfo(file)
  
  // Almost all modern RAW formats have embedded JPEG previews
  // We'll be more aggressive and try extraction on all known RAW formats
  const formatsWithPreviews = [
    'CR2', 'CR3',     // Canon
    'NEF',            // Nikon
    'ARW',            // Sony
    'DNG',            // Adobe
    'RAF',            // Fujifilm
    'ORF',            // Olympus
    'RW2',            // Panasonic
    'PEF',            // Pentax
    'SRW',            // Samsung
    'X3F'             // Sigma
  ]
  
  return formatsWithPreviews.includes(format)
}

/**
 * Create a placeholder thumbnail for RAW files without embedded previews
 */
export function createRawPlaceholder(
  file: File,
  options: Partial<ThumbnailOptions> = {}
): Promise<ThumbnailResult> {
  const { format, manufacturer } = getRawFileInfo(file)
  
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    const width = options.width || 300
    const height = options.height || 300
    
    canvas.width = width
    canvas.height = height
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#6B7280')
    gradient.addColorStop(1, '#4B5563')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw camera icon
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `${width * 0.3}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📷', width / 2, height / 2 - 20)
    
    // Draw format text
    ctx.font = `${width * 0.08}px Arial`
    ctx.fillText(format, width / 2, height / 2 + 30)
    
    if (manufacturer) {
      ctx.font = `${width * 0.06}px Arial`
      ctx.fillText(manufacturer, width / 2, height / 2 + 50)
    }
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({
          dataUrl,
          blob,
          width,
          height,
          originalWidth: width,
          originalHeight: height
        })
      }
    }, 'image/jpeg', 0.8)
  })
}
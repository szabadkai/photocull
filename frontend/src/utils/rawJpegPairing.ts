import { PhotoWithAnalysis } from '../../../shared/src/types'

export interface FilePair {
  baseId: string
  baseName: string
  jpegFile?: File
  rawFile?: File
  jpegIndex?: number
  rawIndex?: number
}

/**
 * Group RAW and JPEG files with the same base name
 */
export function groupRawJpegPairs(files: FileList): {
  pairs: FilePair[]
  singleFiles: { file: File; index: number }[]
} {
  const fileMap = new Map<string, FilePair>()
  const singleFiles: { file: File; index: number }[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    // Check if it's an image file
    if (!file.type.startsWith('image/') && 
        !/\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|cr2|nef|arw|dng|raf|orf|rw2|pef|heic|heif|avif)$/i.test(file.name)) {
      continue
    }

    // Get base name without extension
    const baseName = getBaseName(file.name)
    const isRaw = /\.(cr2|nef|arw|dng|raf|orf|rw2|pef)$/i.test(file.name)
    const isJpeg = /\.(jpg|jpeg)$/i.test(file.name)

    if (!fileMap.has(baseName)) {
      fileMap.set(baseName, {
        baseId: `pair_${baseName}`,
        baseName
      })
    }

    const pair = fileMap.get(baseName)!

    if (isRaw) {
      pair.rawFile = file
      pair.rawIndex = i
    } else if (isJpeg) {
      pair.jpegFile = file
      pair.jpegIndex = i
    } else {
      // Other image formats - treat as single files
      singleFiles.push({ file, index: i })
      fileMap.delete(baseName)
      continue
    }
  }

  // Separate pairs from single files
  const pairs: FilePair[] = []
  
  for (const pair of fileMap.values()) {
    if (pair.jpegFile && pair.rawFile) {
      // We have a RAW+JPEG pair
      pairs.push(pair)
    } else if (pair.jpegFile || pair.rawFile) {
      // Only one file, treat as single
      const file = pair.jpegFile || pair.rawFile!
      const index = pair.jpegIndex ?? pair.rawIndex!
      singleFiles.push({ file, index })
    }
  }

  return { pairs, singleFiles }
}

/**
 * Get base name without extension (handle multiple dots)
 */
function getBaseName(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) return filename
  return filename.substring(0, lastDotIndex)
}

/**
 * Create PhotoWithAnalysis objects from file pairs and single files
 */
export function createPhotosFromPairs(
  pairs: FilePair[],
  singleFiles: { file: File; index: number }[]
): PhotoWithAnalysis[] {
  const photos: PhotoWithAnalysis[] = []

  // Process pairs (RAW+JPEG)
  pairs.forEach((pair, pairIndex) => {
    const primaryFile = pair.jpegFile! // Use JPEG as primary for thumbnail
    const rawFile = pair.rawFile!
    
    const photo: PhotoWithAnalysis = {
      id: `pair_${pairIndex}`,
      path: primaryFile.webkitRelativePath || primaryFile.name,
      filename: `${pair.baseName} (RAW+JPEG)`,
      size: primaryFile.size + rawFile.size, // Combined size
      createdAt: new Date(Math.min(primaryFile.lastModified, rawFile.lastModified)).toISOString(),
      modifiedAt: new Date(Math.max(primaryFile.lastModified, rawFile.lastModified)).toISOString(),
      format: 'raw+jpeg',
      isRaw: false, // Treat as processed since we have JPEG
      hasRawPair: true,
      hasJpegPair: true,
      pairId: pair.baseId,
      analysis: {
        photoId: `pair_${pairIndex}`,
        hash: '',
        blurScore: Math.random() * 1000,
        isDuplicate: false,
        thumbnailPath: URL.createObjectURL(primaryFile) // Use JPEG for thumbnail
      }
    }
    
    photos.push(photo)
  })

  // Process single files
  singleFiles.forEach(({ file, index }) => {
    const isRaw = /\.(cr2|nef|arw|dng|raf|orf|rw2|pef)$/i.test(file.name)
    
    const photo: PhotoWithAnalysis = {
      id: `file_${index}`,
      path: file.webkitRelativePath || file.name,
      filename: file.name,
      size: file.size,
      createdAt: new Date(file.lastModified).toISOString(),
      modifiedAt: new Date(file.lastModified).toISOString(),
      format: file.name.split('.').pop()?.toLowerCase() || '',
      isRaw,
      hasRawPair: false,
      hasJpegPair: false,
      analysis: {
        photoId: `file_${index}`,
        hash: '',
        blurScore: Math.random() * 1000,
        isDuplicate: false,
        thumbnailPath: isRaw ? undefined : URL.createObjectURL(file) // No thumbnail for RAW
      }
    }
    
    photos.push(photo)
  })

  return photos
}

/**
 * Get files to analyze (skip RAW files that have JPEG pairs)
 */
export function getFilesToAnalyze(
  pairs: FilePair[],
  singleFiles: { file: File; index: number }[]
): { file: File; photoId: string }[] {
  const filesToAnalyze: { file: File; photoId: string }[] = []

  // For pairs, only analyze the JPEG file
  pairs.forEach((pair, pairIndex) => {
    if (pair.jpegFile) {
      filesToAnalyze.push({
        file: pair.jpegFile,
        photoId: `pair_${pairIndex}`
      })
    }
  })

  // For single files, analyze non-RAW files
  singleFiles.forEach(({ file, index }) => {
    const isRaw = /\.(cr2|nef|arw|dng|raf|orf|rw2|pef)$/i.test(file.name)
    if (!isRaw) {
      filesToAnalyze.push({
        file,
        photoId: `file_${index}`
      })
    }
  })

  return filesToAnalyze
}
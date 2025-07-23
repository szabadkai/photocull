// Perceptual hashing implementation for duplicate detection
// Based on the difference hash (dHash) algorithm

export interface ImageHash {
  hash: string
  width: number
  height: number
}

export interface DuplicateGroup {
  id: string
  photos: string[] // photo IDs
  similarity: number
}

/**
 * Calculate perceptual hash (dHash) for an image
 */
export async function calculateImageHash(file: File): Promise<ImageHash | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      resolve(null)
      return
    }

    img.onload = () => {
      try {
        // Resize to 9x8 for dHash (we need 9x8 to get 8x8 differences)
        const hashSize = 8
        canvas.width = hashSize + 1
        canvas.height = hashSize
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        
        // Convert to grayscale and calculate dHash
        const grayPixels: number[] = []
        for (let i = 0; i < pixels.length; i += 4) {
          // Convert RGB to grayscale using luminance formula
          const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
          grayPixels.push(gray)
        }
        
        // Calculate dHash - compare each pixel with the one to its right
        let hash = ''
        for (let row = 0; row < hashSize; row++) {
          for (let col = 0; col < hashSize; col++) {
            const pixelIndex = row * (hashSize + 1) + col
            const rightPixelIndex = pixelIndex + 1
            
            // Compare current pixel with pixel to the right
            if (grayPixels[pixelIndex] < grayPixels[rightPixelIndex]) {
              hash += '1'
            } else {
              hash += '0'
            }
          }
        }
        
        // Convert binary string to hex for more compact representation
        const hexHash = binaryToHex(hash)
        
        resolve({
          hash: hexHash,
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      } catch (error) {
        console.error('Error calculating hash:', error)
        resolve(null)
      }
      
      // Clean up
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      console.error('Error loading image for hashing')
      URL.revokeObjectURL(img.src)
      resolve(null)
    }
    
    // Load the image
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Convert binary string to hexadecimal
 */
function binaryToHex(binary: string): string {
  let hex = ''
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.substr(i, 4)
    const decimal = parseInt(chunk, 2)
    hex += decimal.toString(16)
  }
  return hex
}

/**
 * Convert hexadecimal back to binary for comparison
 */
function hexToBinary(hex: string): string {
  let binary = ''
  for (let i = 0; i < hex.length; i++) {
    const decimal = parseInt(hex[i], 16)
    binary += decimal.toString(2).padStart(4, '0')
  }
  return binary
}

/**
 * Calculate Hamming distance between two hashes
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity
  }
  
  const binary1 = hexToBinary(hash1)
  const binary2 = hexToBinary(hash2)
  
  let distance = 0
  for (let i = 0; i < binary1.length; i++) {
    if (binary1[i] !== binary2[i]) {
      distance++
    }
  }
  
  return distance
}

/**
 * Calculate similarity percentage between two hashes
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const maxDistance = 64 // 8x8 bits
  const distance = calculateHammingDistance(hash1, hash2)
  
  if (distance === Infinity) return 0
  
  return Math.max(0, (maxDistance - distance) / maxDistance * 100)
}

/**
 * Find duplicate groups in a collection of images
 */
export function findDuplicateGroups(
  imageHashes: Map<string, ImageHash>,
  similarityThreshold: number = 85
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const processed = new Set<string>()
  
  const photoIds = Array.from(imageHashes.keys())
  
  for (let i = 0; i < photoIds.length; i++) {
    const photoId1 = photoIds[i]
    
    if (processed.has(photoId1)) continue
    
    const hash1 = imageHashes.get(photoId1)
    if (!hash1) continue
    
    const similarPhotos = [photoId1]
    
    // Find all photos similar to this one
    for (let j = i + 1; j < photoIds.length; j++) {
      const photoId2 = photoIds[j]
      
      if (processed.has(photoId2)) continue
      
      const hash2 = imageHashes.get(photoId2)
      if (!hash2) continue
      
      const similarity = calculateSimilarity(hash1.hash, hash2.hash)
      
      if (similarity >= similarityThreshold) {
        similarPhotos.push(photoId2)
        processed.add(photoId2)
      }
    }
    
    // If we found duplicates, create a group
    if (similarPhotos.length > 1) {
      groups.push({
        id: `dup_group_${groups.length + 1}`,
        photos: similarPhotos,
        similarity: similarityThreshold
      })
      
      // Mark all photos in this group as processed
      similarPhotos.forEach(id => processed.add(id))
    } else {
      processed.add(photoId1)
    }
  }
  
  return groups
}

/**
 * Process specific files with their photo IDs and detect duplicates
 */
export async function detectDuplicatesInAnalyzableFiles(
  filesToAnalyze: { file: File; photoId: string }[],
  onProgress?: (current: number, total: number) => void,
  similarityThreshold: number = 85
): Promise<{
  hashes: Map<string, ImageHash>
  groups: DuplicateGroup[]
}> {
  const hashes = new Map<string, ImageHash>()
  
  console.log(`Processing ${filesToAnalyze.length} files for duplicate detection...`)
  
  // Calculate hashes for all images
  for (let i = 0; i < filesToAnalyze.length; i++) {
    const { file, photoId } = filesToAnalyze[i]
    
    onProgress?.(i, filesToAnalyze.length)
    
    try {
      const hash = await calculateImageHash(file)
      if (hash) {
        hashes.set(photoId, hash)
      }
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error)
    }
  }
  
  console.log(`Calculated ${hashes.size} hashes, finding duplicate groups...`)
  
  // Find duplicate groups
  const groups = findDuplicateGroups(hashes, similarityThreshold)
  
  console.log(`Found ${groups.length} duplicate groups`)
  
  return { hashes, groups }
}

/**
 * Process files and detect duplicates (legacy function for backward compatibility)
 */
export async function detectDuplicatesInFiles(
  files: FileList,
  onProgress?: (current: number, total: number) => void,
  similarityThreshold: number = 85
): Promise<{
  hashes: Map<string, ImageHash>
  groups: DuplicateGroup[]
}> {
  const filesToAnalyze: { file: File; photoId: string }[] = []
  
  // Filter image files and create photo IDs
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|heic|heif|avif)$/i.test(file.name)) {
      filesToAnalyze.push({ file, photoId: `file_${i}` })
    }
  }
  
  return detectDuplicatesInAnalyzableFiles(filesToAnalyze, onProgress, similarityThreshold)
}
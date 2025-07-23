export interface QualityAnalysisResult {
  blurScore: number
  isBlurry: boolean
  hasClosedEyes: boolean
  faceCount: number
  qualityScore: number
}

export interface QualitySettings {
  enableBlurDetection: boolean
  enableClosedEyeDetection: boolean
  blurThreshold: number
  autoSelectBlurry: boolean
  autoSelectClosedEyes: boolean
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  enableBlurDetection: true,
  enableClosedEyeDetection: false,
  blurThreshold: 100,
  autoSelectBlurry: false,
  autoSelectClosedEyes: false
}

export async function analyzeImageQuality(
  file: File,
  settings: QualitySettings
): Promise<QualityAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    img.onload = async () => {
      try {
        // Optimize canvas size for faster processing
        const maxSize = 800 // Reduce image size for faster analysis
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const width = Math.floor(img.width * scale)
        const height = Math.floor(img.height * scale)
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        let blurScore = 0
        let isBlurry = false
        let hasClosedEyes = false
        let faceCount = 0

        if (settings.enableBlurDetection) {
          blurScore = calculateBlurScore(ctx, width, height)
          isBlurry = blurScore < settings.blurThreshold
        }

        if (settings.enableClosedEyeDetection) {
          const faceAnalysis = await analyzeFaces(ctx, width, height)
          hasClosedEyes = faceAnalysis.hasClosedEyes
          faceCount = faceAnalysis.faceCount
        }

        const qualityScore = calculateOverallQuality(blurScore, hasClosedEyes)

        resolve({
          blurScore,
          isBlurry,
          hasClosedEyes,
          faceCount,
          qualityScore
        })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

function calculateBlurScore(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): number {
  // Sample only a portion of the image for faster processing
  const sampleSize = 0.25 // Use 25% of the image
  const stepX = Math.max(1, Math.floor(1 / sampleSize))
  const stepY = Math.max(1, Math.floor(1 / sampleSize))
  
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let sum = 0
  let count = 0

  for (let y = stepY; y < height - stepY; y += stepY) {
    for (let x = stepX; x < width - stepX; x += stepX) {
      const idx = (y * width + x) * 4
      
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      
      const rightIdx = (y * width + (x + stepX)) * 4
      const rightGray = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2]
      
      const bottomIdx = ((y + stepY) * width + x) * 4
      const bottomGray = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2]
      
      const dx = rightGray - gray
      const dy = bottomGray - gray
      
      const magnitude = Math.sqrt(dx * dx + dy * dy)
      sum += magnitude * magnitude
      count++
    }
  }

  return count > 0 ? Math.sqrt(sum / count) : 0
}

async function analyzeFaces(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<{ hasClosedEyes: boolean; faceCount: number }> {
  try {
    if (!('FaceDetector' in window)) {
      console.warn('Face detection not supported in this browser')
      return { hasClosedEyes: false, faceCount: 0 }
    }

    const faceDetector = new (window as any).FaceDetector({
      maxDetectedFaces: 10,
      fastMode: true
    })

    const imageData = ctx.getImageData(0, 0, width, height)
    const detectedFaces = await faceDetector.detect(imageData)

    if (detectedFaces.length === 0) {
      return { hasClosedEyes: false, faceCount: 0 }
    }

    let hasClosedEyes = false
    for (const face of detectedFaces) {
      if (face.landmarks) {
        const leftEye = face.landmarks.find((l: any) => l.type === 'eye' && l.location.x < face.boundingBox.x + face.boundingBox.width / 2)
        const rightEye = face.landmarks.find((l: any) => l.type === 'eye' && l.location.x > face.boundingBox.x + face.boundingBox.width / 2)
        
        if (leftEye && rightEye) {
          const eyeOpenScore = calculateEyeOpenScore(ctx, leftEye, rightEye, face.boundingBox)
          if (eyeOpenScore < 0.3) {
            hasClosedEyes = true
            break
          }
        }
      }
    }

    return {
      hasClosedEyes,
      faceCount: detectedFaces.length
    }
  } catch (error) {
    console.warn('Face detection failed:', error)
    return { hasClosedEyes: false, faceCount: 0 }
  }
}

function calculateEyeOpenScore(
  ctx: CanvasRenderingContext2D,
  leftEye: any,
  rightEye: any,
  boundingBox: any
): number {
  const eyeRegionSize = Math.min(boundingBox.width, boundingBox.height) * 0.15
  
  const leftEyeData = ctx.getImageData(
    Math.max(0, leftEye.location.x - eyeRegionSize / 2),
    Math.max(0, leftEye.location.y - eyeRegionSize / 2),
    eyeRegionSize,
    eyeRegionSize
  )
  
  const rightEyeData = ctx.getImageData(
    Math.max(0, rightEye.location.x - eyeRegionSize / 2),
    Math.max(0, rightEye.location.y - eyeRegionSize / 2),
    eyeRegionSize,
    eyeRegionSize
  )

  const leftScore = calculateRegionVariance(leftEyeData)
  const rightScore = calculateRegionVariance(rightEyeData)
  
  return (leftScore + rightScore) / 2
}

function calculateRegionVariance(imageData: ImageData): number {
  const data = imageData.data
  const pixels = data.length / 4
  
  let mean = 0
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    mean += gray
  }
  mean /= pixels
  
  let variance = 0
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    variance += Math.pow(gray - mean, 2)
  }
  
  return Math.sqrt(variance / pixels)
}

function calculateOverallQuality(blurScore: number, hasClosedEyes: boolean): number {
  let quality = Math.min(100, blurScore)
  
  if (hasClosedEyes) {
    quality *= 0.5
  }
  
  return Math.round(quality)
}

export function shouldAutoSelect(analysis: QualityAnalysisResult, settings: QualitySettings): boolean {
  if (settings.autoSelectBlurry && analysis.isBlurry) {
    return true
  }
  
  if (settings.autoSelectClosedEyes && analysis.hasClosedEyes) {
    return true
  }
  
  return false
}
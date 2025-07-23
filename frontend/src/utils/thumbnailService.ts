export interface ThumbnailUploadResult {
  success: boolean
  thumbnailPath: string
  filename: string
}

export class ThumbnailService {
  private static instance: ThumbnailService
  private uploadedThumbnails: Map<string, string> = new Map() // photoId -> thumbnailPath
  private originalFiles: Map<string, File> = new Map() // photoId -> original File object

  static getInstance(): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService()
    }
    return ThumbnailService.instance
  }

  async uploadThumbnail(
    photoId: string,
    filename: string,
    dataUrl: string
  ): Promise<ThumbnailUploadResult | null> {
    try {
      const response = await fetch('/api/thumbnails/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          photoId,
          filename,
          dataUrl
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to upload thumbnail:', error)
        return null
      }

      const result = await response.json()
      
      // Store the mapping for future reference
      this.uploadedThumbnails.set(photoId, result.thumbnailPath)
      
      return result
    } catch (error) {
      console.error('Error uploading thumbnail:', error)
      return null
    }
  }

  async uploadMultipleThumbnails(
    thumbnails: { photoId: string; filename: string; dataUrl: string }[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>() // photoId -> thumbnailPath
    
    for (let i = 0; i < thumbnails.length; i++) {
      const thumbnail = thumbnails[i]
      onProgress?.(i, thumbnails.length)
      
      const result = await this.uploadThumbnail(
        thumbnail.photoId,
        thumbnail.filename,
        thumbnail.dataUrl
      )
      
      if (result) {
        results.set(thumbnail.photoId, result.thumbnailPath)
      }
    }
    
    onProgress?.(thumbnails.length, thumbnails.length)
    return results
  }

  getThumbnailPath(photoId: string): string | null {
    return this.uploadedThumbnails.get(photoId) || null
  }

  async getThumbnailInfo(filename: string) {
    try {
      const response = await fetch(`/api/thumbnails/${filename}/info`)
      if (!response.ok) {
        return null
      }
      return await response.json()
    } catch (error) {
      console.error('Error getting thumbnail info:', error)
      return null
    }
  }

  // Helper method to determine the best thumbnail URL to use
  getBestThumbnailUrl(photo: any): string | null {
    // Priority order:
    // 1. Uploaded backend thumbnail
    // 2. Data URL from frontend generation
    // 3. Blob URL
    // 4. API endpoint (fallback)
    
    if (photo.analysis?.thumbnailPath) {
      // Check if it's already a backend API path
      if (photo.analysis.thumbnailPath.startsWith('/api/thumbnails/')) {
        return photo.analysis.thumbnailPath
      }
      
      // Check if we have an uploaded version
      const uploadedPath = this.getThumbnailPath(photo.id)
      if (uploadedPath) {
        return uploadedPath
      }
      
      // Use data URL or blob URL directly
      if (photo.analysis.thumbnailPath.startsWith('data:') || 
          photo.analysis.thumbnailPath.startsWith('blob:')) {
        return photo.analysis.thumbnailPath
      }
      
      // Fallback to API endpoint with filename
      const filename = photo.analysis.thumbnailPath.split('/').pop()
      if (filename) {
        return `/api/thumbnails/${filename}`
      }
    }
    
    return null
  }

  // Store original file for preview
  storeOriginalFile(photoId: string, file: File) {
    this.originalFiles.set(photoId, file)
  }

  // Get original file for preview
  getOriginalFile(photoId: string): File | null {
    return this.originalFiles.get(photoId) || null
  }

  // Create object URL for original file
  getOriginalFileUrl(photoId: string): string | null {
    const file = this.originalFiles.get(photoId)
    if (file) {
      return URL.createObjectURL(file)
    }
    return null
  }

  // Clear cached thumbnails and original files (useful for memory management)
  clearCache() {
    // Revoke any existing object URLs to prevent memory leaks
    this.originalFiles.forEach((file, photoId) => {
      const url = URL.createObjectURL(file)
      URL.revokeObjectURL(url)
    })
    
    this.uploadedThumbnails.clear()
    this.originalFiles.clear()
  }

  // Get stats about uploaded thumbnails
  getStats() {
    return {
      uploadedCount: this.uploadedThumbnails.size,
      photoIds: Array.from(this.uploadedThumbnails.keys())
    }
  }
}
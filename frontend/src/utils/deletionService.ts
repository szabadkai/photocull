export interface DeletedFile {
  id: string
  originalPath: string
  filename: string
  size: number
  deletedAt: string
  tempPath?: string
}

export interface DeletionStats {
  fileCount: number
  totalSize: number
  deletedFiles: DeletedFile[]
}

export class DeletionService {
  private static instance: DeletionService
  private deletedFiles: Map<string, DeletedFile> = new Map()

  static getInstance(): DeletionService {
    if (!DeletionService.instance) {
      DeletionService.instance = new DeletionService()
    }
    return DeletionService.instance
  }

  async moveToTrash(photoIds: string[], photos: any[]): Promise<boolean> {
    try {
      const photosToDelete = photos.filter(p => photoIds.includes(p.id))
      
      const response = await fetch('/api/photos/move-to-trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          photos: photosToDelete.map(p => ({
            id: p.id,
            filename: p.filename,
            path: p.path || p.webkitRelativePath,
            size: p.size
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to move files to trash: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Update local tracking
      result.deletedFiles.forEach((file: any) => {
        this.deletedFiles.set(file.id, {
          id: file.id,
          originalPath: file.originalPath,
          filename: file.filename,
          size: file.size,
          deletedAt: new Date().toISOString(),
          tempPath: file.tempPath
        })
      })

      return true
    } catch (error) {
      console.error('Error moving files to trash:', error)
      return false
    }
  }

  async emptyTrash(): Promise<boolean> {
    try {
      const response = await fetch('/api/photos/empty-trash', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to empty trash: ${response.statusText}`)
      }

      // Clear local tracking
      this.deletedFiles.clear()
      return true
    } catch (error) {
      console.error('Error emptying trash:', error)
      return false
    }
  }

  async restoreFromTrash(fileIds: string[]): Promise<boolean> {
    try {
      const response = await fetch('/api/photos/restore-from-trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileIds })
      })

      if (!response.ok) {
        throw new Error(`Failed to restore files: ${response.statusText}`)
      }

      // Remove from local tracking
      fileIds.forEach(id => this.deletedFiles.delete(id))
      return true
    } catch (error) {
      console.error('Error restoring files:', error)
      return false
    }
  }

  getDeletionStats(): DeletionStats {
    const files = Array.from(this.deletedFiles.values())
    return {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      deletedFiles: files
    }
  }

  async getTrashStatus(): Promise<DeletionStats> {
    try {
      const response = await fetch('/api/photos/trash-status')
      if (!response.ok) {
        throw new Error(`Failed to get trash status: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Update local tracking
      this.deletedFiles.clear()
      data.deletedFiles.forEach((file: DeletedFile) => {
        this.deletedFiles.set(file.id, file)
      })
      
      return data
    } catch (error) {
      console.error('Error getting trash status:', error)
      return this.getDeletionStats()
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }
}
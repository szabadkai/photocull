import { useState } from 'react'
import { PhotoWithAnalysis } from '../../../shared/src/types'
import { ThumbnailService } from '../utils/thumbnailService'
import { DeletionService } from '../utils/deletionService'

interface DuplicateModalProps {
  photos: PhotoWithAnalysis[]
  groupId: string
  onClose: () => void
  onPhotosDeleted?: (deletedPhotoIds: string[]) => void
}

export default function DuplicateModal({ photos, groupId, onClose, onPhotosDeleted }: DuplicateModalProps) {
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getThumbnailUrl = (photo: PhotoWithAnalysis) => {
    const thumbnailService = ThumbnailService.getInstance()
    return thumbnailService.getBestThumbnailUrl(photo)
  }

  const getOriginalImageUrl = (photo: PhotoWithAnalysis) => {
    const thumbnailService = ThumbnailService.getInstance()
    // Try to get the original file URL from stored File objects first
    const originalUrl = thumbnailService.getOriginalFileUrl(photo.id)
    if (originalUrl) {
      return originalUrl
    }
    // Fallback to API endpoint if not available
    return `/api/photos/${photo.id}/original`
  }

  const openOriginalImage = (photo: PhotoWithAnalysis) => {
    // Try to open the original image
    const originalUrl = getOriginalImageUrl(photo)
    const newWindow = window.open('', '_blank')
    
    if (newWindow) {
      // Create a loading page while the image loads
      newWindow.document.write(`
        <html>
          <head>
            <title>${photo.filename}</title>
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                background: #000; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                min-height: 100vh;
                font-family: Arial, sans-serif;
              }
              .container {
                text-align: center;
                color: white;
              }
              img { 
                max-width: 100%; 
                max-height: 90vh; 
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(255,255,255,0.1);
              }
              .loading {
                color: #ccc;
                margin: 20px;
              }
              .error {
                color: #ff6b6b;
                margin: 20px;
              }
              .info {
                color: #ccc;
                margin-top: 10px;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="loading">Loading ${photo.filename}...</div>
              <div class="info">File size: ${formatFileSize(photo.size)} | Format: ${photo.format.toUpperCase()}</div>
            </div>
            <script>
              // Try to load the original image
              const img = new Image();
              img.onload = function() {
                document.body.innerHTML = \`
                  <div class="container">
                    <img src="\${this.src}" alt="${photo.filename}" />
                    <div class="info">${photo.filename} | ${formatFileSize(photo.size)} | ${photo.format.toUpperCase()}</div>
                  </div>
                \`;
              };
              img.onerror = function() {
                // Fallback to thumbnail if original fails
                const thumbnailUrl = "${getThumbnailUrl(photo)}";
                if (thumbnailUrl) {
                  const fallbackImg = new Image();
                  fallbackImg.onload = function() {
                    document.body.innerHTML = \`
                      <div class="container">
                        <img src="\${this.src}" alt="${photo.filename}" />
                        <div class="info">${photo.filename} (Thumbnail Preview) | ${photo.format.toUpperCase()}</div>
                        <div style="color: #ff9800; margin-top: 10px; font-size: 12px;">
                          Original image not available - showing thumbnail
                        </div>
                      </div>
                    \`;
                  };
                  fallbackImg.onerror = function() {
                    document.body.innerHTML = \`
                      <div class="container">
                        <div class="error">Unable to load image: ${photo.filename}</div>
                        <div class="info">The original file may not be accessible</div>
                      </div>
                    \`;
                  };
                  fallbackImg.src = thumbnailUrl;
                } else {
                  document.body.innerHTML = \`
                    <div class="container">
                      <div class="error">Unable to load image: ${photo.filename}</div>
                      <div class="info">No preview available</div>
                    </div>
                  \`;
                }
              };
              img.src = "${originalUrl}";
            </script>
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }

  const toggleSelection = (photoId: string) => {
    const newSelection = new Set(selectedForDeletion)
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId)
    } else {
      newSelection.add(photoId)
    }
    setSelectedForDeletion(newSelection)
  }

  const handleKeepBest = () => {
    // Auto-select all but the largest file (assuming largest = best quality)
    const sortedBySize = [...photos].sort((a, b) => b.size - a.size)
    const toDelete = sortedBySize.slice(1).map(p => p.id)
    setSelectedForDeletion(new Set(toDelete))
  }

  const handleKeepNewest = () => {
    // Auto-select all but the newest file
    const sortedByDate = [...photos].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    const toDelete = sortedByDate.slice(1).map(p => p.id)
    setSelectedForDeletion(new Set(toDelete))
  }

  const handleDeleteSelected = async () => {
    if (selectedForDeletion.size === 0 || isDeleting) return
    if (selectedForDeletion.size === photos.length) {
      alert("You cannot delete all duplicates. Please keep at least one.")
      return
    }
    
    const selectedPhotoIds = Array.from(selectedForDeletion)
    const selectedPhotoObjects = photos.filter(p => selectedPhotoIds.includes(p.id))
    
    const totalSize = selectedPhotoObjects.reduce((sum, photo) => sum + photo.size, 0)
    const keepingCount = photos.length - selectedForDeletion.size
    
    const confirmed = confirm(
      `Move ${selectedForDeletion.size} selected photo${selectedForDeletion.size === 1 ? '' : 's'} to trash?\n\n` +
      `Total size to delete: ${formatFileSize(totalSize)}\n` +
      `Keeping ${keepingCount} photo${keepingCount === 1 ? '' : 's'} from this duplicate group\n\n` +
      `Files will be moved to trash and can be restored later.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    
    try {
      const deletionService = DeletionService.getInstance()
      const success = await deletionService.moveToTrash(selectedPhotoIds, selectedPhotoObjects)
      
      if (success) {
        // Notify parent component about deleted photos
        onPhotosDeleted?.(selectedPhotoIds)
        
        // Show success message and close modal
        const deletedCount = selectedPhotoIds.length
        setTimeout(() => {
          alert(`Successfully moved ${deletedCount} photo${deletedCount === 1 ? '' : 's'} to trash.`)
          onClose()
        }, 100)
      } else {
        alert('Failed to delete some photos. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting photos:', error)
      alert('An error occurred while deleting photos. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
            title="Back to gallery"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Duplicate Comparison
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {photos.length} duplicate files • Select photos to delete
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleKeepBest}
            className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            Keep Largest
          </button>
          <button
            onClick={handleKeepNewest}
            className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            Keep Newest
          </button>
          <button
            onClick={() => setSelectedForDeletion(new Set())}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Clear Selection
          </button>
          
          {selectedForDeletion.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
            >
              {isDeleting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>
                {isDeleting ? 'Moving to Trash...' : `Delete ${selectedForDeletion.size} Selected`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Selection Status Bar */}
      {selectedForDeletion.size > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-800 dark:text-red-200">
              <strong>{selectedForDeletion.size}</strong> of <strong>{photos.length}</strong> photos selected for deletion
            </span>
            <span className="text-xs text-red-600 dark:text-red-300">
              Potential space saved: {formatFileSize(
                photos
                  .filter(p => selectedForDeletion.has(p.id))
                  .reduce((sum, p) => sum + p.size, 0)
              )}
            </span>
          </div>
        </div>
      )}

      {/* Main Content - Photo Comparison */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Responsive grid for larger images */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {photos.map((photo) => {
              const thumbnailUrl = getThumbnailUrl(photo)
              const isSelectedForDeletion = selectedForDeletion.has(photo.id)
              
              return (
                <div
                  key={photo.id}
                  className={`relative overflow-hidden transition-all duration-200 ${
                    isSelectedForDeletion 
                      ? 'ring-4 ring-red-500' 
                      : 'ring-1 ring-gray-300 hover:ring-gray-400'
                  }`}
                >
                  {/* Selection checkbox */}
                  <div className="absolute top-4 left-4 z-20">
                    <label className="flex items-center space-x-2 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm rounded-lg px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelectedForDeletion}
                        onChange={() => toggleSelection(photo.id)}
                        className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {isSelectedForDeletion ? 'Delete' : 'Keep'}
                      </span>
                    </label>
                  </div>

                  {/* Quality badges */}
                  <div className="absolute top-4 right-4 z-20 flex flex-col space-y-1">
                    {photo.analysis?.blurScore && photo.analysis.blurScore < 100 && (
                      <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg font-medium">
                        BLURRY
                      </span>
                    )}
                    {photo.hasRawPair && photo.hasJpegPair && (
                      <span className="px-2 py-1 text-xs bg-purple-500 text-white rounded-lg font-medium">
                        RAW+JPG
                      </span>
                    )}
                  </div>

                  {/* Delete overlay */}
                  {isSelectedForDeletion && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-10 flex items-center justify-center z-10">
                      <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium shadow-lg">
                        MARKED FOR DELETION
                      </div>
                    </div>
                  )}

                  {/* Large image display */}
                  <div className="bg-black relative w-full flex items-center justify-center">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={photo.filename}
                        className="w-full h-auto object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                        onClick={() => openOriginalImage(photo)}
                        style={{ maxHeight: 'none' }}
                      />
                    ) : (
                      <div className="w-full py-20 flex items-center justify-center">
                        <div className="text-center text-white">
                          <div className="text-6xl mb-4">📸</div>
                          <div className="text-lg font-medium">{photo.format.toUpperCase()}</div>
                          <div className="text-sm">No preview available</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Info overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 opacity-0 hover:opacity-100 transition-opacity">
                      <h3 className="text-sm font-semibold mb-2 truncate">
                        {photo.filename}
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-300">Size: </span>
                          <span className="font-medium">{formatFileSize(photo.size)}</span>
                          {photo.width && photo.height && (
                            <>
                              <br />
                              <span className="text-gray-300">Dimensions: </span>
                              <span className="font-medium">{photo.width}×{photo.height}</span>
                            </>
                          )}
                        </div>
                        
                        <div>
                          <span className="text-gray-300">Format: </span>
                          <span className="font-medium">{photo.format.toUpperCase()}</span>
                          {photo.analysis?.blurScore !== undefined && (
                            <>
                              <br />
                              <span className="text-gray-300">Blur: </span>
                              <span className={`font-medium ${photo.analysis.blurScore < 100 ? 'text-red-400' : 'text-green-400'}`}>
                                {Math.round(photo.analysis.blurScore)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Tip:</span> Click images to view full resolution • Use "Keep Largest" for best quality • Select multiple photos to delete at once
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Group {groupId.split('_').pop()}
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
import { PhotoWithAnalysis } from '../../../shared/src/types'
import { ThumbnailService } from '../utils/thumbnailService'
import { useState } from 'react'

interface PhotoCardProps {
  photo: PhotoWithAnalysis
  isSelected: boolean
  onSelect: (selected: boolean) => void
  showDuplicateBadge?: boolean
}

export default function PhotoCard({ photo, isSelected, onSelect, showDuplicateBadge }: PhotoCardProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (date: string | Date) => {
    return (date instanceof Date ? date : new Date(date)).toLocaleDateString()
  }

  const getThumbnailUrl = () => {
    const thumbnailService = ThumbnailService.getInstance()
    return thumbnailService.getBestThumbnailUrl(photo)
  }

  const handleImageClick = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Cmd+click (Mac) or Ctrl+click (Windows/Linux) - open in new window
      openOriginalImage()
    } else {
      // Regular click - show zoom overlay
      setIsZoomed(true)
    }
  }

  const openOriginalImage = () => {
    const thumbnailService = ThumbnailService.getInstance()
    const originalUrl = thumbnailService.getOriginalFileUrl(photo.id)
    
    if (originalUrl) {
      // Open original image in new window
      const newWindow = window.open('', '_blank')
      if (newWindow) {
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
                .info {
                  color: #ccc;
                  margin-top: 10px;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="${originalUrl}" alt="${photo.filename}" />
                <div class="info">${photo.filename} | ${formatFileSize(photo.size)} | ${photo.format.toUpperCase()}</div>
              </div>
            </body>
          </html>
        `)
        newWindow.document.close()
      }
    } else {
      // Fallback to thumbnail if original not available
      const thumbnailUrl = getThumbnailUrl()
      if (thumbnailUrl) {
        window.open(thumbnailUrl, '_blank')
      }
    }
  }

  const thumbnailUrl = getThumbnailUrl()
  const blurScore = photo.analysis?.blurScore
  const isBlurry = blurScore !== null && blurScore !== undefined && blurScore < 100
  const qualityScore = photo.analysis?.qualityScore

  return (
    <div
      className={`relative transition-all duration-200 ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'
      }`}
    >
      {/* Selection checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
      </div>

      {/* Duplicate badge */}
      {showDuplicateBadge && photo.analysis?.isDuplicate && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
            DUP
          </span>
        </div>
      )}

      {/* RAW+JPEG badge */}
      {photo.hasRawPair && photo.hasJpegPair && (
        <div className="absolute top-8 right-2 z-10">
          <span className="px-2 py-1 text-xs bg-purple-500 text-white rounded">
            RAW+JPG
          </span>
        </div>
      )}
      
      {/* RAW only badge */}
      {photo.isRaw && !photo.hasJpegPair && (
        <div className="absolute top-8 right-2 z-10">
          <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
            RAW
          </span>
        </div>
      )}

      {/* Quality badges */}
      {isBlurry && (
        <div className="absolute top-14 right-2 z-10">
          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
            BLUR
          </span>
        </div>
      )}
      
      
      {qualityScore !== undefined && qualityScore < 50 && (
        <div className="absolute top-26 right-2 z-10">
          <span className="px-2 py-1 text-xs bg-yellow-500 text-white rounded">
            LOW Q
          </span>
        </div>
      )}

      {/* Image */}
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-black">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.filename}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handleImageClick}
            onError={(e) => {
              // Fallback to placeholder if thumbnail fails to load
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        
        {/* Fallback placeholder */}
        <div className={`w-full h-full flex items-center justify-center ${thumbnailUrl ? 'hidden' : ''}`}>
          <div className="text-center text-white">
            <div className="text-2xl mb-2">
              {photo.isRaw ? '📷' : '📸'}
            </div>
            <div className="text-xs uppercase tracking-wide">
              {photo.hasRawPair && photo.hasJpegPair ? 'RAW+JPG' : photo.format}
            </div>
            {photo.isRaw && !thumbnailUrl && (
              <div className="text-xs text-red-400 mt-1">
                No preview
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 opacity-0 hover:opacity-100 transition-opacity">
        <h3 className="text-xs font-medium truncate mb-1">
          {photo.filename}
        </h3>
        
        <div className="text-xs text-gray-300">
          {formatFileSize(photo.size)}
          {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
          {blurScore !== null && blurScore !== undefined && (
            <span className={` • ${isBlurry ? 'text-red-400' : 'text-green-400'}`}>
              Blur: {Math.round(blurScore)}
            </span>
          )}
        </div>
      </div>

      {/* Zoom Overlay */}
      {isZoomed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setIsZoomed(false)}
        >
          <div className="max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            <img
              src={(() => {
                const thumbnailService = ThumbnailService.getInstance()
                const originalUrl = thumbnailService.getOriginalFileUrl(photo.id)
                return originalUrl ?? getThumbnailUrl() ?? ''
              })()}
              alt={photo.filename}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 text-center text-white">
              <div className="text-lg font-medium">{photo.filename}</div>
              <div className="text-sm text-gray-300 mt-1">
                {formatFileSize(photo.size)} | {photo.format.toUpperCase()}
                {photo.width && photo.height && ` | ${photo.width}×${photo.height}`}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Click outside to close | Cmd+Click to open in new window
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
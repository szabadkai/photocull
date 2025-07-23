import { useState } from 'react'
import { PhotoWithAnalysis } from '../../../shared/src/types'
import DuplicateModal from './DuplicateModal'
import { ThumbnailService } from '../utils/thumbnailService'

interface DuplicateStackProps {
  photos: PhotoWithAnalysis[]
  groupId: string
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onPhotosDeleted?: (deletedPhotoIds: string[]) => void
}

export default function DuplicateStack({ photos, groupId, isSelected, onSelect, onPhotosDeleted }: DuplicateStackProps) {
  const [showModal, setShowModal] = useState(false)

  if (photos.length === 0) return null

  const primaryPhoto = photos[0] // Use first photo as the main thumbnail
  const stackOffset = Math.min(photos.length - 1, 3) // Show max 3 stack layers

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getTotalSize = () => {
    return photos.reduce((total, photo) => total + photo.size, 0)
  }

  const getThumbnailUrl = (photo: PhotoWithAnalysis) => {
    const thumbnailService = ThumbnailService.getInstance()
    return thumbnailService.getBestThumbnailUrl(photo)
  }

  const thumbnailUrl = getThumbnailUrl(primaryPhoto)

  return (
    <>
      <div
        className={`relative transition-all duration-200 cursor-pointer group ${
          isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'
        }`}
        onClick={() => setShowModal(true)}
      >
        {/* Selection checkbox */}
        <div className="absolute top-2 left-2 z-20">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onSelect(e.target.checked)
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </div>

        {/* Duplicate count badge */}
        <div className="absolute top-2 right-2 z-20">
          <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded font-medium">
            {photos.length} DUP
          </span>
        </div>
        
        {/* RAW+JPEG indicator */}
        {primaryPhoto.hasRawPair && primaryPhoto.hasJpegPair && (
          <div className="absolute top-8 right-2 z-20">
            <span className="px-2 py-1 text-xs bg-purple-500 text-white rounded">
              RAW+JPG
            </span>
          </div>
        )}

        {/* Expand hint */}
        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="px-2 py-1 text-xs bg-black bg-opacity-75 text-white rounded">
            Click to expand
          </span>
        </div>

        {/* Stacked images effect */}
        <div className="relative">
          {/* Background stack layers */}
          {Array.from({ length: stackOffset }, (_, i) => (
            <div
              key={i}
              className="absolute inset-0 bg-gray-200 rounded-lg"
              style={{
                transform: `translate(${(i + 1) * 2}px, ${(i + 1) * 2}px)`,
                zIndex: stackOffset - i
              }}
            />
          ))}

          {/* Main image */}
          <div 
            className="w-full h-full min-h-[300px] bg-black relative flex items-center justify-center"
            style={{ zIndex: stackOffset + 1 }}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={primaryPhoto.filename}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            
            {/* Fallback placeholder */}
            <div className={`w-full h-full flex items-center justify-center ${thumbnailUrl ? 'hidden' : ''}`}>
              <div className="text-center text-white">
                <div className="text-2xl mb-2">📸</div>
                <div className="text-xs uppercase tracking-wide">
                  {primaryPhoto.format}
                </div>
              </div>
            </div>

            {/* Info overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <h3 className="text-xs font-medium truncate mb-1">
                Duplicate Group {groupId.split('_').pop()}
              </h3>
              
              <div className="text-xs text-gray-300">
                {photos.length} files • {formatFileSize(getTotalSize())}
                <span className="text-green-400"> • Save {formatFileSize(getTotalSize() - primaryPhoto.size)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for detailed comparison */}
      {showModal && (
        <DuplicateModal
          photos={photos}
          groupId={groupId}
          onClose={() => setShowModal(false)}
          onPhotosDeleted={onPhotosDeleted}
        />
      )}
    </>
  )
}
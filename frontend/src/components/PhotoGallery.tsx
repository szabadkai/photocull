import { useState } from 'react'
import { PhotoWithAnalysis } from '../../../shared/src/types'
import PhotoCard from './PhotoCard'
import DuplicateStack from './DuplicateStack'
import { DeletionService } from '../utils/deletionService'

interface PhotoGalleryProps {
  photos: PhotoWithAnalysis[]
  showDuplicatesOnly: boolean
  onPhotosDeleted?: (deletedPhotoIds: string[]) => void
}

export default function PhotoGallery({ photos, showDuplicatesOnly, onPhotosDeleted }: PhotoGalleryProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'blur'>('date')
  const [filterBy, setFilterBy] = useState<'all' | 'blurry' | 'large'>('all')
  const [isDeleting, setIsDeleting] = useState(false)

  const handlePhotoSelect = (photoId: string, selected: boolean) => {
    const newSelected = new Set(selectedPhotos)
    if (selected) {
      newSelected.add(photoId)
    } else {
      newSelected.delete(photoId)
    }
    setSelectedPhotos(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0 || isDeleting) return
    
    const selectedPhotoIds = Array.from(selectedPhotos)
    const selectedPhotoObjects = photos.filter(p => selectedPhotoIds.includes(p.id))
    
    const totalSize = selectedPhotoObjects.reduce((sum, photo) => sum + photo.size, 0)
    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
    
    const confirmed = confirm(
      `Move ${selectedPhotos.size} selected photo${selectedPhotos.size === 1 ? '' : 's'} to trash?\n\n` +
      `Total size: ${formatFileSize(totalSize)}\n\n` +
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
        setSelectedPhotos(new Set())
        
        // Show success message
        const deletedCount = selectedPhotoIds.length
        setTimeout(() => {
          alert(`Successfully moved ${deletedCount} photo${deletedCount === 1 ? '' : 's'} to trash.`)
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

  const sortedPhotos = [...photos].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.filename.localeCompare(b.filename)
      case 'date':
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      case 'size':
        return b.size - a.size
      case 'blur':
        return (b.analysis?.blurScore || 0) - (a.analysis?.blurScore || 0)
      default:
        return 0
    }
  })

  // Group photos by duplicate group
  const groupedPhotos = () => {
    if (showDuplicatesOnly) {
      const groups = new Map<string, PhotoWithAnalysis[]>()
      
      for (const photo of sortedPhotos) {
        if (photo.analysis?.isDuplicate && photo.analysis.duplicateGroup) {
          const groupId = photo.analysis.duplicateGroup
          if (!groups.has(groupId)) {
            groups.set(groupId, [])
          }
          groups.get(groupId)!.push(photo)
        }
      }
      
      return groups
    }
    return new Map()
  }

  const duplicateGroups = groupedPhotos()
  
  const filteredPhotos = sortedPhotos.filter(photo => {
    // If showing duplicates only, don't show individual photos - they'll be in stacks
    if (showDuplicatesOnly && photo.analysis?.isDuplicate) {
      return false
    }
    
    switch (filterBy) {
      case 'blurry':
        return photo.analysis?.blurScore && photo.analysis.blurScore < 100
      case 'large':
        return photo.size > 5 * 1024 * 1024 // > 5MB
      default:
        return true
    }
  })

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">No photos found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
            </button>
            
            {selectedPhotos.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-3 py-1 text-sm bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed rounded transition-colors flex items-center space-x-2"
              >
                {isDeleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>
                  {isDeleting ? 'Moving to Trash...' : `Delete Selected (${selectedPhotos.size})`}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mr-2">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="blur">Blur Score</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mr-2">Filter:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="blurry">Blurry</option>
                <option value="large">Large Files</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {showDuplicatesOnly ? (
            <>
              Showing {duplicateGroups.size} duplicate groups
              <span className="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded text-xs">
                Duplicates Only
              </span>
            </>
          ) : (
            `Showing ${filteredPhotos.length} of ${photos.length} photos`
          )}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Show duplicate stacks when in duplicates view */}
        {showDuplicatesOnly && Array.from(duplicateGroups.entries()).map(([groupId, groupPhotos]) => (
          <DuplicateStack
            key={groupId}
            photos={groupPhotos}
            groupId={groupId}
            isSelected={groupPhotos.every(photo => selectedPhotos.has(photo.id))}
            onSelect={(selected) => {
              // Select/deselect all photos in this group
              const newSelected = new Set(selectedPhotos)
              groupPhotos.forEach(photo => {
                if (selected) {
                  newSelected.add(photo.id)
                } else {
                  newSelected.delete(photo.id)
                }
              })
              setSelectedPhotos(newSelected)
            }}
            onPhotosDeleted={onPhotosDeleted}
          />
        ))}
        
        {/* Show individual photos */}
        {filteredPhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            isSelected={selectedPhotos.has(photo.id)}
            onSelect={(selected) => handlePhotoSelect(photo.id, selected)}
            showDuplicateBadge={!showDuplicatesOnly && photo.analysis?.isDuplicate}
          />
        ))}
      </div>
    </div>
  )
}
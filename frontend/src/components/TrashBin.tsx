import { useState, useEffect } from 'react'
import { DeletionService, DeletionStats } from '../utils/deletionService'

interface TrashBinProps {
  isVisible: boolean
  onToggle: () => void
}

export default function TrashBin({ isVisible, onToggle }: TrashBinProps) {
  const [stats, setStats] = useState<DeletionStats>({ fileCount: 0, totalSize: 0, deletedFiles: [] })
  const [isEmptying, setIsEmptying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const deletionService = DeletionService.getInstance()

  useEffect(() => {
    if (isVisible) {
      loadTrashStatus()
    }
  }, [isVisible])

  const loadTrashStatus = async () => {
    setIsLoading(true)
    try {
      const trashStats = await deletionService.getTrashStatus()
      setStats(trashStats)
    } catch (error) {
      console.error('Failed to load trash status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmptyTrash = async () => {
    if (stats.fileCount === 0) return

    const confirmed = confirm(
      `Are you sure you want to permanently delete ${stats.fileCount} files (${deletionService.formatFileSize(stats.totalSize)})? This action cannot be undone.`
    )

    if (!confirmed) return

    setIsEmptying(true)
    try {
      const success = await deletionService.emptyTrash()
      if (success) {
        setStats({ fileCount: 0, totalSize: 0, deletedFiles: [] })
        alert('Trash emptied successfully!')
      } else {
        alert('Failed to empty trash. Please try again.')
      }
    } catch (error) {
      console.error('Error emptying trash:', error)
      alert('An error occurred while emptying trash.')
    } finally {
      setIsEmptying(false)
    }
  }

  const handleRestore = async (fileId: string) => {
    try {
      const success = await deletionService.restoreFromTrash([fileId])
      if (success) {
        await loadTrashStatus()
        alert('File restored successfully!')
      } else {
        alert('Failed to restore file. Please try again.')
      }
    } catch (error) {
      console.error('Error restoring file:', error)
      alert('An error occurred while restoring the file.')
    }
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className={`fixed bottom-4 right-4 p-3 rounded-full shadow-lg transition-all z-50 ${
          stats.fileCount > 0 
            ? 'bg-red-600 text-white hover:bg-red-700' 
            : 'bg-gray-600 text-white hover:bg-gray-700'
        }`}
        title={`Trash (${stats.fileCount} files)`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {stats.fileCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold">
            {stats.fileCount > 99 ? '99+' : stats.fileCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Trash Bin
            </h2>
            <p className="text-sm text-gray-600">
              {stats.fileCount} files • {deletionService.formatFileSize(stats.totalSize)}
            </p>
          </div>
          
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Files in trash are temporarily stored and can be restored or permanently deleted.
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={loadTrashStatus}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              
              <button
                onClick={handleEmptyTrash}
                disabled={stats.fileCount === 0 || isEmptying}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEmptying ? 'Emptying...' : 'Empty Trash'}
              </button>
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="overflow-auto max-h-[60vh]">
          {stats.fileCount === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <p className="text-lg font-medium">Trash is empty</p>
              <p className="text-sm">Deleted files will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.deletedFiles.map((file) => (
                <div key={file.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </h3>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                        <span>Size: {deletionService.formatFileSize(file.size)}</span>
                        <span>Deleted: {new Date(file.deletedAt).toLocaleDateString()}</span>
                        <span className="truncate">Path: {file.originalPath}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleRestore(file.id)}
                      className="ml-4 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="text-xs text-gray-500">
            <p><strong>Note:</strong> Files in trash are moved to a temporary directory and can be restored until the trash is emptied.</p>
            <p>Emptying trash will permanently delete all files and cannot be undone.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
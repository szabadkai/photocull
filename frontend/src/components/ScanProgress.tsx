import { useState, useEffect } from 'react'

interface ScanProgressData {
  totalFiles: number
  processedFiles: number
  currentFile: string
  phase: 'scanning' | 'analyzing' | 'complete'
}

export default function ScanProgress() {
  const [progress, setProgress] = useState<ScanProgressData>({
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    phase: 'scanning'
  })

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/scan/progress')
        if (response.ok) {
          const data = await response.json()
          setProgress(data)
          
          if (data.phase === 'complete') {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const getPhaseText = () => {
    switch (progress.phase) {
      case 'scanning':
        return 'Scanning directories for photos...'
      case 'analyzing':
        return 'Analyzing photos and detecting duplicates...'
      case 'complete':
        return 'Scan complete!'
      default:
        return 'Processing...'
    }
  }

  const progressPercentage = progress.totalFiles > 0 
    ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
    : 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getPhaseText()}
          </h2>
          
          {progress.phase !== 'complete' && (
            <div className="animate-spin mx-auto w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          )}
        </div>

        {progress.totalFiles > 0 && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Progress stats */}
            <div className="flex justify-between text-sm text-gray-600">
              <span>{progress.processedFiles} of {progress.totalFiles} files</span>
              <span>{progressPercentage}%</span>
            </div>

            {/* Current file */}
            {progress.currentFile && progress.phase === 'analyzing' && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Currently processing:</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {progress.currentFile}
                </p>
              </div>
            )}
          </div>
        )}

        {progress.phase === 'scanning' && progress.totalFiles === 0 && (
          <div className="text-center text-gray-500">
            <p>Searching for image files...</p>
          </div>
        )}

        {progress.phase === 'complete' && (
          <div className="text-center">
            <div className="text-green-600 text-4xl mb-2">✅</div>
            <p className="text-gray-600">
              Found and analyzed {progress.totalFiles} photos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
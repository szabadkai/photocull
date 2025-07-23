import { useState, useEffect } from 'react'
import DirectorySelector from './components/DirectorySelector'
import PhotoGallery from './components/PhotoGallery'
import ScanProgress from './components/ScanProgress'
import DuplicateSettings from './components/DuplicateSettings'
import ProjectSelector from './components/ProjectSelector'
import ThemeToggle from './components/ThemeToggle'
import { PhotoWithAnalysis } from '../../shared/src/types'
import { findDuplicateGroups } from './utils/duplicateDetection'
import { saveProject, loadProject, getProjectNameFromPath } from './utils/projectStorage'

function App() {
  const [photos, setPhotos] = useState<PhotoWithAnalysis[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [currentView, setCurrentView] = useState<'all' | 'duplicates'>('all')
  const [similarityThreshold, setSimilarityThreshold] = useState(80)
  const [cachedHashes, setCachedHashes] = useState<Map<string, any>>(new Map())
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [currentProjectPath, setCurrentProjectPath] = useState<string>('')
  const [showDirectorySelector, setShowDirectorySelector] = useState(false)

  const handleScanComplete = (scannedPhotos: PhotoWithAnalysis[], hashes?: Map<string, any>, directoryPath?: string) => {
    setPhotos(scannedPhotos)
    setIsScanning(false)
    if (hashes) {
      setCachedHashes(hashes)
    }
    if (directoryPath) {
      setCurrentProjectPath(directoryPath)
      
      // Auto-save the project
      try {
        const projectName = getProjectNameFromPath(directoryPath)
        saveProject(projectName, directoryPath, scannedPhotos, hashes, similarityThreshold)
        console.log(`Project "${projectName}" saved automatically`)
      } catch (error) {
        console.error('Failed to auto-save project:', error)
      }
    }
    setShowDirectorySelector(false)
  }

  const handleScanStart = () => {
    setIsScanning(true)
    setPhotos([])
    setCachedHashes(new Map())
  }

  const handleProjectSelect = (projectId: string) => {
    const projectData = loadProject(projectId)
    if (projectData) {
      setPhotos(projectData.photos)
      setCachedHashes(projectData.hashes)
      setSimilarityThreshold(projectData.threshold)
      setShowDirectorySelector(false)
      
      // Extract project path from photos
      if (projectData.photos.length > 0) {
        const firstPhotoPath = projectData.photos[0].path
        const pathParts = firstPhotoPath.split('/')
        pathParts.pop() // Remove filename
        setCurrentProjectPath(pathParts.join('/'))
      }
      
      console.log('Project loaded successfully')
    }
  }

  const handleNewProject = () => {
    setShowDirectorySelector(true)
  }

  const handleBackToProjects = () => {
    setPhotos([])
    setCachedHashes(new Map())
    setCurrentProjectPath('')
    setShowDirectorySelector(false)
    setCurrentView('all')
  }

  const handlePhotosDeleted = (deletedPhotoIds: string[]) => {
    // Remove deleted photos from the current photo list
    setPhotos(prevPhotos => prevPhotos.filter(photo => !deletedPhotoIds.includes(photo.id)))
    
    // Also remove from cached hashes
    setCachedHashes(prevHashes => {
      const newHashes = new Map(prevHashes)
      deletedPhotoIds.forEach(id => newHashes.delete(id))
      return newHashes
    })
    
    // Auto-save project with updated photo list
    if (currentProjectPath) {
      try {
        const projectName = getProjectNameFromPath(currentProjectPath)
        const updatedPhotos = photos.filter(photo => !deletedPhotoIds.includes(photo.id))
        const updatedHashes = new Map(cachedHashes)
        deletedPhotoIds.forEach(id => updatedHashes.delete(id))
        
        saveProject(projectName, currentProjectPath, updatedPhotos, updatedHashes, similarityThreshold)
        console.log(`Project "${projectName}" updated after deletion`)
      } catch (error) {
        console.error('Failed to update project after deletion:', error)
      }
    }
  }

  // Re-analyze duplicates when threshold changes
  useEffect(() => {
    if (photos.length > 0 && cachedHashes.size > 0 && !isScanning) {
      setIsReanalyzing(true)
      
      // Use cached hashes to re-detect duplicates with new threshold
      setTimeout(() => {
        try {
          console.log(`Re-analyzing duplicates with ${similarityThreshold}% threshold...`)
          
          // Reset all duplicate flags first
          const resetPhotos = photos.map(photo => ({
            ...photo,
            analysis: photo.analysis ? {
              ...photo.analysis,
              isDuplicate: false,
              duplicateGroup: undefined
            } : undefined
          }))
          
          // Find new duplicate groups with updated threshold
          const groups = findDuplicateGroups(cachedHashes, similarityThreshold)
          
          // Update photos with new duplicate information
          const updatedPhotos = resetPhotos.map(photo => {
            const group = groups.find(g => g.photos.includes(photo.id))
            if (group && photo.analysis) {
              return {
                ...photo,
                analysis: {
                  ...photo.analysis,
                  isDuplicate: true,
                  duplicateGroup: group.id
                }
              }
            }
            return photo
          })
          
          console.log(`Re-analysis complete: Found ${groups.length} duplicate groups`)
          setPhotos(updatedPhotos)
          
          // Auto-save project with updated threshold
          if (currentProjectPath) {
            try {
              const projectName = getProjectNameFromPath(currentProjectPath)
              saveProject(projectName, currentProjectPath, updatedPhotos, cachedHashes, similarityThreshold)
              console.log(`Project "${projectName}" updated with new threshold`)
            } catch (error) {
              console.error('Failed to update project:', error)
            }
          }
        } catch (error) {
          console.error('Error re-analyzing duplicates:', error)
        } finally {
          setIsReanalyzing(false)
        }
      }, 300) // Small delay for better UX
    }
  }, [similarityThreshold]) // Re-run when threshold changes

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Photo Cleaner</h1>
              
              {photos.length > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={handleBackToProjects}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to Projects</span>
                  </button>
                  {currentProjectPath && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {getProjectNameFromPath(currentProjectPath)}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {photos.length > 0 && (
                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentView('all')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      currentView === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    All Photos ({photos.length})
                  </button>
                  <button
                    onClick={() => setCurrentView('duplicates')}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      currentView === 'duplicates'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Duplicates ({photos.filter(p => p.analysis?.isDuplicate).length})
                  </button>
                </div>
              )}
              
              {photos.length > 0 && (
                <DuplicateSettings
                  similarityThreshold={similarityThreshold}
                  onThresholdChange={setSimilarityThreshold}
                  isReanalyzing={isReanalyzing}
                  totalPhotos={photos.length}
                  duplicateCount={photos.filter(p => p.analysis?.isDuplicate).length}
                />
              )}
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isScanning && photos.length === 0 && !showDirectorySelector && (
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            onNewProject={handleNewProject}
          />
        )}
        
        {!isScanning && photos.length === 0 && showDirectorySelector && (
          <DirectorySelector 
            onScanStart={handleScanStart} 
            onScanComplete={handleScanComplete}
            similarityThreshold={similarityThreshold}
          />
        )}
        
        {isScanning && <ScanProgress />}
        
        {photos.length > 0 && (
          <div className="space-y-4">
            {isReanalyzing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-blue-800 dark:text-blue-200 font-medium">Updating duplicate detection...</p>
                    <p className="text-blue-600 dark:text-blue-300 text-sm">Results will update automatically when complete</p>
                  </div>
                </div>
              </div>
            )}
            
            <PhotoGallery 
              photos={currentView === 'all' ? photos : photos.filter(p => p.analysis?.isDuplicate)}
              showDuplicatesOnly={currentView === 'duplicates'}
              onPhotosDeleted={handlePhotosDeleted}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
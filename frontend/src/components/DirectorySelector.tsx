import { useState } from 'react'
import { PhotoWithAnalysis } from '../../../shared/src/types'
import { detectDuplicatesInAnalyzableFiles } from '../utils/duplicateDetection'
import { groupRawJpegPairs, createPhotosFromPairs, getFilesToAnalyze } from '../utils/rawJpegPairing'
import { generateThumbnail, isThumbnailSupported, ThumbnailCache } from '../utils/thumbnailGenerator'
import { extractRawThumbnail, createRawPlaceholder, likelyHasEmbeddedJpeg } from '../utils/rawThumbnailExtractor'
import { analyzeImageQuality, QualitySettings, shouldAutoSelect, DEFAULT_QUALITY_SETTINGS } from '../utils/qualityAnalysis'
import QualitySettingsPanel from './QualitySettings'
import { ThumbnailService } from '../utils/thumbnailService'

interface DirectorySelectorProps {
  onScanStart: () => void
  onScanComplete: (photos: PhotoWithAnalysis[], hashes?: Map<string, any>, directoryPath?: string, autoSelectedIds?: Set<string>) => void
  similarityThreshold: number
}

export default function DirectorySelector({ onScanStart, onScanComplete, similarityThreshold }: DirectorySelectorProps) {
  const [selectedPath, setSelectedPath] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [processingStatus, setProcessingStatus] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(DEFAULT_QUALITY_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [thumbnailCache] = useState(() => new ThumbnailCache(200))
  const [thumbnailService] = useState(() => ThumbnailService.getInstance())

  const handleScan = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select a directory')
      return
    }

    setError('')
    setIsScanning(true)
    onScanStart()

    try {
      const totalSteps = qualitySettings.enableBlurDetection || qualitySettings.enableClosedEyeDetection ? 6 : 5
      let currentStepNum = 0

      // Step 1: Scan files
      currentStepNum++
      setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Scanning files`)
      setProcessingStatus('Scanning files...')
      setProgressPercent((currentStepNum - 1) / totalSteps * 100)
      
      // Group RAW+JPEG pairs and single files
      const { pairs, singleFiles } = groupRawJpegPairs(selectedFiles)
      
      console.log(`Found ${pairs.length} RAW+JPEG pairs and ${singleFiles.length} single files`)
      setProcessingStatus(`Found ${pairs.length} RAW+JPEG pairs and ${singleFiles.length} single files`)
      
      // Create photo objects from pairs and single files
      const photoFiles = createPhotosFromPairs(pairs, singleFiles)
      
      // Step 2: Generate thumbnails
      currentStepNum++
      setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Generating thumbnails`)
      setProgressPercent((currentStepNum - 1) / totalSteps * 100)
      
      await generateThumbnailsForPhotos(photoFiles, pairs, singleFiles, (current, total) => {
        const stepProgress = (current / total) * (1 / totalSteps) * 100
        const totalProgress = ((currentStepNum - 1) / totalSteps * 100) + stepProgress
        setProgressPercent(totalProgress)
        setProcessingStatus(`Generating thumbnails... ${current}/${total}`)
      })
      
      // Step 3: Upload thumbnails to backend
      currentStepNum++
      setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Uploading thumbnails`)
      setProgressPercent((currentStepNum - 1) / totalSteps * 100)
      
      await uploadThumbnailsToBackend(photoFiles, (current, total) => {
        const stepProgress = (current / total) * (1 / totalSteps) * 100
        const totalProgress = ((currentStepNum - 1) / totalSteps * 100) + stepProgress
        setProgressPercent(totalProgress)
        setProcessingStatus(`Uploading thumbnails... ${current}/${total}`)
      })
      
      // Step 4: Quality analysis (optional)
      const autoSelectedIds = new Set<string>()
      if (qualitySettings.enableBlurDetection || qualitySettings.enableClosedEyeDetection) {
        currentStepNum++
        setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Analyzing image quality`)
        setProgressPercent((currentStepNum - 1) / totalSteps * 100)
        
        await analyzeImageQualityForPhotos(photoFiles, pairs, singleFiles, autoSelectedIds, (current, total) => {
          const stepProgress = (current / total) * (1 / totalSteps) * 100
          const totalProgress = ((currentStepNum - 1) / totalSteps * 100) + stepProgress
          setProgressPercent(totalProgress)
          setProcessingStatus(`Analyzing quality... ${current}/${total}`)
        })
      }
      
      // Step 5: Duplicate detection
      currentStepNum++
      setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Detecting duplicates`)
      setProgressPercent((currentStepNum - 1) / totalSteps * 100)
      
      // Get files to analyze (skip RAW files that have JPEG pairs)
      const filesToAnalyze = getFilesToAnalyze(pairs, singleFiles)
      
      console.log(`Analyzing ${filesToAnalyze.length} files for duplicates (skipping RAW files with JPEG pairs)`)
      
      // Run duplicate detection only on analyzable files
      const { groups, hashes } = await detectDuplicatesInAnalyzableFiles(
        filesToAnalyze,
        (current, total) => {
          const stepProgress = (current / total) * (1 / totalSteps) * 100
          const totalProgress = ((currentStepNum - 1) / totalSteps * 100) + stepProgress
          setProgressPercent(totalProgress)
          setProcessingStatus(`Analyzing duplicates... ${current + 1}/${total}`)
        },
        similarityThreshold
      )
      
      // Step 6: Finalize
      currentStepNum++
      setCurrentStep(`Step ${currentStepNum}/${totalSteps}: Finalizing`)
      setProgressPercent((currentStepNum - 1) / totalSteps * 100)
      setProcessingStatus('Grouping duplicates...')
      
      // Update photos with duplicate information
      groups.forEach(group => {
        group.photos.forEach(photoId => {
          const photo = photoFiles.find(p => p.id === photoId)
          if (photo && photo.analysis) {
            photo.analysis.isDuplicate = true
            photo.analysis.duplicateGroup = group.id
            photo.analysis.hash = `hash_${group.id}`
          }
        })
      })
      
      console.log(`Analysis complete: Found ${groups.length} groups with duplicates`)
      
      setProgressPercent(100)
      setProcessingStatus('Complete!')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      onScanComplete(photoFiles, hashes, selectedPath, autoSelectedIds)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsScanning(false)
    }
  }

  const handleDirectorySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      // Get the directory path from the first file
      const firstFile = files[0]
      const pathParts = firstFile.webkitRelativePath.split('/')
      pathParts.pop() // Remove filename
      const directoryName = pathParts.join('/')
      
      // For display purposes, show the directory name
      setSelectedPath(directoryName || 'Selected Directory')
      
      // Store the FileList for processing
      setSelectedFiles(files)
    }
  }

  const generateThumbnailsForPhotos = async (
    photoFiles: PhotoWithAnalysis[],
    pairs: any[],
    singleFiles: { file: File; index: number }[],
    onProgress?: (current: number, total: number) => void
  ) => {
    let processed = 0
    const total = photoFiles.length

    for (const photo of photoFiles) {
      processed++
      onProgress?.(processed, total)

      try {
        let thumbnailDataUrl: string | undefined
        let originalFile: File | null = null

        if (photo.hasRawPair && photo.hasJpegPair) {
          // For RAW+JPEG pairs, use the JPEG file for thumbnails and store it as original
          const pair = pairs.find(p => p.baseId === photo.pairId)
          if (pair?.jpegFile) {
            originalFile = pair.jpegFile
            const thumbnail = await generateThumbnail(pair.jpegFile, { width: 600, height: 600, quality: 0.92 })
            thumbnailDataUrl = thumbnail.dataUrl
            thumbnailCache.set(photo.filename, thumbnailDataUrl)
          }
        } else if (photo.isRaw) {
          // For RAW-only files, store original and try to extract embedded preview
          const singleFile = singleFiles.find(sf => sf.file.name === photo.filename)
          if (singleFile) {
            originalFile = singleFile.file
            console.log(`Processing RAW file: ${photo.filename}`)
            
            // Always try extraction first - most RAW files have embedded previews
            try {
              const thumbnail = await extractRawThumbnail(singleFile.file)
              if (thumbnail) {
                console.log(`✅ Successfully extracted thumbnail from ${photo.filename}`)
                thumbnailDataUrl = thumbnail.dataUrl
                thumbnailCache.set(photo.filename, thumbnailDataUrl)
              } else {
                console.log(`⚠️  No embedded preview found in ${photo.filename}, creating placeholder`)
                // Create placeholder for RAW files without embedded preview
                const placeholder = await createRawPlaceholder(singleFile.file)
                thumbnailDataUrl = placeholder.dataUrl
                thumbnailCache.set(photo.filename, thumbnailDataUrl)
              }
            } catch (error) {
              console.warn(`❌ RAW extraction failed for ${photo.filename}:`, error)
              // Fallback to placeholder
              const placeholder = await createRawPlaceholder(singleFile.file)
              thumbnailDataUrl = placeholder.dataUrl
              thumbnailCache.set(photo.filename, thumbnailDataUrl)
            }
          }
        } else {
          // For regular image files, store original and generate thumbnail
          const singleFile = singleFiles.find(sf => sf.file.name === photo.filename)
          if (singleFile && isThumbnailSupported(singleFile.file)) {
            originalFile = singleFile.file
            const thumbnail = await generateThumbnail(singleFile.file, { width: 600, height: 600, quality: 0.92 })
            thumbnailDataUrl = thumbnail.dataUrl
            thumbnailCache.set(photo.filename, thumbnailDataUrl)
          }
        }

        // Store the original file for preview purposes
        if (originalFile) {
          thumbnailService.storeOriginalFile(photo.id, originalFile)
        }

        // Update the photo's analysis with the thumbnail
        if (photo.analysis && thumbnailDataUrl) {
          photo.analysis.thumbnailPath = thumbnailDataUrl
        }

      } catch (error) {
        console.warn(`Failed to generate thumbnail for ${photo.filename}:`, error)
        // Continue with other photos even if one fails
      }
    }
  }

  const analyzeImageQualityForPhotos = async (
    photoFiles: PhotoWithAnalysis[],
    pairs: any[],
    singleFiles: { file: File; index: number }[],
    autoSelectedIds: Set<string>,
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!qualitySettings.enableBlurDetection && !qualitySettings.enableClosedEyeDetection) {
      return
    }

    let processed = 0
    const total = photoFiles.length

    for (const photo of photoFiles) {
      processed++
      onProgress?.(processed, total)

      try {
        let fileToAnalyze: File | null = null

        if (photo.hasRawPair && photo.hasJpegPair) {
          const pair = pairs.find(p => p.baseId === photo.pairId)
          fileToAnalyze = pair?.jpegFile || null
        } else {
          const singleFile = singleFiles.find(sf => sf.file.name === photo.filename)
          fileToAnalyze = singleFile?.file || null
        }

        if (fileToAnalyze && isThumbnailSupported(fileToAnalyze)) {
          const qualityResult = await analyzeImageQuality(fileToAnalyze, qualitySettings)
          
          if (photo.analysis) {
            photo.analysis.blurScore = qualityResult.blurScore
            photo.analysis.hasClosedEyes = qualityResult.hasClosedEyes
            photo.analysis.faceCount = qualityResult.faceCount
            photo.analysis.qualityScore = qualityResult.qualityScore
          }

          if (shouldAutoSelect(qualityResult, qualitySettings)) {
            autoSelectedIds.add(photo.id)
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze quality for ${photo.filename}:`, error)
      }
    }
  }

  const uploadThumbnailsToBackend = async (
    photoFiles: PhotoWithAnalysis[],
    onProgress?: (current: number, total: number) => void
  ) => {
    const thumbnailsToUpload = photoFiles
      .filter(photo => photo.analysis?.thumbnailPath?.startsWith('data:'))
      .map(photo => ({
        photoId: photo.id,
        filename: photo.filename,
        dataUrl: photo.analysis!.thumbnailPath!
      }))

    if (thumbnailsToUpload.length === 0) {
      onProgress?.(1, 1)
      return
    }

    const uploadedPaths = await thumbnailService.uploadMultipleThumbnails(
      thumbnailsToUpload,
      onProgress
    )

    // Update photo objects with backend thumbnail paths
    for (const photo of photoFiles) {
      const backendPath = uploadedPaths.get(photo.id)
      if (backendPath && photo.analysis) {
        photo.analysis.thumbnailPath = backendPath
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Photo Cleaner
        </h2>
        <p className="text-gray-600 mb-8">
          Select a directory to scan for photos, detect duplicates, and clean up your collection.
        </p>

        <div className="space-y-6">
          {/* Analysis Settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Analysis Options
              </label>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>
            
            {showSettings && (
              <div className="mb-4">
                <QualitySettingsPanel
                  settings={qualitySettings}
                  onSettingsChange={setQualitySettings}
                />
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-sm text-blue-800">
                <p><strong>Quick Settings:</strong></p>
                <div className="mt-2 space-y-1">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={qualitySettings.enableBlurDetection}
                      onChange={(e) => setQualitySettings(prev => ({ ...prev, enableBlurDetection: e.target.checked }))}
                      className="mr-2 h-4 w-4 text-blue-600 rounded"
                    />
                    <span>Blur detection {qualitySettings.enableBlurDetection ? '(will slow down analysis)' : '(disabled for faster processing)'}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={qualitySettings.enableClosedEyeDetection}
                      onChange={(e) => setQualitySettings(prev => ({ ...prev, enableClosedEyeDetection: e.target.checked }))}
                      className="mr-2 h-4 w-4 text-blue-600 rounded"
                    />
                    <span>Closed eye detection {qualitySettings.enableClosedEyeDetection ? '(experimental, may be slow)' : '(disabled)'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="directory" className="block text-sm font-medium text-gray-700 mb-2">
              Select Photo Directory
            </label>
            <div className="flex flex-col space-y-2">
              <div className="relative">
                <input
                  type="file"
                  id="directory"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleDirectorySelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm text-gray-600">
                      Click to select a photo directory
                    </p>
                  </div>
                </div>
              </div>
              
              {selectedPath && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Selected:</strong> {selectedPath}
                  </p>
                  {selectedFiles && (
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedFiles.length} files found
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={isScanning || !selectedFiles}
            className={`w-full py-3 px-4 rounded-md font-medium ${
              isScanning || !selectedFiles
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            }`}
          >
            {isScanning ? processingStatus || 'Processing...' : 'Analyze Photos'}
          </button>
          
          {isScanning && (
            <div className="mt-4 space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{currentStep}</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Status text */}
              <div className="text-center">
                <div className="animate-spin mx-auto w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                <p className="text-sm text-gray-600">{processingStatus}</p>
              </div>
              
              {/* Analysis options reminder */}
              {(qualitySettings.enableBlurDetection || qualitySettings.enableClosedEyeDetection) && (
                <div className="text-xs text-gray-500 text-center">
                  Quality analysis is enabled. This may take longer but will provide better results.
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-500">
            <p><strong>Supported formats:</strong> JPG, PNG, HEIC, RAW (CR2, NEF, ARW, DNG)</p>
            <p><strong>Features:</strong> RAW+JPEG pairing, duplicate detection, blur analysis</p>
            <p><strong>Smart processing:</strong> RAW files with JPEG pairs use JPEG for analysis</p>
          </div>
        </div>
      </div>
    </div>
  )
}
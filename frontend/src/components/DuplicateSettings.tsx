import { useState } from 'react'

interface DuplicateSettingsProps {
  similarityThreshold: number
  onThresholdChange: (threshold: number) => void
  isReanalyzing?: boolean
  totalPhotos?: number
  duplicateCount?: number
}

export default function DuplicateSettings({ similarityThreshold, onThresholdChange, isReanalyzing, totalPhotos, duplicateCount }: DuplicateSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getThresholdDescription = (threshold: number) => {
    if (threshold >= 95) return 'Very Strict (only exact matches)'
    if (threshold >= 90) return 'Strict (very similar images)'
    if (threshold >= 85) return 'Normal (similar images)'
    if (threshold >= 80) return 'Loose (somewhat similar)'
    return 'Very Loose (may include unrelated images)'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-md transition-colors ${
          isReanalyzing 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        disabled={isReanalyzing}
      >
        {isReanalyzing ? (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        <span>{isReanalyzing ? 'Updating...' : 'Settings'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-10">
          <h3 className="font-medium text-gray-900 mb-3">Duplicate Detection Settings</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Similarity Threshold: {similarityThreshold}%
              </label>
              <input
                type="range"
                min="70"
                max="98"
                value={similarityThreshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Loose</span>
                <span>Strict</span>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <p className="font-medium">{getThresholdDescription(similarityThreshold)}</p>
              <p className="mt-1 text-xs">
                Higher values find fewer, more similar duplicates. Lower values find more potential duplicates but may include false positives.
              </p>
              
              {totalPhotos && duplicateCount !== undefined && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                  <p className="font-medium text-blue-800">
                    Current Results: {duplicateCount} of {totalPhotos} photos marked as duplicates
                  </p>
                  <p className="text-blue-600 mt-1">
                    Threshold changes update results in real-time
                  </p>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <strong>Tip:</strong> Start with 80% (Normal) and adjust based on your results.
                For RAW+JPEG pairs, try 80-85%. For burst photography, try 90-95%.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
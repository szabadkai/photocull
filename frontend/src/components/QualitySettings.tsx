import { QualitySettings } from '../utils/qualityAnalysis'

interface QualitySettingsProps {
  settings: QualitySettings
  onSettingsChange: (settings: QualitySettings) => void
}

export default function QualitySettingsPanel({ settings, onSettingsChange }: QualitySettingsProps) {
  const updateSetting = <K extends keyof QualitySettings>(
    key: K,
    value: QualitySettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Analysis Settings</h3>
      
      <div className="space-y-4">
        {/* Blur Detection Section */}
        <div className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableBlurDetection}
                onChange={(e) => updateSetting('enableBlurDetection', e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Blur Detection
              </span>
            </label>
            
            {settings.enableBlurDetection && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoSelectBlurry}
                  onChange={(e) => updateSetting('autoSelectBlurry', e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-xs text-gray-600">
                  Auto-select blurry photos
                </span>
              </label>
            )}
          </div>
          
          {settings.enableBlurDetection && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Blur Threshold: {settings.blurThreshold}
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Sharp</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={settings.blurThreshold}
                  onChange={(e) => updateSetting('blurThreshold', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500">Blurry</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Photos with blur score below {settings.blurThreshold} will be marked as blurry
              </p>
            </div>
          )}
        </div>

        {/* Closed Eye Detection Section */}
        <div className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableClosedEyeDetection}
                onChange={(e) => updateSetting('enableClosedEyeDetection', e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Closed Eye Detection
              </span>
            </label>
            
            {settings.enableClosedEyeDetection && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoSelectClosedEyes}
                  onChange={(e) => updateSetting('autoSelectClosedEyes', e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-xs text-gray-600">
                  Auto-select closed eye photos
                </span>
              </label>
            )}
          </div>
          
          {settings.enableClosedEyeDetection && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Face detection requires a modern browser and may not be available on all devices.
                This feature uses experimental web APIs.
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="text-xs text-gray-500">
          <p><strong>Blur Detection:</strong> Uses Laplacian variance to detect image sharpness</p>
          <p><strong>Closed Eye Detection:</strong> Analyzes facial landmarks to detect closed eyes</p>
          <p><strong>Auto-selection:</strong> Automatically marks poor quality photos for deletion</p>
        </div>
      </div>
    </div>
  )
}
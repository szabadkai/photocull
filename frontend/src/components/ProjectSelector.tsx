import { useState, useEffect } from 'react'
import { SavedProject, getSavedProjects, deleteProject, formatDate, formatFileSize } from '../utils/projectStorage'

interface ProjectSelectorProps {
  onProjectSelect: (projectId: string) => void
  onNewProject: () => void
}

export default function ProjectSelector({ onProjectSelect, onNewProject }: ProjectSelectorProps) {
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = () => {
    const projects = getSavedProjects()
    setSavedProjects(projects)
  }

  const handleDeleteProject = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowDeleteConfirm(projectId)
  }

  const confirmDelete = (projectId: string) => {
    try {
      deleteProject(projectId)
      loadProjects()
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const getTotalSize = (project: SavedProject) => {
    return project.photos.reduce((total, photo) => total + photo.size, 0)
  }

  if (savedProjects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">📁</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Photo Cleaner
          </h2>
          <p className="text-gray-600 mb-8">
            Start by selecting a directory to scan for photos, detect duplicates, and clean up your collection.
          </p>
          <button
            onClick={onNewProject}
            className="w-full py-3 px-6 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Select Photo Directory
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Projects</h2>
            <p className="text-gray-600">Continue working on a previous analysis or start a new one</p>
          </div>
          <button
            onClick={onNewProject}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            New Project
          </button>
        </div>

        <div className="grid gap-4">
          {savedProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project.id)}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="text-2xl">📁</div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate max-w-md">
                        {project.directoryPath}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Photos:</span>
                      <br />
                      {project.photoCount}
                    </div>
                    <div>
                      <span className="font-medium">Duplicates:</span>
                      <br />
                      <span className={project.duplicateCount > 0 ? 'text-orange-600 font-medium' : ''}>
                        {project.duplicateCount}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Total Size:</span>
                      <br />
                      {formatFileSize(getTotalSize(project))}
                    </div>
                    <div>
                      <span className="font-medium">Last Modified:</span>
                      <br />
                      {formatDate(project.lastModified)}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>Threshold: {project.similarityThreshold}%</span>
                    {project.duplicateCount > 0 && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                        {project.duplicateCount} duplicates found
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Delete Project
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this project? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
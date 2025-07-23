import { PhotoWithAnalysis } from '../../../shared/src/types'

export interface SavedProject {
  id: string
  name: string
  directoryPath: string
  createdAt: string
  lastModified: string
  photoCount: number
  duplicateCount: number
  similarityThreshold: number
  photos: PhotoWithAnalysis[]
  hashes: Record<string, any> // Serialized version of Map
}

const PROJECTS_STORAGE_KEY = 'photo-cleaner-projects'

/**
 * Get all saved projects from localStorage
 */
export function getSavedProjects(): SavedProject[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (!stored) return []
    
    const projects = JSON.parse(stored) as SavedProject[]
    
    // Convert date strings back to Date objects in photos
    return projects.map(project => ({
      ...project,
      photos: project.photos.map(photo => ({
        ...photo,
        createdAt: photo.createdAt,
        modifiedAt: photo.modifiedAt
      }))
    }))
  } catch (error) {
    console.error('Error loading saved projects:', error)
    return []
  }
}

/**
 * Save a project to localStorage
 */
export function saveProject(
  name: string,
  directoryPath: string,
  photos: PhotoWithAnalysis[],
  hashes: Map<string, any>,
  similarityThreshold: number
): SavedProject {
  try {
    const projects = getSavedProjects()
    
    // Check if project with this path already exists
    const existingIndex = projects.findIndex(p => p.directoryPath === directoryPath)
    
    const projectId = existingIndex >= 0 ? projects[existingIndex].id : generateProjectId()
    const now = new Date().toISOString()
    
    // Create a copy of photos without large thumbnail data to save space
    const lightweightPhotos = photos.map(photo => ({
      ...photo,
      analysis: photo.analysis ? {
        ...photo.analysis,
        // Keep only the thumbnail path reference, not the full data URL
        thumbnailPath: photo.analysis.thumbnailPath?.startsWith('data:') 
          ? `cached_${photo.filename}` 
          : photo.analysis.thumbnailPath
      } : undefined
    }))
    
    const project: SavedProject = {
      id: projectId,
      name,
      directoryPath,
      createdAt: existingIndex >= 0 ? projects[existingIndex].createdAt : now,
      lastModified: now,
      photoCount: photos.length,
      duplicateCount: photos.filter(p => p.analysis?.isDuplicate).length,
      similarityThreshold,
      photos: lightweightPhotos,
      hashes: Object.fromEntries(hashes) // Convert Map to Object for JSON serialization
    }
    
    if (existingIndex >= 0) {
      projects[existingIndex] = project
    } else {
      projects.push(project)
    }
    
    // Keep only last 10 projects to avoid localStorage bloat
    const trimmedProjects = projects
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, 10)
    
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(trimmedProjects))
    
    return project
  } catch (error) {
    console.error('Error saving project:', error)
    throw new Error('Failed to save project')
  }
}

/**
 * Load a specific project
 */
export function loadProject(projectId: string): { photos: PhotoWithAnalysis[], hashes: Map<string, any>, threshold: number } | null {
  try {
    const projects = getSavedProjects()
    const project = projects.find(p => p.id === projectId)
    
    if (!project) return null
    
    // Convert hashes back to Map
    const hashes = new Map(Object.entries(project.hashes))
    
    return {
      photos: project.photos,
      hashes,
      threshold: project.similarityThreshold
    }
  } catch (error) {
    console.error('Error loading project:', error)
    return null
  }
}

/**
 * Delete a project
 */
export function deleteProject(projectId: string): void {
  try {
    const projects = getSavedProjects()
    const filteredProjects = projects.filter(p => p.id !== projectId)
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(filteredProjects))
  } catch (error) {
    console.error('Error deleting project:', error)
    throw new Error('Failed to delete project')
  }
}

/**
 * Generate a unique project ID
 */
function generateProjectId(): string {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get project name from directory path
 */
export function getProjectNameFromPath(directoryPath: string): string {
  if (!directoryPath) return 'Unnamed Project'
  
  // Extract the last folder name from the path
  const parts = directoryPath.split(/[/\\]/)
  const lastPart = parts[parts.length - 1] || parts[parts.length - 2]
  
  return lastPart || 'Unnamed Project'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}
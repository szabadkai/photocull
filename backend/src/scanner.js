import fs from 'fs-extra';
import { join, extname, basename } from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { statements } from './database.js';

const SUPPORTED_FORMATS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif',
  '.cr2', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef',
  '.heic', '.heif', '.avif'
]);

const RAW_FORMATS = new Set([
  '.cr2', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef'
]);

class DirectoryScanner {
  constructor() {
    this.isScanning = false;
    this.progress = {
      totalFiles: 0,
      processedFiles: 0,
      currentFile: '',
      phase: 'scanning'
    };
    this.thumbnailsDir = null;
  }

  // Helper function to get/create thumbnails directory
  async getThumbnailsDirectory(scanDirectory) {
    if (!this.thumbnailsDir) {
      this.thumbnailsDir = join(scanDirectory, '_thumbnails');
      try {
        await fs.access(this.thumbnailsDir);
      } catch {
        await fs.mkdir(this.thumbnailsDir, { recursive: true });
      }
    }
    return this.thumbnailsDir;
  }

  async scanDirectory(directoryPath) {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    try {
      this.isScanning = true;
      this.thumbnailsDir = null; // Reset thumbnails directory for new scan
      this.progress = {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: '',
        phase: 'scanning'
      };

      console.log(`Starting scan of directory: ${directoryPath}`);
      
      // Setup thumbnails directory
      const thumbnailsDir = await this.getThumbnailsDirectory(directoryPath);
      console.log(`Thumbnails directory created/verified: ${thumbnailsDir}`);
      
      // First pass: count files
      const files = await this.findImageFiles(directoryPath);
      this.progress.totalFiles = files.length;
      this.progress.phase = 'analyzing';

      console.log(`Found ${files.length} image files`);

      // Second pass: process files and generate thumbnails
      const photos = [];
      for (const filePath of files) {
        this.progress.currentFile = basename(filePath);
        
        try {
          const photo = await this.processFile(filePath, directoryPath);
          if (photo) {
            photos.push(photo);
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error.message);
        }
        
        this.progress.processedFiles++;
      }

      this.progress.phase = 'complete';
      return photos;

    } finally {
      this.isScanning = false;
    }
  }

  async findImageFiles(directoryPath) {
    const files = [];
    
    async function scanRecursive(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip hidden directories and common non-photo directories
            if (!entry.name.startsWith('.') && 
                !['node_modules', 'thumbs', '_thumbnails'].includes(entry.name.toLowerCase())) {
              await scanRecursive(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (SUPPORTED_FORMATS.has(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error.message);
      }
    }
    
    await scanRecursive(directoryPath);
    return files;
  }

  async processFile(filePath, scanDirectory) {
    try {
      const stats = await fs.stat(filePath);
      const ext = extname(filePath).toLowerCase();
      const filename = basename(filePath);
      const photoId = uuidv4();
      
      // Generate thumbnail during scan
      const thumbnailUrl = await this.generateThumbnail(photoId, filePath, scanDirectory);
      
      const photo = {
        id: photoId,
        path: filePath,
        filename: filename,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        format: ext.slice(1), // Remove the dot
        isRaw: RAW_FORMATS.has(ext),
        thumbnailUrl: thumbnailUrl
      };

      // Save to database
      statements.insertPhoto.run(
        photo.id,
        photo.path,
        photo.filename,
        photo.size,
        photo.createdAt,
        photo.modifiedAt,
        null, // width - will be filled by image processor
        null, // height - will be filled by image processor
        photo.format,
        photo.isRaw ? 1 : 0
      );

      return photo;

    } catch (error) {
      throw new Error(`Failed to process file ${filePath}: ${error.message}`);
    }
  }

  async generateThumbnail(photoId, filePath, scanDirectory) {
    try {
      const thumbnailsDir = await this.getThumbnailsDirectory(scanDirectory);
      const ext = extname(filePath).toLowerCase();
      const thumbnailFilename = `thumb_${photoId}_${Date.now()}${ext}`;
      const thumbnailPath = join(thumbnailsDir, thumbnailFilename);
      
      console.log(`Generating thumbnail for ${basename(filePath)}`);
      console.log(`Thumbnail will be saved to: ${thumbnailPath}`);
      
      // For now, just copy the original file as a "thumbnail"
      // In production, you'd want to use Sharp or similar to resize
      await fs.copy(filePath, thumbnailPath);
      
      // Verify the file was created
      const stats = await fs.stat(thumbnailPath);
      console.log(`Thumbnail created successfully: ${thumbnailFilename} (${stats.size} bytes)`);
      
      return `/api/thumbnails/${thumbnailFilename}`;
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${filePath}:`, error.message);
      console.error(`Error details:`, error);
      return null;
    }
  }

  getProgress() {
    return { ...this.progress };
  }
}

export default DirectoryScanner;
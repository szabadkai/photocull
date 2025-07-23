// import sharp from 'sharp'; // Disabled due to Node.js version compatibility
import { createHash } from 'crypto';
import imageHash from 'imghash';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { statements } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ImageProcessor {
  constructor() {
    this.thumbnailDir = join(__dirname, '../../database/thumbnails');
    this.ensureThumbnailDir();
  }

  async ensureThumbnailDir() {
    await fs.ensureDir(this.thumbnailDir);
  }

  async processImage(photoId, filePath) {
    try {
      console.log(`Processing image: ${basename(filePath)}`);
      
      // Get image metadata and generate thumbnail
      const metadata = await this.getImageMetadata(filePath);
      const thumbnailPath = await this.generateThumbnail(photoId, filePath);
      
      // Calculate perceptual hash for duplicate detection
      const hash = await this.calculateHash(filePath);
      
      // Calculate blur score
      const blurScore = await this.calculateBlurScore(filePath);
      
      // Update photo dimensions in database
      if (metadata.width && metadata.height) {
        const updatePhoto = statements.db.prepare(
          'UPDATE photos SET width = ?, height = ? WHERE id = ?'
        );
        updatePhoto.run(metadata.width, metadata.height, photoId);
      }

      // Save analysis results
      statements.insertAnalysis.run(
        photoId,
        hash,
        blurScore,
        null, // quality_score - could be implemented later
        false, // is_duplicate - will be updated by duplicate detection
        null, // duplicate_group - will be set by duplicate detection
        thumbnailPath
      );

      return {
        photoId,
        hash,
        blurScore,
        thumbnailPath,
        metadata
      };

    } catch (error) {
      console.error(`Error processing image ${filePath}:`, error.message);
      throw error;
    }
  }

  async getImageMetadata(filePath) {
    try {
      // Placeholder for metadata extraction - would use sharp in production
      console.log(`Getting metadata for ${basename(filePath)}`);
      return {
        width: 1920,
        height: 1080,
        format: 'jpeg'
      };
    } catch (error) {
      console.warn(`Could not read metadata for ${filePath}: ${error.message}`);
      return {};
    }
  }

  async generateThumbnail(photoId, filePath) {
    const thumbnailFilename = `${photoId}_thumb.jpg`;
    const thumbnailPath = join(this.thumbnailDir, thumbnailFilename);
    
    try {
      // Placeholder for thumbnail generation - would use sharp in production
      console.log(`Generating thumbnail for ${basename(filePath)}`);
      
      // For now, just copy the original file as a "thumbnail"
      await fs.copy(filePath, thumbnailPath);
      
      return thumbnailPath;
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${filePath}:`, error.message);
      return null;
    }
  }

  async calculateHash(filePath) {
    try {
      // Use perceptual hashing for duplicate detection
      const hash = await imageHash.hash(filePath, 16, 'hex');
      return hash;
    } catch (error) {
      console.warn(`Could not calculate hash for ${filePath}: ${error.message}`);
      // Fallback to file content hash
      const buffer = await fs.readFile(filePath);
      return createHash('md5').update(buffer).digest('hex');
    }
  }

  async calculateBlurScore(filePath) {
    try {
      // Placeholder for blur detection - would use sharp in production
      console.log(`Calculating blur score for ${basename(filePath)}`);
      
      // Return a random blur score for testing
      return Math.random() * 1000;
    } catch (error) {
      console.warn(`Could not calculate blur score for ${filePath}: ${error.message}`);
      return null;
    }
  }

  async detectDuplicates() {
    console.log('Starting duplicate detection...');
    
    const photos = statements.db.prepare(`
      SELECT pa.photo_id, pa.hash 
      FROM photo_analysis pa 
      WHERE pa.hash IS NOT NULL
    `).all();

    const hashGroups = new Map();
    
    // Group photos by hash
    for (const photo of photos) {
      if (!hashGroups.has(photo.hash)) {
        hashGroups.set(photo.hash, []);
      }
      hashGroups.get(photo.hash).push(photo.photo_id);
    }

    // Mark duplicates and assign group IDs
    let duplicateGroups = 0;
    for (const [hash, photoIds] of hashGroups) {
      if (photoIds.length > 1) {
        duplicateGroups++;
        const groupId = `dup_group_${duplicateGroups}`;
        
        // Mark all photos in this group as duplicates
        const updateDuplicate = statements.db.prepare(`
          UPDATE photo_analysis 
          SET is_duplicate = 1, duplicate_group = ? 
          WHERE photo_id = ?
        `);
        
        for (const photoId of photoIds) {
          updateDuplicate.run(groupId, photoId);
        }
        
        console.log(`Found duplicate group ${groupId} with ${photoIds.length} photos`);
      }
    }

    console.log(`Duplicate detection complete. Found ${duplicateGroups} duplicate groups.`);
    return duplicateGroups;
  }
}

export default ImageProcessor;
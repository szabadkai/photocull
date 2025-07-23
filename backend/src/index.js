import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import DirectoryScanner from "./scanner.js";
import ImageProcessor from "./imageProcessor.js";
import { statements } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const scanner = new DirectoryScanner();
const imageProcessor = new ImageProcessor();

// Helper function to get/create thumbnails directory in the scanned project folder
async function getThumbnailsDirectory() {
    // Use the current scan directory or fall back to project root
    const baseDir = currentScanDirectory || join(__dirname, "../../");
    const thumbnailsDir = join(baseDir, "_thumbnails");

    try {
        await fs.access(thumbnailsDir);
    } catch {
        await fs.mkdir(thumbnailsDir, { recursive: true });
    }

    return thumbnailsDir;
}

// Store the scanned directory for trash purposes
let currentScanDirectory = null;

// Helper function to get/create trash directory in the scanned project folder
async function getTrashDirectory() {
    const baseDir = currentScanDirectory;
    const trashDir = join(baseDir, ".trash");

    try {
        await fs.access(trashDir);
    } catch {
        await fs.mkdir(trashDir, { recursive: true });
    }

    return trashDir;
}

// Helper function to get all trash files from the current project's trash directory
async function getAllTrashFiles() {
    const allFiles = [];

    try {
        const trashDir = await getTrashDirectory();
        const files = await fs.readdir(trashDir);

        for (const file of files) {
            if (file.endsWith(".metadata.json")) {
                const metadataPath = join(trashDir, file);
                const metadata = JSON.parse(
                    await fs.readFile(metadataPath, "utf8")
                );
                metadata.trashDir = trashDir;
                allFiles.push(metadata);
            }
        }
    } catch (error) {
        console.warn(`Could not read trash directory:`, error.message);
    }

    return allFiles;
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Photo Cleaner API is running" });
});

app.post("/api/scan", async (req, res) => {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ error: "Path parameter is required" });
    }

    try {
        // Store the scan directory for trash operations
        currentScanDirectory = path;

        const photos = await scanner.scanDirectory(path);
        res.json({
            message: `Scan completed`,
            photosFound: photos.length,
            photos: photos,
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
        });
    }
});

app.get("/api/scan/progress", (req, res) => {
    res.json(scanner.getProgress());
});

app.post("/api/process", async (req, res) => {
    try {
        const photos = statements.getPhotosWithAnalysis.all();
        const unprocessedPhotos = photos.filter((photo) => !photo.hash);

        console.log(
            `Processing ${unprocessedPhotos.length} unprocessed photos`
        );

        for (const photo of unprocessedPhotos) {
            try {
                await imageProcessor.processImage(photo.id, photo.path);
            } catch (error) {
                console.error(
                    `Failed to process ${photo.path}:`,
                    error.message
                );
            }
        }

        // Run duplicate detection
        const duplicateGroups = await imageProcessor.detectDuplicates();

        res.json({
            message: "Processing completed",
            processedPhotos: unprocessedPhotos.length,
            duplicateGroups,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/photos", (req, res) => {
    try {
        const photos = statements.getPhotosWithAnalysis.all();
        res.json(photos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/photos/duplicates", (req, res) => {
    try {
        const duplicates = statements.db
            .prepare(
                `
      SELECT p.*, pa.hash, pa.blur_score, pa.quality_score, pa.duplicate_group, pa.thumbnail_path
      FROM photos p
      JOIN photo_analysis pa ON p.id = pa.photo_id
      WHERE pa.is_duplicate = 1
      ORDER BY pa.duplicate_group, p.modified_at DESC
    `
            )
            .all();

        res.json(duplicates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File deletion endpoints
app.post("/api/photos/move-to-trash", async (req, res) => {
    try {
        const { photos } = req.body;
        if (!photos || !Array.isArray(photos)) {
            return res.status(400).json({ error: "Photos array is required" });
        }

        const deletedFiles = [];
        const trashMetadata = [];

        for (const photo of photos) {
            try {
                // Ensure we have a valid absolute path
                let absolutePath = photo.path;
                if (!absolutePath) {
                    console.error(`No path provided for photo ${photo.id}`);
                    continue;
                }

                // If path is relative, make it absolute (relative to current working directory)
                if (!absolutePath.startsWith("/")) {
                    absolutePath = join(process.cwd(), absolutePath);
                }

                // Check if file exists before trying to move it
                try {
                    await fs.access(absolutePath);
                } catch (error) {
                    console.error(`File not found: ${absolutePath}`);
                    continue;
                }

                // Get trash directory for the scanned project folder
                const trashDir = await getTrashDirectory();

                // Create unique filename in trash (use original filename without any display modifications)
                const timestamp = Date.now();
                const originalFilename = photo.filename.replace(
                    /\s*\([^)]*\)/g,
                    ""
                ); // Remove any parenthetical additions like "(RAW+JPEG)"
                const trashFilename = `${timestamp}_${originalFilename}`;
                const trashPath = join(trashDir, trashFilename);

                console.log(`Moving ${absolutePath} to ${trashPath}`);

                // Move file to trash
                await fs.rename(absolutePath, trashPath);

                // Store metadata
                const metadata = {
                    id: photo.id,
                    originalPath: absolutePath,
                    filename: originalFilename,
                    size: photo.size,
                    deletedAt: new Date().toISOString(),
                    tempPath: trashPath,
                };

                trashMetadata.push(metadata);
                deletedFiles.push(metadata);

                // Save metadata to file
                const metadataPath = join(
                    trashDir,
                    `${trashFilename}.metadata.json`
                );
                await fs.writeFile(
                    metadataPath,
                    JSON.stringify(metadata, null, 2)
                );
            } catch (error) {
                console.error(
                    `Failed to move ${photo.filename} to trash:`,
                    error
                );
                console.error(`Photo data:`, JSON.stringify(photo, null, 2));
            }
        }

        res.json({
            success: true,
            deletedFiles,
            message: `Moved ${deletedFiles.length} files to trash`,
        });
    } catch (error) {
        console.error("Error moving files to trash:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/photos/empty-trash", async (req, res) => {
    try {
        const trashFiles = await getAllTrashFiles();
        let deletedCount = 0;

        for (const metadata of trashFiles) {
            try {
                // Delete the actual file
                if (metadata.tempPath) {
                    await fs.unlink(metadata.tempPath);
                    deletedCount++;
                }

                // Delete the metadata file
                const metadataFilename = metadata.tempPath
                    ? `${metadata.tempPath.split("/").pop()}.metadata.json`
                    : `${metadata.id}.metadata.json`;
                const metadataPath = join(metadata.trashDir, metadataFilename);
                await fs.unlink(metadataPath);
            } catch (error) {
                console.error(`Failed to delete ${metadata.filename}:`, error);
            }
        }

        res.json({
            success: true,
            message: `Permanently deleted ${deletedCount} files`,
            deletedCount,
        });
    } catch (error) {
        console.error("Error emptying trash:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/photos/restore-from-trash", async (req, res) => {
    try {
        const { fileIds } = req.body;
        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: "FileIds array is required" });
        }

        const restoredFiles = [];
        const trashFiles = await getAllTrashFiles();

        for (const fileId of fileIds) {
            // Find the metadata for this file ID
            const metadata = trashFiles.find((m) => m.id === fileId);

            if (metadata) {
                try {
                    // Restore the file to its original location
                    await fs.rename(metadata.tempPath, metadata.originalPath);

                    // Remove metadata file
                    const metadataFilename = metadata.tempPath
                        ? `${metadata.tempPath.split("/").pop()}.metadata.json`
                        : `${metadata.id}.metadata.json`;
                    const metadataPath = join(
                        metadata.trashDir,
                        metadataFilename
                    );
                    await fs.unlink(metadataPath);

                    restoredFiles.push(metadata);
                } catch (error) {
                    console.error(`Failed to restore file ${fileId}:`, error);
                }
            }
        }

        res.json({
            success: true,
            restoredFiles,
            message: `Restored ${restoredFiles.length} files`,
        });
    } catch (error) {
        console.error("Error restoring files:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/photos/trash-status", async (req, res) => {
    try {
        const deletedFiles = await getAllTrashFiles();
        const totalSize = deletedFiles.reduce(
            (sum, file) => sum + (file.size || 0),
            0
        );

        res.json({
            fileCount: deletedFiles.length,
            totalSize,
            deletedFiles,
        });
    } catch (error) {
        console.error("Error getting trash status:", error);
        res.status(500).json({ error: error.message });
    }
});

// Serve thumbnails (support both file system and data URLs)
app.get("/api/thumbnails/:filename", async (req, res) => {
    try {
        const thumbnailsDir = await getThumbnailsDirectory();
        const thumbnailPath = join(thumbnailsDir, req.params.filename);
        res.sendFile(thumbnailPath, (err) => {
            if (err) {
                console.error("Thumbnail not found:", req.params.filename);
                res.status(404).json({ error: "Thumbnail not found" });
            }
        });
    } catch (error) {
        console.error("Error serving thumbnail:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get thumbnail info
app.get("/api/thumbnails/:filename/info", async (req, res) => {
    try {
        const thumbnailsDir = await getThumbnailsDirectory();
        const thumbnailPath = join(thumbnailsDir, req.params.filename);
        const stats = await fs.stat(thumbnailPath);

        res.json({
            filename: req.params.filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
        });
    } catch (error) {
        res.status(404).json({ error: "Thumbnail not found" });
    }
});

// Store original image files temporarily for preview
const ORIGINALS_DIR = join(__dirname, "../../originals");
async function ensureOriginalsDir() {
    try {
        await fs.access(ORIGINALS_DIR);
    } catch {
        await fs.mkdir(ORIGINALS_DIR, { recursive: true });
    }
}
ensureOriginalsDir();

// Upload original image for preview
app.post("/api/photos/upload-original", async (req, res) => {
    try {
        const { photoId, filename, dataUrl } = req.body;

        if (!photoId || !filename || !dataUrl) {
            return res.status(400).json({
                error: "Missing required fields: photoId, filename, dataUrl",
            });
        }

        // Extract base64 data from data URL
        const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: "Invalid data URL format" });
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // Generate filename for original
        const ext = filename.split(".").pop() || "jpg";
        const originalFilename = `original_${photoId}_${Date.now()}.${ext}`;
        const originalPath = join(ORIGINALS_DIR, originalFilename);

        // Save original to file system
        await fs.writeFile(originalPath, base64Data, "base64");

        res.json({
            success: true,
            originalPath: `/api/photos/${photoId}/original`,
            filename: originalFilename,
        });
    } catch (error) {
        console.error("Error uploading original:", error);
        res.status(500).json({ error: error.message });
    }
});

// Serve original images
app.get("/api/photos/:photoId/original", (req, res) => {
    try {
        // Find the original file for this photo ID
        fs.readdir(ORIGINALS_DIR)
            .then((files) => {
                const originalFile = files.find(
                    (file) =>
                        file.startsWith(`original_${req.params.photoId}_`) &&
                        !file.endsWith(".metadata.json")
                );

                if (originalFile) {
                    const originalPath = join(ORIGINALS_DIR, originalFile);
                    res.sendFile(originalPath, (err) => {
                        if (err) {
                            console.error(
                                "Original image not found:",
                                originalFile
                            );
                            res.status(404).json({
                                error: "Original image not found",
                            });
                        }
                    });
                } else {
                    res.status(404).json({
                        error: "Original image not found for this photo ID",
                    });
                }
            })
            .catch((error) => {
                console.error("Error reading originals directory:", error);
                res.status(500).json({ error: "Internal server error" });
            });
    } catch (error) {
        console.error("Error serving original image:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Photo Cleaner API running on http://localhost:${PORT}`);
});

export interface ThumbnailOptions {
    width: number;
    height: number;
    quality: number;
    format: "jpeg" | "webp";
}

export interface ThumbnailResult {
    dataUrl: string;
    blob: Blob;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
    width: 800,
    height: 800,
    quality: 0.92,
    format: "jpeg",
};

/**
 * Generate a thumbnail from a File object
 */
export async function generateThumbnail(
    file: File,
    options: Partial<ThumbnailOptions> = {}
): Promise<ThumbnailResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        img.onload = () => {
            try {
                const originalWidth = img.naturalWidth;
                const originalHeight = img.naturalHeight;

                // Calculate dimensions maintaining aspect ratio
                const { width, height } = calculateThumbnailDimensions(
                    originalWidth,
                    originalHeight,
                    opts.width,
                    opts.height
                );

                // Set canvas size
                canvas.width = width;
                canvas.height = height;

                // Enable highest quality smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                
                // Additional quality settings
                ctx.globalCompositeOperation = 'source-over';
                
                // Clear canvas with white background for better JPEG compression
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // Draw and scale the image
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(
                                new Error("Failed to create thumbnail blob")
                            );
                            return;
                        }

                        const dataUrl = canvas.toDataURL(
                            `image/${opts.format}`,
                            opts.quality
                        );

                        resolve({
                            dataUrl,
                            blob,
                            width,
                            height,
                            originalWidth,
                            originalHeight,
                        });
                    },
                    `image/${opts.format}`,
                    opts.quality
                );
            } catch (error) {
                reject(error);
            } finally {
                // Clean up
                URL.revokeObjectURL(img.src);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        // Load the image
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Calculate thumbnail dimensions maintaining aspect ratio
 */
function calculateThumbnailDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = maxWidth;
    let height = maxHeight;

    if (originalWidth > originalHeight) {
        // Landscape orientation
        height = width / aspectRatio;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
    } else {
        // Portrait or square orientation
        width = height * aspectRatio;
        if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
        }
    }

    return {
        width: Math.round(width),
        height: Math.round(height),
    };
}

/**
 * Generate thumbnail for multiple files with progress tracking
 */
export async function generateThumbnails(
    files: File[],
    onProgress?: (current: number, total: number, filename: string) => void,
    options: Partial<ThumbnailOptions> = {}
): Promise<Map<string, ThumbnailResult>> {
    const thumbnails = new Map<string, ThumbnailResult>();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        onProgress?.(i, files.length, file.name);

        try {
            const thumbnail = await generateThumbnail(file, opts);
            thumbnails.set(file.name, thumbnail);
        } catch (error) {
            console.warn(
                `Failed to generate thumbnail for ${file.name}:`,
                error
            );
            // Continue with other files even if one fails
        }
    }

    onProgress?.(files.length, files.length, "");

    return thumbnails;
}

/**
 * Check if a file type is supported for thumbnail generation
 */
export function isThumbnailSupported(file: File): boolean {
    // Standard image formats that browsers can load
    const supportedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml",
    ];

    // Check MIME type
    if (supportedTypes.includes(file.type.toLowerCase())) {
        return true;
    }

    // Check file extension for cases where MIME type might be missing
    const supportedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp",
        ".svg",
    ];

    const fileName = file.name.toLowerCase();
    return supportedExtensions.some((ext) => fileName.endsWith(ext));
}

/**
 * Extract EXIF orientation and apply rotation if needed
 */
export async function generateOrientedThumbnail(
    file: File,
    options: Partial<ThumbnailOptions> = {}
): Promise<ThumbnailResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        img.onload = () => {
            try {
                const originalWidth = img.naturalWidth;
                const originalHeight = img.naturalHeight;

                // Calculate dimensions
                const { width, height } = calculateThumbnailDimensions(
                    originalWidth,
                    originalHeight,
                    opts.width,
                    opts.height
                );

                // Set canvas size
                canvas.width = width;
                canvas.height = height;

                // Configure highest quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                
                // Additional quality settings
                ctx.globalCompositeOperation = 'source-over';
                
                // Clear canvas with white background for better JPEG compression
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // TODO: Extract EXIF orientation and apply rotation
                // For now, just draw the image normally
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(
                                new Error("Failed to create thumbnail blob")
                            );
                            return;
                        }

                        const dataUrl = canvas.toDataURL(
                            `image/${opts.format}`,
                            opts.quality
                        );

                        resolve({
                            dataUrl,
                            blob,
                            width,
                            height,
                            originalWidth,
                            originalHeight,
                        });
                    },
                    `image/${opts.format}`,
                    opts.quality
                );
            } catch (error) {
                reject(error);
            } finally {
                URL.revokeObjectURL(img.src);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Create a thumbnail cache manager
 */
export class ThumbnailCache {
    private cache = new Map<string, string>(); // filename -> dataURL
    private maxSize: number;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }

    set(filename: string, dataUrl: string): void {
        // If cache is full, remove oldest entry
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(filename, dataUrl);
    }

    get(filename: string): string | undefined {
        return this.cache.get(filename);
    }

    has(filename: string): boolean {
        return this.cache.has(filename);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

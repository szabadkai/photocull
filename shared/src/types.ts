export interface PhotoMetadata {
  id: string;
  path: string;
  filename: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  width?: number;
  height?: number;
  format: string;
  isRaw: boolean;
  hasRawPair?: boolean;
  hasJpegPair?: boolean;
  pairId?: string;
}

export interface PhotoAnalysis {
  photoId: string;
  hash: string;
  blurScore?: number;
  qualityScore?: number;
  isDuplicate: boolean;
  duplicateGroup?: string;
  thumbnailPath?: string;
}

export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  phase: 'scanning' | 'analyzing' | 'complete';
}

export interface PhotoWithAnalysis extends PhotoMetadata {
  analysis?: PhotoAnalysis;
}
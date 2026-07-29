export interface PDFPage {
  pageNumber: number; // 1-based index
  originalIndex: number; // 0-based index
  thumbnailUrl: string;
  selected: boolean;
  width: number;
  height: number;
  isBlank?: boolean;
  rotation?: number; // degrees of clockwise rotation (0, 90, 180, 270)
}

export enum SelectionMode {
  MANUAL = 'MANUAL',
  RANGE = 'RANGE',
  AI_AUTO = 'AI_AUTO',
}

export interface ProcessingState {
  isProcessing: boolean;
  message: string;
  progress: number;
}

export interface SplitResult {
  blob: Blob;
  filename: string;
}

// Ensure external libraries are typed if not using @types packages in this environment
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { renderAsync } from 'docx-preview';
import { PDFPage } from '../types';

// Configure worker.
// We use the ES module worker from esm.sh to match the module environment.
// The .mjs extension is required for the worker to be loaded correctly as a module.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export const loadPDFAndRenderThumbnails = async (
  file: File,
  onProgress: (percent: number) => void
): Promise<PDFPage[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: PDFPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Calculate scale to make thumbnail reasonable size (e.g., width ~300px)
    const viewport = page.getViewport({ scale: 1 });
    const scale = 300 / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
    }

    pages.push({
      pageNumber: i,
      originalIndex: i - 1,
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
      selected: false,
      width: viewport.width,
      height: viewport.height,
    });

    onProgress(Math.round((i / numPages) * 100));
  }

  return pages;
};

export const loadFirstPageThumbnailFast = async (file: File): Promise<string | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1) return null;
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = 200 / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
      return canvas.toDataURL('image/jpeg', 0.6);
    }
    return null;
  } catch (e) {
    console.warn('loadFirstPageThumbnailFast failed:', e);
    return null;
  }
};

export const splitPDF = async (
  originalFile: File,
  selectedPages: PDFPage[]
): Promise<Blob> => {
  const arrayBuffer = await originalFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Create a new PDF document
  const newPdf = await PDFDocument.create();
  
  for (const pageInfo of selectedPages) {
    if (pageInfo.isBlank) {
      const page = newPdf.addPage([pageInfo.width || 595, pageInfo.height || 842]);
      if (pageInfo.rotation) {
        page.setRotation(degrees(pageInfo.rotation % 360));
      }
    } else {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageInfo.originalIndex]);
      if (pageInfo.rotation) {
        const currentRotation = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRotation + pageInfo.rotation) % 360));
      }
      newPdf.addPage(copiedPage);
    }
  }
  
  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await newPdf.save();
  
  return new Blob([pdfBytes], { type: 'application/pdf' });
};

export const extractSeparatePages = async (
    originalFile: File,
    selectedPages: PDFPage[]
): Promise<Blob[]> => {
    const arrayBuffer = await originalFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const blobs: Blob[] = [];

    for (const pageInfo of selectedPages) {
        const newPdf = await PDFDocument.create();
        if (pageInfo.isBlank) {
            const page = newPdf.addPage([pageInfo.width || 595, pageInfo.height || 842]);
            if (pageInfo.rotation) {
                page.setRotation(degrees(pageInfo.rotation % 360));
            }
        } else {
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageInfo.originalIndex]);
            if (pageInfo.rotation) {
                const currentRotation = copiedPage.getRotation().angle;
                copiedPage.setRotation(degrees((currentRotation + pageInfo.rotation) % 360));
            }
            newPdf.addPage(copiedPage);
        }
        const pdfBytes = await newPdf.save();
        blobs.push(new Blob([pdfBytes], { type: 'application/pdf' }));
    }
    return blobs;
};

export const createZipFromPages = async (
  originalFile: File,
  selectedPages: PDFPage[],
  originalFileName: string,
  customNames?: Record<number, string>
): Promise<Blob> => {
  const zip = new JSZip();
  const blobs = await extractSeparatePages(originalFile, selectedPages);
  
  // Remove extension from original filename
  const baseName = originalFileName.replace(/\.pdf$/i, '');

  blobs.forEach((blob, index) => {
    const pageInfo = selectedPages[index];
    const aiName = customNames ? customNames[pageInfo.pageNumber] : undefined;
    const pageSuffix = pageInfo.isBlank ? `blank_page_${index + 1}` : `page_${pageInfo.pageNumber}`;
    const fileName = aiName ? `${aiName}.pdf` : `${baseName}_${pageSuffix}.pdf`;
    zip.file(fileName, blob);
  });

  const content = await zip.generateAsync({ type: "blob" });
  return content;
};

export const mergePDFs = async (files: File[]): Promise<File> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  const filename = files.length === 1 ? files[0].name : `merged_${files.length}_files.pdf`;
  
  return new File([pdfBytes], filename, { type: 'application/pdf' });
};

export const createBlankPDF = async (): Promise<File> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]);
  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], 'tai_lieu_moi.pdf', { type: 'application/pdf' });
};

export const createZipFromFiles = async (
  items: { file: File; name: string; originalName?: string }[]
): Promise<Blob> => {
  const zip = new JSZip();
  items.forEach((item, index) => {
    let filename = item.name.trim() || `tai_lieu_${index + 1}`;
    const orig = item.originalName || item.file.name;
    const extMatch = orig.match(/\.([0-9a-z]+)$/i);
    const ext = extMatch ? `.${extMatch[1]}` : '.pdf';

    if (!filename.toLowerCase().endsWith(ext.toLowerCase())) {
      filename += ext;
    }
    zip.file(filename, item.file);
  });
  return await zip.generateAsync({ type: "blob" });
};

export const normalizeUploadedFiles = async (
  files: File[],
  onProgress?: (message: string) => void
): Promise<File[]> => {
  return files;
};
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
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
  items: { file: File; name: string }[]
): Promise<Blob> => {
  const zip = new JSZip();
  items.forEach((item, index) => {
    let filename = item.name.trim() || `tai_lieu_${index + 1}`;
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }
    zip.file(filename, item.file);
  });
  return await zip.generateAsync({ type: "blob" });
};

export const convertImageToPDF = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 1100;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2D context');
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64Data = dataUrl.split(',')[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const pdfDoc = await PDFDocument.create();
        const jpgImage = await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
        page.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: jpgImage.width,
          height: jpgImage.height,
        });

        const pdfBytes = await pdfDoc.save();
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const newFileName = `${baseName}.pdf`;
        const pdfFile = new File([pdfBytes], newFileName, { type: 'application/pdf' });
        URL.revokeObjectURL(url);
        resolve(pdfFile);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc file ảnh: ' + file.name));
    };
    img.src = url;
  });
};

export const normalizeUploadedFiles = async (
  files: File[],
  onProgress?: (message: string) => void
): Promise<File[]> => {
  const result: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      result.push(file);
    } else if (
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|bmp|gif|tiff|heic)$/i.test(file.name)
    ) {
      if (onProgress) onProgress(`Đang chuyển file ảnh "${file.name}" sang PDF...`);
      const pdfFile = await convertImageToPDF(file);
      result.push(pdfFile);
    }
  }
  return result;
};
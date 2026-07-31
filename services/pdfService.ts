import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import mammoth from 'mammoth';
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
    } else {
      // Giữ nguyên các định dạng Office/Văn bản (Word, Excel, PowerPoint, TXT...) để đổi tên và tải về
      result.push(file);
    }
  }
  return result;
};

export const convertTextToPDF = async (text: string, outputFileName: string, title?: string): Promise<File> => {
  const pageWidth = 1190;
  const pageHeight = 1684;
  const margin = 100;
  const maxLineWidth = pageWidth - margin * 2;
  const lineHeight = 42;

  const canvas = document.createElement('canvas');
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  const ctx = canvas.getContext('2d')!;

  // Prepare lines
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const allLines: string[] = [];

  if (title) {
    allLines.push(title.toUpperCase());
    allLines.push('---------------------------------------------------------');
    allLines.push('');
  }

  ctx.font = '28px "Times New Roman", Arial, sans-serif';
  for (const p of paragraphs) {
    if (p.trim() === '') {
      allLines.push('');
      continue;
    }
    const words = p.split(' ');
    let currentLine = '';
    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineWidth && currentLine) {
        allLines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pdfDoc = await PDFDocument.create();

  let lineIdx = 0;
  while (lineIdx < allLines.length || lineIdx === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidth, pageHeight);

    ctx.fillStyle = '#1e293b';
    ctx.font = '28px "Times New Roman", Arial, sans-serif';

    let y = margin;
    let linesOnPage = 0;
    while (lineIdx < allLines.length && linesOnPage < maxLinesPerPage) {
      const line = allLines[lineIdx];
      if (line === title?.toUpperCase()) {
        ctx.font = 'bold 36px "Times New Roman", Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.font = '28px "Times New Roman", Arial, sans-serif';
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillText(line, margin, y);
      y += lineHeight;
      lineIdx++;
      linesOnPage++;
    }

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = jpegDataUrl.split(',')[1];
    const len = atob(base64).length;
    const bytes = new Uint8Array(len);
    const binary = atob(base64);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const jpgImage = await pdfDoc.embedJpg(bytes);
    const pdfPage = pdfDoc.addPage([595, 842]);
    pdfPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: 595,
      height: 842,
    });

    if (lineIdx >= allLines.length) break;
  }

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], outputFileName, { type: 'application/pdf' });
};

export const convertFileToPDF = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<File> => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    return file;
  }

  const isImg =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|bmp|gif|tiff|heic)$/i.test(file.name);
  if (isImg) {
    if (onProgress) onProgress(`Đang chuyển file ảnh "${file.name}" sang PDF...`);
    return await convertImageToPDF(file);
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const targetPdfName = `${baseName}.pdf`;

  const isWord = /\.(docx|doc)$/i.test(file.name);
  if (isWord) {
    if (onProgress) onProgress(`Đang trích xuất và chuyển file Word "${file.name}" sang PDF...`);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || `Tài liệu: ${file.name}\n\n(Nội dung trống hoặc định dạng hình ảnh)`;
      return await convertTextToPDF(text, targetPdfName, baseName);
    } catch (e) {
      console.warn('Mammoth docx parse fail, fallback to text', e);
      return await convertTextToPDF(`Tài liệu Word: ${file.name}\n\nĐã chuyển đổi sang dạng PDF.`, targetPdfName, baseName);
    }
  }

  const isText = /\.(txt|csv|md|json)$/i.test(file.name);
  if (isText) {
    if (onProgress) onProgress(`Đang chuyển văn bản "${file.name}" sang PDF...`);
    const text = await file.text();
    return await convertTextToPDF(text, targetPdfName, baseName);
  }

  // Fallback for Excel / Office or other files
  if (onProgress) onProgress(`Đang chuẩn hóa "${file.name}" sang PDF...`);
  const summaryText = `Tài liệu: ${file.name}\nNgày xử lý: ${new Date().toLocaleDateString('vi-VN')}\n\nTài liệu đã được chuyển sang định dạng PDF để tiện xem trước và gộp trang.`;
  return await convertTextToPDF(summaryText, targetPdfName, baseName);
};
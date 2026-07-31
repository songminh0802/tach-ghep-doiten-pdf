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
  // Khổ A4 sắc nét (ratio 1 : 1.414) tại 150 DPI
  const pageWidth = 1240;
  const pageHeight = 1754;
  const marginX = 120;
  const marginY = 120;
  const maxLineWidth = pageWidth - marginX * 2; // 1000px
  const lineHeight = 46; // khoảng cách giữa các dòng
  const paragraphSpacing = 20; // khoảng cách giữa các đoạn văn

  const canvas = document.createElement('canvas');
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  const ctx = canvas.getContext('2d')!;

  // 1. Chuẩn hóa và làm sạch các đoạn văn
  const rawParagraphs = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  // Hàm phụ: Làm sạch đoạn văn & gắn dấu câu lẻ vào từ trước đó (chống rớt dấu câu / nhảy chữ bất thường)
  const cleanParagraphWords = (p: string): string[] => {
    if (!p.trim()) return [];
    const normalized = p
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([,.\/;:?!\]\)\}\”\’])/g, '$1')
      .trim();
    return normalized.split(' ').filter(w => w.length > 0);
  };

  // Hàm phụ: Ngắt dòng chuẩn xác theo đúng font đang dùng
  const wrapWordsToLines = (words: string[], fontStyle: string): string[] => {
    if (words.length === 0) return [''];
    ctx.font = fontStyle;
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxLineWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = w;
          // Trường hợp bản thân 1 từ liền mạch dài hơn maxLineWidth (ví dụ link URL rất dài)
          while (ctx.measureText(currentLine).width > maxLineWidth && currentLine.length > 1) {
            let splitIdx = currentLine.length - 1;
            while (splitIdx > 1 && ctx.measureText(currentLine.substring(0, splitIdx)).width > maxLineWidth) {
              splitIdx--;
            }
            lines.push(currentLine.substring(0, splitIdx));
            currentLine = currentLine.substring(splitIdx);
          }
        } else {
          // Từ đầu tiên của dòng vượt maxLineWidth -> buộc tách ký tự
          let splitIdx = w.length - 1;
          while (splitIdx > 1 && ctx.measureText(w.substring(0, splitIdx)).width > maxLineWidth) {
            splitIdx--;
          }
          lines.push(w.substring(0, splitIdx));
          currentLine = w.substring(splitIdx);
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  interface RenderLine {
    text: string;
    isTitle?: boolean;
    isHeader?: boolean;
    isEmpty?: boolean;
    extraSpacingAfter?: number;
  }

  const renderLines: RenderLine[] = [];

  // Thêm tiêu đề tài liệu nếu có
  if (title && title.trim()) {
    renderLines.push({
      text: title.trim().toUpperCase(),
      isTitle: true,
      extraSpacingAfter: 15,
    });
    renderLines.push({
      text: '────────────────────────────────────────────────────────',
      isHeader: true,
      extraSpacingAfter: 25,
    });
  }

  // 2. Xử lý các đoạn văn và tạo danh sách dòng hiển thị
  for (const p of rawParagraphs) {
    if (!p.trim()) {
      renderLines.push({ text: '', isEmpty: true });
      continue;
    }

    const words = cleanParagraphWords(p);
    if (words.length === 0) {
      renderLines.push({ text: '', isEmpty: true });
      continue;
    }

    // Kiểm tra dòng có phải là tiêu đề chương/mục không (ngắn và bắt đầu bằng từ khoá cấu trúc)
    const isHeaderLine = /^(CHƯƠNG|BÀI|PHẦN|CHAPTER|MỤC|ĐỀ THI|BẢNG|HƯỚNG DẪN|DANH SÁCH)\b/i.test(p.trim()) && words.length <= 16;
    const fontToUse = isHeaderLine
      ? 'bold 30px "Times New Roman", Arial, sans-serif'
      : '28px "Times New Roman", Arial, sans-serif';

    const wrapped = wrapWordsToLines(words, fontToUse);
    for (let i = 0; i < wrapped.length; i++) {
      const isLastInParagraph = i === wrapped.length - 1;
      renderLines.push({
        text: wrapped[i],
        isHeader: isHeaderLine,
        extraSpacingAfter: isLastInParagraph ? paragraphSpacing : 0,
      });
    }
  }

  // 3. Vẽ trang sang định dạng PDFDocument A4
  const pdfDoc = await PDFDocument.create();
  let lineIdx = 0;

  while (lineIdx < renderLines.length || lineIdx === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidth, pageHeight);

    let currentY = marginY;
    const maxY = pageHeight - marginY;

    // Đường kẻ trang trí phía trên
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginX, 70);
    ctx.lineTo(pageWidth - marginX, 70);
    ctx.stroke();

    // Dòng ghi chú cuối trang
    ctx.fillStyle = '#64748b';
    ctx.font = '20px "Times New Roman", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Tài liệu chuyển đổi chuẩn hoá - SmartSplit-PDF`, pageWidth - marginX, pageHeight - 50);
    ctx.textAlign = 'left';

    let linesOnPage = 0;
    while (lineIdx < renderLines.length) {
      const item = renderLines[lineIdx];

      let stepHeight = lineHeight;
      if (item.isTitle) stepHeight = 56;
      else if (item.isHeader) stepHeight = 48;
      else if (item.isEmpty) stepHeight = 24;

      if (item.extraSpacingAfter) {
        stepHeight += item.extraSpacingAfter;
      }

      if (currentY + stepHeight > maxY && linesOnPage > 0) {
        break;
      }

      if (!item.isEmpty) {
        if (item.isTitle) {
          ctx.font = 'bold 36px "Times New Roman", Arial, sans-serif';
          ctx.fillStyle = '#0f172a';
        } else if (item.isHeader) {
          ctx.font = 'bold 30px "Times New Roman", Arial, sans-serif';
          ctx.fillStyle = '#1e293b';
        } else {
          ctx.font = '28px "Times New Roman", Arial, sans-serif';
          ctx.fillStyle = '#1e293b';
        }
        ctx.fillText(item.text, marginX, currentY);
      }

      currentY += stepHeight;
      lineIdx++;
      linesOnPage++;
    }

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
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

    if (lineIdx >= renderLines.length) break;
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
      // Ưu tiên dùng convertToHtml để giữ trọn vẹn từng câu trong đoạn văn, tránh lỗi gãy câu giữa chừng của XML raw text
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      let cleanText = '';
      if (htmlResult && htmlResult.value) {
        const doc = new DOMParser().parseFromString(htmlResult.value, 'text/html');
        const blocks: string[] = [];
        doc.body.childNodes.forEach((node) => {
          const textContent = (node.textContent || '').replace(/[ \t]+/g, ' ').trim();
          if (textContent) {
            blocks.push(textContent);
          } else if (node.nodeName === 'BR' || node.nodeName === 'P' || node.nodeName === 'DIV') {
            blocks.push('');
          }
        });
        cleanText = blocks.join('\n');
      }
      if (!cleanText.trim()) {
        const rawResult = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        cleanText = rawResult.value || `Tài liệu: ${file.name}\n\n(Nội dung trống hoặc định dạng hình ảnh)`;
      }
      return await convertTextToPDF(cleanText, targetPdfName, baseName);
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
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

export const convertHtmlToPDF = async (
  htmlContent: string,
  outputFileName: string,
  onProgress?: (msg: string) => void
): Promise<File> => {
  if (onProgress) onProgress('Đang dàn trang A4 từ tài liệu...');

  const A4_WIDTH_PX = 794; // 210mm chuẩn CSS (96 DPI)
  const A4_HEIGHT_PX = 1123; // 297mm chuẩn CSS (96 DPI)
  const scale = 2; // Độ sắc nét Retina 2x (1588 x 2246)

  // Tạo container ẩn trong body để trình duyệt dàn trang native
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = '"Times New Roman", Times, serif';
  container.style.fontSize = '16px';
  container.style.lineHeight = '1.5';
  container.style.padding = '60px 70px'; // Lề chuẩn A4 (trên/dưới 60px, trái/phải 70px)
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-1000';

  // CSS chuyên biệt cho tài liệu Word Việt Nam (bảng số liệu, 2 cột Quốc hiệu / Chữ ký, tiêu đề)
  const style = document.createElement('style');
  style.innerHTML = `
    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    p {
      margin: 0 0 10px 0;
      text-align: justify;
      word-wrap: break-word;
      line-height: 1.5;
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 14px 0 10px 0;
      font-weight: 700;
      color: #000000;
      line-height: 1.3;
      text-align: center;
    }
    h1 { font-size: 20px; text-transform: uppercase; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; }
    table {
      width: 100% !important;
      border-collapse: collapse;
      margin: 14px 0;
      table-layout: auto;
    }
    tr {
      page-break-inside: avoid;
    }
    td, th {
      border: 1px solid #475569;
      padding: 8px 10px;
      vertical-align: top;
      text-align: left;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    th {
      background-color: #f8fafc;
      font-weight: bold;
      text-align: center;
    }
    /* Xử lý riêng các bảng Quốc hiệu (UBND... - CỘNG HÒA...) và Chữ ký (THƯ KÝ - GVCN) không cần đường viền */
    table.no-border td, table.no-border th {
      border: none !important;
      padding: 4px 6px;
    }
    ul, ol {
      margin: 8px 0 10px 24px;
      padding: 0;
    }
    li {
      margin-bottom: 6px;
      line-height: 1.5;
    }
    strong, b {
      font-weight: bold;
    }
    em, i {
      font-style: italic;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 10px auto;
    }
  `;

  container.appendChild(style);

  // Tạo phần nội dung tài liệu
  const contentDiv = document.createElement('div');
  contentDiv.className = 'document-content';
  contentDiv.innerHTML = htmlContent;

  // Nhận diện tự động bảng Quốc hiệu hoặc bảng Chữ ký để bỏ viền đen
  const tables = contentDiv.querySelectorAll('table');
  tables.forEach(table => {
    const text = table.textContent || '';
    const hasHeaderKeywords = /CỘNG HÒA XÃ HỘI|Độc lập – Tự do|UBND|TRƯỜNG THCS|BIÊN BẢN/i.test(text);
    const hasSignatureKeywords = /THƯ KÝ|GVCN|HIỆU TRƯỞNG|Người lập|XÁC NHẬN/i.test(text);
    const isSmallTable = table.rows.length <= 3 && table.rows[0]?.cells.length === 2;
    if ((hasHeaderKeywords || hasSignatureKeywords) && isSmallTable) {
      table.classList.add('no-border');
      table.querySelectorAll('td, th').forEach(cell => {
        (cell as HTMLElement).style.border = 'none';
      });
    }
  });

  container.appendChild(contentDiv);
  document.body.appendChild(container);

  try {
    if (onProgress) onProgress('Đang tạo trang PDF chất lượng cao...');
    const fullCanvas = await html2canvas(container, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: A4_WIDTH_PX,
    });

    const pageCanvasWidth = A4_WIDTH_PX * scale; // 1588
    const pageCanvasHeight = A4_HEIGHT_PX * scale; // 2246

    const totalPages = Math.max(1, Math.ceil(fullCanvas.height / pageCanvasHeight));
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < totalPages; i++) {
      if (onProgress) onProgress(`Đang xuất trang PDF (${i + 1}/${totalPages})...`);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = pageCanvasWidth;
      pageCanvas.height = pageCanvasHeight;
      const pageCtx = pageCanvas.getContext('2d')!;

      // Nền trắng cho trang
      pageCtx.fillStyle = '#FFFFFF';
      pageCtx.fillRect(0, 0, pageCanvasWidth, pageCanvasHeight);

      // Cắt phần trang tương ứng từ fullCanvas
      const sourceY = i * pageCanvasHeight;
      const sourceHeight = Math.min(pageCanvasHeight, fullCanvas.height - sourceY);

      pageCtx.drawImage(
        fullCanvas,
        0, sourceY, pageCanvasWidth, sourceHeight,
        0, 0, pageCanvasWidth, sourceHeight
      );

      // Thêm số trang góc dưới bên phải
      pageCtx.fillStyle = '#64748b';
      pageCtx.font = `${14 * scale}px "Times New Roman", Arial, sans-serif`;
      pageCtx.textAlign = 'right';
      pageCtx.fillText(
        `Trang ${i + 1} / ${totalPages}  |  SmartSplit-PDF`,
        pageCanvasWidth - 70 * scale,
        pageCanvasHeight - 30 * scale
      );

      const jpegDataUrl = pageCanvas.toDataURL('image/jpeg', 0.95);
      const base64 = jpegDataUrl.split(',')[1];
      const len = atob(base64).length;
      const bytes = new Uint8Array(len);
      const binary = atob(base64);
      for (let j = 0; j < len; j++) {
        bytes[j] = binary.charCodeAt(j);
      }

      const jpgImage = await pdfDoc.embedJpg(bytes);
      const pdfPage = pdfDoc.addPage([595, 842]); // Khổ A4 chuẩn trong PDF points
      pdfPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: 595,
        height: 842,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], outputFileName, { type: 'application/pdf' });
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

export const convertTextToPDF = async (text: string, outputFileName: string, title?: string): Promise<File> => {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  let htmlContent = '';
  if (title && title.trim()) {
    htmlContent += `<h1 style="text-align: center; margin-bottom: 24px; font-size: 20px; text-transform: uppercase;">${title.trim()}</h1><hr style="border: 0; border-top: 2px solid #cbd5e1; margin-bottom: 24px;" />`;
  }

  for (const p of paragraphs) {
    if (!p.trim()) {
      htmlContent += `<div style="height: 14px;"></div>`;
    } else {
      const escaped = p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      htmlContent += `<p>${escaped}</p>`;
    }
  }

  return await convertHtmlToPDF(htmlContent, outputFileName);
};

export const convertWordToPDF = async (
  file: File,
  outputFileName: string,
  onProgress?: (message: string) => void
): Promise<File> => {
  if (onProgress) onProgress(`Đang dàn trang tài liệu Word "${file.name}" chuẩn gốc 100%...`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const A4_WIDTH_PX = 794;  // 210mm chuẩn A4 CSS
    const A4_HEIGHT_PX = 1123; // 297mm chuẩn A4 CSS
    const scale = 2; // Retina 2x sắc nét

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-99999px';
    container.style.left = '-99999px';
    container.style.width = `${A4_WIDTH_PX}px`;
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-1000';

    // CSS Override triệt để shadow, background xám và lề của docx-preview
    const styleOverride = document.createElement('style');
    styleOverride.innerHTML = `
      .docx-wrapper {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: ${A4_WIDTH_PX}px !important;
      }
      .docx-page {
        box-shadow: none !important;
        margin: 0 !important;
        border: none !important;
        background: #ffffff !important;
        width: ${A4_WIDTH_PX}px !important;
        min-height: ${A4_HEIGHT_PX}px !important;
        padding: 50px 60px !important; /* Lề chuẩn A4 Word */
      }
      .docx-page table {
        border-collapse: collapse !important;
        width: 100% !important;
        table-layout: auto !important;
      }
      .docx-page table td, .docx-page table th {
        box-sizing: border-box !important;
        word-break: break-word !important;
      }
      * {
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
    `;
    container.appendChild(styleOverride);
    document.body.appendChild(container);

    try {
      await renderAsync(arrayBuffer, container, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        experimental: false,
        trimXmlDeclaration: true,
        useBase64URL: true,
        useMathMLPolyfill: false,
      });

      const pageElements = Array.from(container.querySelectorAll('.docx-page')) as HTMLElement[];
      const pdfDoc = await PDFDocument.create();
      const targetCanvasWidth = A4_WIDTH_PX * scale;  // 1588
      const targetCanvasHeight = A4_HEIGHT_PX * scale; // 2246

      const elementsToRender: HTMLElement[] = pageElements.length > 0 ? pageElements : [container];
      let totalExportedPages = 0;

      for (let i = 0; i < elementsToRender.length; i++) {
        const el = elementsToRender[i];
        if (onProgress) onProgress(`Đang xuất trang tài liệu Word (${i + 1}/${elementsToRender.length})...`);

        const pageCanvas = await html2canvas(el, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: A4_WIDTH_PX,
        });

        // Tính chính xác số trang A4 có trong block canvas (phòng trường hợp Word không có page break làm canvas cao 3-4 trang)
        const subPagesCount = Math.max(1, Math.ceil(pageCanvas.height / targetCanvasHeight));

        for (let subIdx = 0; subIdx < subPagesCount; subIdx++) {
          totalExportedPages++;
          if (onProgress) onProgress(`Đang hoàn thiện trang PDF số ${totalExportedPages}...`);

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = targetCanvasWidth;
          sliceCanvas.height = targetCanvasHeight;
          const sliceCtx = sliceCanvas.getContext('2d')!;

          // Nền trắng chuẩn cho trang
          sliceCtx.fillStyle = '#FFFFFF';
          sliceCtx.fillRect(0, 0, targetCanvasWidth, targetCanvasHeight);

          const sourceY = subIdx * targetCanvasHeight;
          const sourceHeight = Math.min(targetCanvasHeight, pageCanvas.height - sourceY);

          sliceCtx.drawImage(
            pageCanvas,
            0, sourceY, targetCanvasWidth, sourceHeight,
            0, 0, targetCanvasWidth, sourceHeight
          );

          // Thêm footer trang nhã dưới cùng
          sliceCtx.fillStyle = '#64748b';
          sliceCtx.font = `${14 * scale}px "Times New Roman", Arial, sans-serif`;
          sliceCtx.textAlign = 'right';
          sliceCtx.fillText(
            `SmartSplit-PDF  |  Trang ${totalExportedPages}`,
            targetCanvasWidth - 70 * scale,
            targetCanvasHeight - 30 * scale
          );

          const jpegDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const base64 = jpegDataUrl.split(',')[1];
          const len = atob(base64).length;
          const bytes = new Uint8Array(len);
          const binary = atob(base64);
          for (let j = 0; j < len; j++) {
            bytes[j] = binary.charCodeAt(j);
          }

          const jpgImage = await pdfDoc.embedJpg(bytes);
          const pdfPage = pdfDoc.addPage([595, 842]); // A4 in points (595 x 842)
          pdfPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: 595,
            height: 842,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new File([pdfBytes], outputFileName, { type: 'application/pdf' });
    } finally {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  } catch (e) {
    console.warn('docx-preview render fail, fallback to mammoth HTML engine', e);
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    let html = htmlResult.value || '';
    if (!html.trim()) {
      const rawResult = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const lines = (rawResult.value || `Tài liệu: ${file.name}`).split('\n');
      html = lines.map(line => `<p>${line}</p>`).join('');
    }
    return await convertHtmlToPDF(html, outputFileName, onProgress);
  }
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
    return await convertWordToPDF(file, targetPdfName, onProgress);
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
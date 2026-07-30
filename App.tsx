import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, AlertCircle, Sparkles, RefreshCw, Download, Split, Merge, FileStack, FileText, Plus, Eye, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { loadPDFAndRenderThumbnails, loadFirstPageThumbnailFast, splitPDF, extractSeparatePages, createZipFromPages, mergePDFs, createBlankPDF, createZipFromFiles, normalizeUploadedFiles } from './services/pdfService';
import { analyzeSplitPoints, suggestFileNameWithAI, suggestBatchFileNamesWithAI, suggestChapterNamesWithAI } from './services/geminiService';
import { PDFPage, SelectionMode, ProcessingState, UploadedFileItem } from './types';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(SelectionMode.MANUAL);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    message: '',
    progress: 0,
  });
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiNaming, setIsAiNaming] = useState(false);
  const [useAiChapterNaming, setUseAiChapterNaming] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // UX Suite: History Stack (Undo / Redo)
  const [history, setHistory] = useState<PDFPage[][]>([]);
  const [future, setFuture] = useState<PDFPage[][]>([]);

  const updatePagesWithHistory = useCallback((updater: (prev: PDFPage[]) => PDFPage[]) => {
    setPages(currentPages => {
      const nextPages = updater(currentPages);
      if (nextPages !== currentPages) {
        setHistory(prev => [...prev.slice(-25), currentPages]); // retain last 25 states
        setFuture([]);
      }
      return nextPages;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setFuture(prev => [pages, ...prev]);
    setPages(lastState);
    setHistory(prev => prev.slice(0, prev.length - 1));
  }, [history, pages]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory(prev => [...prev, pages]);
    setPages(nextState);
    setFuture(prev => prev.slice(1));
  }, [future, pages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // UX Suite: Smart Page Selection
  const handleSelectRange = useCallback((targetPageNumbers: number[]) => {
    updatePagesWithHistory(prev => prev.map(p => ({
      ...p,
      selected: targetPageNumbers.includes(p.pageNumber)
    })));
  }, [updatePagesWithHistory]);

  const handleSelectEven = useCallback(() => {
    updatePagesWithHistory(prev => prev.map(p => ({
      ...p,
      selected: p.pageNumber % 2 === 0
    })));
  }, [updatePagesWithHistory]);

  const handleSelectOdd = useCallback(() => {
    updatePagesWithHistory(prev => prev.map(p => ({
      ...p,
      selected: p.pageNumber % 2 !== 0
    })));
  }, [updatePagesWithHistory]);

  const handleInvertSelection = useCallback(() => {
    updatePagesWithHistory(prev => prev.map(p => ({
      ...p,
      selected: !p.selected
    })));
  }, [updatePagesWithHistory]);

  const handleSelectBlank = useCallback(() => {
    updatePagesWithHistory(prev => prev.map(p => ({
      ...p,
      selected: Boolean(p.isBlank)
    })));
  }, [updatePagesWithHistory]);

  // Handle File Upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    
    // Explicitly cast to File[] to avoid 'unknown' type inference issues from Array.from(fileList)
    const files = Array.from(fileList) as File[];
    // Cho phép tải lên TẤT CẢ định dạng tài liệu (PDF, Word, Excel, PowerPoint, ZIP, ảnh...) để Đổi tên & Tải về
    setProcessingState({ isProcessing: true, message: files.length > 1 ? 'Đang chuẩn bị danh sách tài liệu...' : 'Đang xử lý tài liệu...', progress: 0 });
    setError(null);

    try {
      const normalizedFiles = await normalizeUploadedFiles(files, (msg) => {
        setProcessingState(prev => ({ ...prev, message: msg }));
      });
      if (normalizedFiles.length === 0) return;

      const items: UploadedFileItem[] = files.map((f, index) => {
        return {
          id: `${f.name}-${index}-${Date.now()}`,
          file: f,
          originalName: f.name,
          customName: f.name.replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|webp|bmp|gif|tiff|heic|zip|rar)$/i, ''),
        };
      });
      setUploadedFiles(items);

      const pdfOrImgFiles = normalizedFiles.filter(f => 
        f.type === 'application/pdf' || 
        f.name.toLowerCase().endsWith('.pdf') || 
        f.type.startsWith('image/')
      );

      if (pdfOrImgFiles.length > 0) {
        let targetFile: File;
        if (pdfOrImgFiles.length > 1) {
          targetFile = await mergePDFs(pdfOrImgFiles);
          setProcessingState(prev => ({ ...prev, message: 'Đang tạo thumbnails...' }));
        } else {
          targetFile = pdfOrImgFiles[0];
        }
        
        setFile(targetFile);
        setOutputFileName(targetFile.name.replace(/\.[^/.]+$/i, ''));

        const loadedPages = await loadPDFAndRenderThumbnails(targetFile, (percent) => {
          setProcessingState(prev => ({ ...prev, progress: percent }));
        });
        setPages(loadedPages);
        setHistory([]);
        setFuture([]);
      } else {
        // Chỉ tải lên file Word/Excel/Office -> Chế độ Đổi tên & Tải về
        setFile(null);
        setPages([]);
        setHistory([]);
        setFuture([]);
        setOutputFileName('');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi đọc file tải lên.');
      setFile(null);
    } finally {
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  // Toggle Page Selection
  const togglePage = (originalIndex: number) => {
    updatePagesWithHistory(prev => prev.map(p => 
      p.originalIndex === originalIndex ? { ...p, selected: !p.selected } : p
    ));
  };

  // Reorder Pages
  const handleReorder = (newPages: PDFPage[]) => {
      updatePagesWithHistory(() => newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })));
  };

  const selectAll = () => updatePagesWithHistory(prev => prev.map(p => ({ ...p, selected: true })));
  const deselectAll = () => updatePagesWithHistory(prev => prev.map(p => ({ ...p, selected: false })));

  // AI Analysis Handler
  const handleAiAutoSelect = async () => {
    if (pages.length === 0) return;
    setIsAiProcessing(true);
    setSelectionMode(SelectionMode.AI_AUTO);
    setError(null);

    // Initial state
    setProcessingState({ isProcessing: true, message: 'Đang chuẩn bị...', progress: 0 });

    // Simulate progress for better UX since API call is one-shot
    const intervalId = setInterval(() => {
      setProcessingState((prev) => {
        if (prev.progress >= 90) return prev; // Hold at 90% until done
        
        // Dynamic message based on progress
        let msg = prev.message;
        if (prev.progress < 25) msg = 'Đang đọc hình ảnh...';
        else if (prev.progress < 50) msg = 'Đang gửi tới Gemini...';
        else if (prev.progress < 80) msg = 'Đang phân tích cấu trúc...';
        else msg = 'Đang tổng hợp kết quả...';

        return {
          ...prev,
          message: msg,
          progress: prev.progress + (Math.random() * 5) + 2 // Increment by 2-7%
        };
      });
    }, 400);

    try {
      // Get thumbnails to send to AI
      const thumbnails = pages.map(p => p.thumbnailUrl);
      const splitIndices = await analyzeSplitPoints(thumbnails);
      
      // Stop simulation and show complete
      clearInterval(intervalId);
      setProcessingState({ isProcessing: true, message: 'Hoàn tất!', progress: 100 });
      
      // Select the pages identified as split points
      setPages(prev => prev.map(p => ({
        ...p,
        selected: splitIndices.includes(p.originalIndex)
      })));
      
      // Short delay to show 100%
      await new Promise(r => setTimeout(r, 600));

    } catch (err: any) {
        clearInterval(intervalId);
        setError(err.message || 'Lỗi AI Analysis');
    } finally {
      setIsAiProcessing(false);
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  const handleRenameUploadedFile = (id: string, newName: string) => {
    setUploadedFiles(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, customName: newName } : item
      );
      if (updated.length <= 1 || updated[0]?.id === id) {
        setOutputFileName(newName);
      }
      return updated;
    });
    setOutputFileName(newName);
  };

  const handleDownloadUploadedFile = (item: UploadedFileItem) => {
    const url = URL.createObjectURL(item.file);
    const orig = item.originalName || item.file.name;
    const extMatch = orig.match(/\.([0-9a-z]+)$/i);
    const ext = extMatch ? `.${extMatch[1]}` : '.pdf';

    let filename = item.customName.trim() || 'Tai_lieu';
    if (!filename.toLowerCase().endsWith(ext.toLowerCase())) {
      filename += ext;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllUploadedFilesZip = async () => {
    if (uploadedFiles.length === 0) return;
    setProcessingState({ isProcessing: true, message: 'Đang tạo file ZIP tải về...', progress: 50 });
    try {
      const zipBlob = await createZipFromFiles(
        uploadedFiles.map(item => ({
          file: item.file,
          name: item.customName.trim() || 'Tai_lieu',
          originalName: item.originalName || item.file.name,
        }))
      );
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Danh_sach_${uploadedFiles.length}_file_da_doi_ten.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Lỗi khi tạo file ZIP: ' + err.message);
    } finally {
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  const getSuggestedNameForItem = async (item: UploadedFileItem): Promise<string> => {
    const isPdf = item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf');
    const isImg = item.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif|tiff|heic)$/i.test(item.file.name);

    // Với file Word, Excel, PowerPoint (không có ảnh thumbnail trong trình duyệt),
    // sử dụng Instant Smart Normalizer chuẩn hóa tên file siêu tốc trong 0.001 giây (1 mili giây)
    if (!isPdf && !isImg) {
      return instantSmartCleanFileName(item.originalName);
    }

    let thumbnails: string[] = [];
    if (isPdf) {
      try {
        const firstPageThumb = await loadFirstPageThumbnailFast(item.file);
        if (firstPageThumb) thumbnails = [firstPageThumb];
      } catch (e) {
        console.warn('Cannot load thumbnail for AI naming, using filename only', e);
      }
    }
    return await suggestFileNameWithAI(thumbnails, item.originalName);
  };

  const handleAiSuggestNameForItem = async (item: UploadedFileItem) => {
    setIsAiNaming(true);
    try {
      const suggestedName = await getSuggestedNameForItem(item);
      handleRenameUploadedFile(item.id, suggestedName);
    } catch (err) {
      console.error(err);
      const fallback = instantSmartCleanFileName(item.originalName);
      handleRenameUploadedFile(item.id, fallback);
    } finally {
      setIsAiNaming(false);
    }
  };

  // AI Automatic Naming Handler based on document content (Siêu tốc: Batch Naming cho nhiều file)
  const handleAiSuggestFileName = async () => {
    if (pages.length === 0 && uploadedFiles.length === 0) return;
    setIsAiNaming(true);
    try {
      if (uploadedFiles.length > 1) {
        // Tái tạo danh sách tên file theo tốc độ tối đa:
        // - File Word/Excel: chuẩn hóa ngay lập tức (0.001s)
        // - File PDF/Ảnh: gọi Batch API siêu tốc (gemini-2.5-flash)
        const nameMapping: Record<string, string> = {};
        const pdfImgItems: { id: string; originalName: string; thumbnail?: string | null }[] = [];

        for (const item of uploadedFiles) {
          const isPdf = item.file.type === 'application/pdf' || item.file.name.toLowerCase().endsWith('.pdf');
          const isImg = item.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif|tiff|heic)$/i.test(item.file.name);
          if (!isPdf && !isImg) {
            nameMapping[item.id] = instantSmartCleanFileName(item.originalName);
          } else {
            let thumb: string | null = null;
            if (isPdf) {
              thumb = await loadFirstPageThumbnailFast(item.file);
            }
            pdfImgItems.push({
              id: item.id,
              originalName: item.originalName,
              thumbnail: thumb,
            });
          }
        }

        if (pdfImgItems.length > 0) {
          const aiMapping = await suggestBatchFileNamesWithAI(pdfImgItems);
          Object.assign(nameMapping, aiMapping);
        }

        setUploadedFiles(prev =>
          prev.map(item => {
            const suggested = nameMapping[item.id];
            if (suggested && typeof suggested === 'string') {
              return { ...item, customName: suggested.trim() };
            }
            return item;
          })
        );
      } else if (uploadedFiles.length === 1) {
        const item = uploadedFiles[0];
        const suggestedName = await getSuggestedNameForItem(item);
        setOutputFileName(suggestedName);
        setUploadedFiles(prev => prev.map((it, idx) => 
          idx === 0 ? { ...it, customName: suggestedName } : it
        ));
      } else {
        const thumbnails = pages.slice(0, 2).map(p => p.thumbnailUrl);
        const suggestedName = await suggestFileNameWithAI(thumbnails, file?.name || outputFileName || 'Tai_lieu');
        setOutputFileName(suggestedName);
        setUploadedFiles(prev => prev.map((item, idx) => 
          idx === 0 ? { ...item, customName: suggestedName } : item
        ));
      }
    } catch (err: any) {
      console.error(err);
      const base = (file?.name || outputFileName || 'Tai_lieu').replace(/\.[^/.]+$/i, '');
      const cleaned = base
        .replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const fallbackName = cleaned || 'Tai_lieu_PDF';
      setOutputFileName(fallbackName);
      setUploadedFiles(prev => prev.map((item, idx) => 
        idx === 0 ? { ...item, customName: fallbackName } : item
      ));
    } finally {
      setIsAiNaming(false);
    }
  };

  // Split Function (Extract selected pages into ONE new PDF)
  const handleSplit = async () => {
    if (!file) return;
    const selectedPages = pages.filter(p => p.selected);
    
    setProcessingState({ isProcessing: true, message: 'Đang tạo file PDF mới...', progress: 50 });
    
    try {
      const blob = await splitPDF(file, selectedPages);
      const finalFileName = outputFileName.trim() || file.name;
      const downloadName = finalFileName.toLowerCase().endsWith('.pdf') ? finalFileName : `${finalFileName}.pdf`;
      downloadBlob(blob, downloadName);
    } catch (err) {
      setError('Lỗi khi tách file.');
    } finally {
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  // Extract Separate Function (Each selected page becomes ONE PDF)
  const handleExtractSeparate = async () => {
      if (!file) return;
      const selectedPages = pages.filter(p => p.selected);

      setProcessingState({ isProcessing: true, message: useAiChapterNaming ? '🤖 Gemini đang đọc nội dung để đặt tên cho từng file con...' : 'Đang tách từng trang...', progress: 30 });

      try {
          const finalFileName = outputFileName.trim() || file.name;
          const baseName = finalFileName.replace(/\.pdf$/i, '');
          
          let chapterNames: Record<number, string> | undefined = undefined;
          if (useAiChapterNaming) {
            try {
              chapterNames = await suggestChapterNamesWithAI(selectedPages, file.name);
            } catch (aiErr) {
              console.warn("AI chapter naming fallback:", aiErr);
            }
          }

          setProcessingState({ isProcessing: true, message: 'Đang xuất các file lẻ...', progress: 70 });
          const blobs = await extractSeparatePages(file, selectedPages);
          blobs.forEach((blob, i) => {
             const pageInfo = selectedPages[i];
             const aiName = chapterNames ? chapterNames[pageInfo.pageNumber] : undefined;
             const downloadName = aiName ? `${aiName}.pdf` : `${pageInfo.isBlank ? `blank_page_${i + 1}` : `page_${pageInfo.pageNumber}`}_${baseName}.pdf`;
             setTimeout(() => {
                 downloadBlob(blob, downloadName);
             }, i * 500);
          });
      } catch (err) {
          setError('Lỗi khi tách file.');
      } finally {
        setProcessingState({ isProcessing: false, message: '', progress: 0 });
      }
  };

  // Handle Download ZIP
  const handleExtractZip = async () => {
      if (!file) return;
      const selectedPages = pages.filter(p => p.selected);

      setProcessingState({ isProcessing: true, message: useAiChapterNaming ? '🤖 Gemini đang phân tích và đặt tên tự động cho từng file con trong ZIP...' : 'Đang nén file ZIP...', progress: 30 });

      try {
        const finalFileName = outputFileName.trim() || file.name;
        const baseName = finalFileName.replace(/\.pdf$/i, '');
        
        let chapterNames: Record<number, string> | undefined = undefined;
        if (useAiChapterNaming) {
          try {
            chapterNames = await suggestChapterNamesWithAI(selectedPages, file.name);
          } catch (aiErr) {
            console.warn("AI chapter naming fallback:", aiErr);
          }
        }

        setProcessingState({ isProcessing: true, message: 'Đang đóng gói ZIP...', progress: 70 });
        const zipBlob = await createZipFromPages(file, selectedPages, file.name, chapterNames);
        downloadBlob(zipBlob, `${baseName}.zip`);
      } catch (err) {
        console.error(err);
        setError('Lỗi khi tạo file ZIP.');
      } finally {
        setProcessingState({ isProcessing: false, message: '', progress: 0 });
      }
  };

  // Add blank page at the end of document
  const handleAddBlankPage = () => {
    const nextIndex = Math.max(...pages.map(p => p.originalIndex), -1) + 1;
    const baseWidth = pages[0]?.width || 595;
    const baseHeight = pages[0]?.height || 842;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = (300 / baseWidth) * baseHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRANG TRẮNG', canvas.width / 2, canvas.height / 2);
    }

    const blankPage: PDFPage = {
      pageNumber: pages.length + 1,
      originalIndex: nextIndex,
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
      selected: true,
      width: baseWidth,
      height: baseHeight,
      isBlank: true,
    };

    updatePagesWithHistory(prev => {
      const updated = [...prev, blankPage];
      return updated.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Add blank page after a specific page
  const handleAddBlankPageAfter = (targetIndex: number) => {
    const nextIndex = Math.max(...pages.map(p => p.originalIndex), -1) + 1;
    const baseWidth = pages[0]?.width || 595;
    const baseHeight = pages[0]?.height || 842;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = (300 / baseWidth) * baseHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRANG TRẮNG', canvas.width / 2, canvas.height / 2);
    }

    const blankPage: PDFPage = {
      pageNumber: 1,
      originalIndex: nextIndex,
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
      selected: true,
      width: baseWidth,
      height: baseHeight,
      isBlank: true,
    };

    updatePagesWithHistory(prev => {
      const idxOfPage = prev.findIndex(p => p.originalIndex === targetIndex);
      if (idxOfPage === -1) return [...prev, blankPage];
      
      const updated = [...prev];
      updated.splice(idxOfPage + 1, 0, blankPage);
      return updated.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Delete a page from the list
  const handleDeletePage = (targetIndex: number) => {
    updatePagesWithHistory(prev => {
      const updated = prev.filter(p => p.originalIndex !== targetIndex);
      return updated.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Rotate a page by 90 degrees clockwise
  const handleRotatePage = (targetIndex: number) => {
    updatePagesWithHistory(prev => prev.map(p => {
      if (p.originalIndex === targetIndex) {
        const nextRotation = ((p.rotation || 0) + 90) % 360;
        return { ...p, rotation: nextRotation };
      }
      return p;
    }));
  };

  const handleStartWithBlankDocument = async () => {
    setProcessingState({ isProcessing: true, message: 'Đang tạo tài liệu mới...', progress: 50 });
    try {
      const blankFile = await createBlankPDF();
      setFile(blankFile);
      setOutputFileName(blankFile.name);
      setUploadedFiles([{
        id: `blank-${Date.now()}`,
        file: blankFile,
        originalName: blankFile.name,
        customName: 'tai_lieu_moi'
      }]);

      const loadedPages = await loadPDFAndRenderThumbnails(blankFile, (percent) => {
        setProcessingState(prev => ({ ...prev, progress: percent }));
      });
      // Mark as blank and select it
      const updatedPages = loadedPages.map(p => ({ ...p, isBlank: true, selected: true }));
      setPages(updatedPages);
      setHistory([]);
      setFuture([]);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tạo tài liệu trắng mới.');
    } finally {
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  const handleDownloadOriginal = () => {
    if (file) {
      downloadBlob(file, file.name);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setFile(null);
    setPages([]);
    setHistory([]);
    setFuture([]);
    setUploadedFiles([]);
    setError(null);
    setSelectionMode(SelectionMode.MANUAL);
    setOutputFileName('');
  };

  // Main UI - Always render workspace layout first so user enters interface before uploading
  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Controls */}
      <Sidebar 
        totalDocs={pages.length}
        selectedCount={pages.filter(p => p.selected).length}
        onSplit={handleSplit}
        onExtractSeparate={handleExtractSeparate}
        onExtractZip={handleExtractZip}
        onReset={resetApp}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        onAiAutoSelect={handleAiAutoSelect}
        isAiProcessing={isAiProcessing}
        processingState={processingState}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onAddBlankPage={handleAddBlankPage}
        outputFileName={outputFileName}
        setOutputFileName={setOutputFileName}
        onAiSuggestFileName={handleAiSuggestFileName}
        isAiNaming={isAiNaming}
        useAiChapterNaming={useAiChapterNaming}
        setUseAiChapterNaming={setUseAiChapterNaming}
        onUploadFile={handleFileChange}
        uploadedFiles={uploadedFiles}
        onRenameUploadedFile={handleRenameUploadedFile}
        onDownloadUploadedFile={handleDownloadUploadedFile}
        onDownloadAllUploadedFilesZip={handleDownloadAllUploadedFilesZip}
        onAiSuggestNameForItem={handleAiSuggestNameForItem}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Header/Status Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-3 flex-1 min-w-0">
               <div className="flex items-center gap-2 min-w-0">
                 <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${file ? "bg-teal-500 animate-pulse" : "bg-slate-300"}`}></span>
                 <h1 className="font-bold text-slate-800 truncate max-w-sm" title={file ? file.name : "SmartSplit PRO"}>
                   {file ? file.name : "SmartSplit PRO - Trình xử lý PDF thông minh"}
                 </h1>
               </div>
               {file ? (
                 <span className="bg-teal-50 text-teal-700 border border-teal-200/70 font-semibold text-xs px-2.5 py-1 rounded-full whitespace-nowrap hidden sm:inline-block">
                   📖 Xem trước toàn bộ tài liệu ({pages.length} trang)
                 </span>
               ) : (
                 <span className="bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs px-2.5 py-1 rounded-full whitespace-nowrap hidden sm:inline-block">
                   📁 Chưa chọn tài liệu
                 </span>
               )}
            </div>
            
            <div className="flex items-center gap-3">
                {processingState.isProcessing && (
                  <div className="flex items-center text-teal-600 text-sm font-medium animate-pulse whitespace-nowrap">
                    {processingState.message}
                  </div>
                )}

                {error && (
                   <div className="flex items-center text-red-600 text-sm font-medium bg-red-50 px-3 py-1 rounded-full whitespace-nowrap">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                   </div>
                )}
                
                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                {!file ? (
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,*/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-xs font-extrabold transition-all shadow-2xs">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>+ Tải PDF / Word / Excel lên</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                        onClick={handleUndo}
                        disabled={history.length === 0}
                        className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-colors"
                        title="Hoàn tác (Ctrl + Z)"
                    >
                        ↩️
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={future.length === 0}
                        className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-colors"
                        title="Làm lại (Ctrl + Y)"
                    >
                        ↪️
                    </button>

                    <button
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
                        title="Mở cửa sổ xem trước trọn bộ tài liệu PDF"
                    >
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
                        <span className="hidden md:inline">Xem trọn bộ PDF</span>
                    </button>

                    <button 
                        onClick={handleDownloadOriginal}
                        className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
                        title="Tải file gốc"
                    >
                        <Download className="w-5 h-5" />
                    </button>

                    <button 
                        onClick={resetApp}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Làm mới / Tải file khác"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                  </>
                )}
            </div>
        </header>

        {/* Scrollable PDF Grid OR Workspace Upload Card */}
        <div className="flex-1 overflow-y-auto bg-slate-100/60 flex flex-col">
          {!file || pages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border border-slate-200/80 transition-all">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/20 text-white">
                  <UploadCloud className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Tải file PDF hoặc Hình ảnh lên để xử lý
                </h2>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto text-xs leading-relaxed font-medium">
                  Bạn đã vào sẵn giao diện làm việc. Hãy kéo thả file <b>PDF</b> hoặc <b>Hình ảnh (JPG, PNG...)</b> vào đây hoặc chọn từ máy tính để bắt đầu <b>Xem trước</b>, <b>Đổi tên</b>, <b>Tách</b> hoặc <b>Gộp</b>.
                </p>

                <div className="relative group cursor-pointer max-w-sm mx-auto mb-4">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,*/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className="border-2 border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50/80 rounded-2xl p-6 transition-all duration-300 group-hover:border-teal-500">
                    <Button size="lg" className="w-full pointer-events-none font-bold" icon={<UploadCloud className="w-5 h-5"/>}>
                      Chọn File PDF / Word / Excel / Ảnh...
                    </Button>
                    <p className="mt-2 text-[11px] text-teal-700 font-semibold">
                      Hỗ trợ chọn 1 hoặc nhiều file PDF, Word, Excel & Ảnh cùng lúc
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartWithBlankDocument}
                    className="text-slate-600 bg-white border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-semibold"
                    icon={<Plus className="w-4 h-4 text-slate-500" />}
                  >
                    Bắt đầu với trang trắng mới
                  </Button>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-teal-600" /> Tách trang tự do
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-emerald-600" /> Gộp file nhanh
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <PDFViewer 
              pages={pages}
              onTogglePage={togglePage}
              onReorder={handleReorder}
              onDeletePage={handleDeletePage}
              onAddBlankPageAfter={handleAddBlankPageAfter}
              onRotatePage={handleRotatePage}
              onSelectRange={handleSelectRange}
              onSelectEven={handleSelectEven}
              onSelectOdd={handleSelectOdd}
              onInvertSelection={handleInvertSelection}
              onSelectBlank={handleSelectBlank}
              canUndo={history.length > 0}
              canRedo={future.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          )}
        </div>

        {/* Floating AI Toast/Hint */}
        {selectionMode === SelectionMode.AI_AUTO && !isAiProcessing && (
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center animate-bounce-subtle z-30">
                <Sparkles className="w-4 h-4 mr-2" />
                AI đã gợi ý các điểm ngắt. Hãy kiểm tra lại.
             </div>
        )}

        {/* Full PDF Preview Modal (Xem trước toàn bộ file PDF gốc) */}
        {isPreviewModalOpen && file && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      Xem trước trọn bộ tài liệu PDF
                    </h3>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                      {file.name} ({pages.length} trang)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadOriginal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file gốc</span>
                  </button>
                  <button
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-bold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Đóng</span>
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-slate-100/50">
                <iframe
                  src={URL.createObjectURL(file)}
                  className="w-full h-full border-none"
                  title="PDF Full Preview"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
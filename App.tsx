import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, AlertCircle, Sparkles, RefreshCw, Download, Split, Merge, FileStack, FileText, Plus } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PDFViewer } from './components/PDFViewer';
import { loadPDFAndRenderThumbnails, splitPDF, extractSeparatePages, createZipFromPages, mergePDFs, createBlankPDF } from './services/pdfService';
import { analyzeSplitPoints, suggestFileNameWithAI } from './services/geminiService';
import { PDFPage, SelectionMode, ProcessingState } from './types';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(SelectionMode.MANUAL);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    message: '',
    progress: 0,
  });
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiNaming, setIsAiNaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');

  // Handle File Upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    
    // Explicitly cast to File[] to avoid 'unknown' type inference issues from Array.from(fileList)
    const files = Array.from(fileList) as File[];
    const nonPdf = files.find(f => f.type !== 'application/pdf');

    if (nonPdf) {
      setError('Vui lòng chỉ tải lên file PDF.');
      return;
    }

    setProcessingState({ isProcessing: true, message: files.length > 1 ? 'Đang ghép nối các file...' : 'Đang đọc PDF...', progress: 0 });
    setError(null);

    try {
      let targetFile: File;
      
      if (files.length > 1) {
        targetFile = await mergePDFs(files);
        setProcessingState(prev => ({ ...prev, message: 'Đang tạo thumbnails...' }));
      } else {
        targetFile = files[0];
      }
      
      setFile(targetFile);
      setOutputFileName(targetFile.name);

      const loadedPages = await loadPDFAndRenderThumbnails(targetFile, (percent) => {
        setProcessingState(prev => ({ ...prev, progress: percent }));
      });
      setPages(loadedPages);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi đọc file PDF. File có thể bị hỏng hoặc có mật khẩu.');
      setFile(null);
    } finally {
      setProcessingState({ isProcessing: false, message: '', progress: 0 });
    }
  };

  // Toggle Page Selection
  const togglePage = (originalIndex: number) => {
    setPages(prev => prev.map(p => 
      p.originalIndex === originalIndex ? { ...p, selected: !p.selected } : p
    ));
  };

  // Reorder Pages
  const handleReorder = (newPages: PDFPage[]) => {
      setPages(newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })));
  };

  const selectAll = () => setPages(prev => prev.map(p => ({ ...p, selected: true })));
  const deselectAll = () => setPages(prev => prev.map(p => ({ ...p, selected: false })));

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

  // AI Automatic Naming Handler based on document content
  const handleAiSuggestFileName = async () => {
    if (pages.length === 0) return;
    setIsAiNaming(true);
    try {
      const thumbnails = pages.slice(0, 5).map(p => p.thumbnailUrl);
      const suggestedName = await suggestFileNameWithAI(thumbnails, file?.name || outputFileName || 'Tai_lieu');
      setOutputFileName(suggestedName);
    } catch (err: any) {
      console.error(err);
      // Smart local fallback if AI service fails or key is missing
      const base = (file?.name || outputFileName || 'Tai_lieu').replace(/\.pdf$/i, '');
      const cleaned = base
        .replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setOutputFileName(cleaned || 'Tai_lieu_PDF');
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

      setProcessingState({ isProcessing: true, message: 'Đang tách từng trang...', progress: 50 });

      try {
          const finalFileName = outputFileName.trim() || file.name;
          const baseName = finalFileName.replace(/\.pdf$/i, '');
          
          const blobs = await extractSeparatePages(file, selectedPages);
          blobs.forEach((blob, i) => {
             const pageInfo = selectedPages[i];
             const pageName = pageInfo.isBlank ? `blank_page_${i + 1}` : `page_${pageInfo.pageNumber}`;
             setTimeout(() => {
                 downloadBlob(blob, `${pageName}_${baseName}.pdf`);
             }, i * 500);
          });
      } catch (err) {
          setError('Lỗi khi tách file.');
      } finally {
        setProcessingState({ isProcessing: false, message: '', progress: 0 });
      }
  }

  // Handle Download ZIP
  const handleExtractZip = async () => {
      if (!file) return;
      const selectedPages = pages.filter(p => p.selected);

      setProcessingState({ isProcessing: true, message: 'Đang nén file ZIP...', progress: 50 });

      try {
        const finalFileName = outputFileName.trim() || file.name;
        const baseName = finalFileName.replace(/\.pdf$/i, '');
        
        const zipBlob = await createZipFromPages(file, selectedPages, file.name);
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

    setPages(prev => {
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

    setPages(prev => {
      const idxOfPage = prev.findIndex(p => p.originalIndex === targetIndex);
      if (idxOfPage === -1) return [...prev, blankPage];
      
      const updated = [...prev];
      updated.splice(idxOfPage + 1, 0, blankPage);
      return updated.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Delete a page from the list
  const handleDeletePage = (targetIndex: number) => {
    setPages(prev => {
      const updated = prev.filter(p => p.originalIndex !== targetIndex);
      return updated.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });
  };

  // Rotate a page by 90 degrees clockwise
  const handleRotatePage = (targetIndex: number) => {
    setPages(prev => prev.map(p => {
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

      const loadedPages = await loadPDFAndRenderThumbnails(blankFile, (percent) => {
        setProcessingState(prev => ({ ...prev, progress: percent }));
      });
      // Mark as blank and select it
      const updatedPages = loadedPages.map(p => ({ ...p, isBlank: true, selected: true }));
      setPages(updatedPages);
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
    setError(null);
    setSelectionMode(SelectionMode.MANUAL);
    setOutputFileName('');
  };

  // Render Upload Screen
  if (!file) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
             <h1 className="text-4xl font-bold text-slate-800 mb-2">SmartSplit PDF</h1>
             <p className="text-slate-500">Công cụ xử lý PDF đa năng: Tách, Gộp và AI thông minh</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 text-center border border-slate-100">
            {/* Visual Icon */}
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <UploadCloud className="w-10 h-10 text-teal-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Tải file lên để bắt đầu</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm">
              Bạn có thể chọn một file để <b>tách</b> hoặc nhiều file để <b>gộp</b>.
            </p>
            
            {/* Unified Upload Area */}
            <div className="relative group cursor-pointer">
              <input
                type="file"
                multiple
                accept="application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 group-hover:border-teal-500 group-hover:bg-teal-50/30 transition-all duration-300">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-4 mb-2 text-slate-300 group-hover:text-teal-400 transition-colors">
                     <FileText className="w-8 h-8" />
                     <FileStack className="w-8 h-8" />
                  </div>
                  <Button size="lg" className="pointer-events-none" icon={<UploadCloud className="w-5 h-5"/>}>
                    Chọn File PDF
                  </Button>
                  <p className="mt-2 text-xs text-slate-400 font-medium">
                    Hỗ trợ kéo thả & chọn nhiều file
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-3 text-slate-400 text-xs uppercase font-semibold">Hoặc</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={handleStartWithBlankDocument}
                className="text-teal-700 bg-white border-teal-200 hover:bg-teal-50 flex items-center justify-center gap-2 w-full md:w-auto font-semibold"
                icon={<Plus className="w-5 h-5 text-teal-600" />}
              >
                Bắt đầu với trang trắng mới
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-6 flex items-center justify-center text-red-500 text-sm bg-red-50 p-3 rounded-lg animate-fade-in">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}
            
            {/* Progress Bar */}
             {processingState.isProcessing && (
              <div className="mt-6">
                 <div className="text-sm text-teal-600 mb-2 font-medium">{processingState.message}</div>
                 <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-teal-600 h-2 rounded-full transition-all duration-300" style={{width: `${processingState.progress}%`}}></div>
                 </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs text-slate-400 max-w-lg mx-auto">
             <div className="flex items-center justify-center gap-2">
                <Split className="w-4 h-4" /> Tách trang tự động
             </div>
             <div className="flex items-center justify-center gap-2">
                <Merge className="w-4 h-4" /> Gộp nhiều file
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
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
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Header/Status Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4 flex-1 min-w-0">
               <h1 className="font-semibold text-slate-700 truncate max-w-xs" title={file.name}>{file.name}</h1>
               <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full whitespace-nowrap">{pages.length} trang</span>
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
                
                <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>

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
            </div>
        </header>

        {/* Scrollable PDF Grid */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50">
           <PDFViewer 
             pages={pages}
             onTogglePage={togglePage}
             onReorder={handleReorder}
             onDeletePage={handleDeletePage}
             onAddBlankPageAfter={handleAddBlankPageAfter}
             onRotatePage={handleRotatePage}
             onSelectRange={() => {}} // Not implemented for brevity, can be added later
           />
        </div>

        {/* Floating AI Toast/Hint */}
        {selectionMode === SelectionMode.AI_AUTO && !isAiProcessing && (
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center animate-bounce-subtle z-30">
                <Sparkles className="w-4 h-4 mr-2" />
                AI đã gợi ý các điểm ngắt. Hãy kiểm tra lại.
             </div>
        )}
      </main>
    </div>
  );
};

export default App;
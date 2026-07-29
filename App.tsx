import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, AlertCircle, Sparkles, RefreshCw, Download, Split, Merge, FileStack, FileText, Plus, Eye, X } from 'lucide-react';
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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
        onUploadFile={handleFileChange}
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
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-xs font-extrabold transition-all shadow-2xs">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>+ Tải file PDF lên</span>
                    </button>
                  </div>
                ) : (
                  <>
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
                  Tải file PDF lên để xử lý
                </h2>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto text-xs leading-relaxed font-medium">
                  Bạn đã vào sẵn giao diện làm việc. Hãy kéo thả file PDF vào đây hoặc chọn từ máy tính để bắt đầu <b>Xem trước</b>, <b>Đổi tên</b>, <b>Tách</b> hoặc <b>Gộp</b>.
                </p>

                <div className="relative group cursor-pointer max-w-sm mx-auto mb-4">
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className="border-2 border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50/80 rounded-2xl p-6 transition-all duration-300 group-hover:border-teal-500">
                    <Button size="lg" className="w-full pointer-events-none font-bold" icon={<UploadCloud className="w-5 h-5"/>}>
                      Chọn File PDF từ máy tính
                    </Button>
                    <p className="mt-2 text-[11px] text-teal-700 font-semibold">
                      Hỗ trợ chọn 1 hoặc nhiều file PDF cùng lúc
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
              onSelectRange={() => {}} // Not implemented for brevity, can be added later
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
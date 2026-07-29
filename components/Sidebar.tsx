import React, { useState, useEffect } from 'react';
import { SelectionMode, ProcessingState } from '../types';
import { 
  Sparkles, 
  MousePointer2, 
  Trash2,
  Split,
  Archive,
  Merge,
  FileStack,
  FilePlus,
  CheckCheck,
  RotateCcw,
  FileText,
  Calendar,
  Eye,
  Wand2,
  ArrowRight,
  ArrowLeft,
  Download,
  UploadCloud
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  totalDocs: number;
  selectedCount: number;
  onSplit: () => void;
  onExtractSeparate: () => void;
  onExtractZip: () => void;
  onReset: () => void;
  selectionMode: SelectionMode;
  setSelectionMode: (mode: SelectionMode) => void;
  onAiAutoSelect: () => void;
  isAiProcessing: boolean;
  processingState: ProcessingState;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddBlankPage: () => void;
  outputFileName: string;
  setOutputFileName: (name: string) => void;
  onAiSuggestFileName?: () => void;
  isAiNaming?: boolean;
  onUploadFile?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  totalDocs,
  selectedCount,
  onSplit,
  onExtractSeparate,
  onExtractZip,
  onReset,
  selectionMode,
  setSelectionMode,
  onAiAutoSelect,
  isAiProcessing,
  processingState,
  onSelectAll,
  onDeselectAll,
  onAddBlankPage,
  outputFileName,
  setOutputFileName,
  onAiSuggestFileName,
  isAiNaming,
  onUploadFile
}) => {
  // 4 Tabs: 'preview' (Xem trước) | 'rename' (Đổi tên) | 'split' (Tách file) | 'merge' (Gộp file)
  const [activeTab, setActiveTab] = useState<'preview' | 'rename' | 'split' | 'merge'>('preview');

  // Reset to preview mode when loading a new file
  useEffect(() => {
    if (totalDocs === 0) {
      setActiveTab('preview');
    }
  }, [totalDocs]);

  return (
    <aside className="w-full lg:w-80 bg-white border-r border-slate-200/80 flex flex-col h-full shadow-lg z-20 shrink-0 select-none">
      {/* Brand Header - Compact & Clean */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20 ring-1 ring-white/20 shrink-0">
            <Split className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              SmartSplit <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">PRO</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {totalDocs > 0 ? `${totalDocs} trang đã tải lên` : 'Chờ tải file...'}
            </p>
          </div>
        </div>
        
        {totalDocs > 0 && (
          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200/80 shrink-0">
            {totalDocs} trang
          </span>
        )}
      </div>

      {/* 4-Tab Navigation Switcher (Xem trước | Đổi tên | Tách file | Gộp file) */}
      <div className="p-2 bg-slate-100/90 border-b border-slate-200/80">
        <div className="grid grid-cols-4 p-1 bg-slate-200/70 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={clsx(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200",
              activeTab === 'preview'
                ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
            title="Xem trước & chọn trang"
          >
            <Eye className="w-3.5 h-3.5 mb-0.5" />
            <span className="truncate">Xem trước</span>
          </button>
          
          <button
            onClick={() => setActiveTab('rename')}
            className={clsx(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200 relative",
              activeTab === 'rename'
                ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
            title="Đặt tên / Đổi tên file xuất ra"
          >
            <FileText className="w-3.5 h-3.5 mb-0.5" />
            <span className="truncate">Đổi tên</span>
            {!outputFileName.trim() && totalDocs > 0 && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={clsx(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200",
              activeTab === 'split'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
            title="Tách thành các file lẻ hoặc tệp ZIP"
          >
            <FileStack className="w-3.5 h-3.5 mb-0.5" />
            <span className="truncate">Tách file</span>
          </button>

          <button
            onClick={() => setActiveTab('merge')}
            className={clsx(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200",
              activeTab === 'merge'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
            title="Gộp các trang đã chọn thành 1 file PDF"
          >
            <Merge className="w-3.5 h-3.5 mb-0.5" />
            <span className="truncate">Gộp file</span>
          </button>
        </div>
      </div>

      {/* Scrollable Main Area - Changes based on Active Step */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {totalDocs === 0 && (
          <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-dashed border-teal-300 rounded-2xl text-center space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-teal-600 mx-auto">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-teal-900">Chưa có tài liệu nào</h4>
              <p className="text-[11px] text-teal-700/80 mt-0.5">
                Tải file PDF lên ở vùng làm việc bên phải để bắt đầu
              </p>
            </div>
            {onUploadFile && (
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={onUploadFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <button className="w-full py-2.5 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Chọn file PDF ngay</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* ======================= TAB 1: XEM TRƯỚC & CHỌN TRANG ======================= */}
        {activeTab === 'preview' && (
          <>
            {/* Selection Mode (Segmented Control) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chế độ chọn trang</span>
                {selectionMode === SelectionMode.AI_AUTO && !isAiProcessing && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    AI Đã chọn
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200/60">
                <button
                  onClick={() => {
                    setSelectionMode(SelectionMode.MANUAL);
                    if (isAiProcessing) return;
                  }}
                  className={clsx(
                    "flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                    selectionMode === SelectionMode.MANUAL
                      ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <MousePointer2 className="w-3.5 h-3.5 mr-1.5" />
                  Thủ công
                </button>
                <button
                  onClick={() => {
                    if (selectionMode === SelectionMode.AI_AUTO && !isAiProcessing) {
                      onAiAutoSelect();
                    } else {
                      onAiAutoSelect();
                    }
                  }}
                  disabled={isAiProcessing || totalDocs === 0}
                  className={clsx(
                    "flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                    selectionMode === SelectionMode.AI_AUTO
                      ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  )}
                >
                  <Sparkles className={clsx("w-3.5 h-3.5 mr-1.5", isAiProcessing && "animate-spin")} />
                  {isAiProcessing ? "AI Đang nghĩ..." : "AI Phân tích"}
                </button>
              </div>

              {/* AI Processing Status Message */}
              {isAiProcessing && processingState.message && (
                <div className="mt-2 text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg p-2 flex items-center justify-between">
                  <span>{processingState.message}</span>
                  <span className="font-bold">{Math.round(processingState.progress)}%</span>
                </div>
              )}
            </section>

            {/* Quick Actions (Select All, Deselect All, Add Blank Page) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thao tác nhanh</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onSelectAll}
                  disabled={totalDocs === 0}
                  className="flex items-center justify-center py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Chọn hết
                </button>
                <button
                  onClick={onDeselectAll}
                  disabled={totalDocs === 0 || selectedCount === 0}
                  className="flex items-center justify-center py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Bỏ chọn
                </button>
              </div>
              
              <button
                onClick={onAddBlankPage}
                disabled={totalDocs === 0}
                className="w-full mt-2 flex items-center justify-center py-2.5 px-3 bg-teal-50/70 hover:bg-teal-50 text-teal-700 rounded-xl border border-teal-200/80 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <FilePlus className="w-4 h-4 mr-1.5 text-teal-600" />
                + Trang trắng chèn vào cuối
              </button>
            </section>

            {/* Selected Summary Card */}
            <div className="p-3.5 bg-gradient-to-br from-slate-50 to-teal-50/40 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">Đang chọn xuất file:</span>
                <span className="text-xs font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full">
                  {selectedCount} / {totalDocs} trang
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${totalDocs > 0 ? (selectedCount / totalDocs) * 100 : 0}%`}}
                />
              </div>
            </div>

            {/* Quick Name Indicator Strip */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate" title={outputFileName || 'Chưa đặt tên file'}>
                  {outputFileName ? `${outputFileName}.pdf` : '⚠️ Chưa đặt tên file'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('rename')}
                className="text-[11px] font-bold text-teal-600 hover:text-teal-800 underline shrink-0 ml-2"
              >
                Đổi tên
              </button>
            </div>

            {/* CTA Button to proceed to Step 2 (Rename) */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab('rename')}
                disabled={selectedCount === 0}
                className="w-full h-11 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Tiếp theo: Đổi tên file</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              {selectedCount === 0 && (
                <p className="text-[11px] text-center text-amber-600 font-medium mt-1.5">
                  Vui lòng chọn ít nhất 1 trang để tiếp tục
                </p>
              )}
            </div>
          </>
        )}

        {/* ======================= TAB 2: ĐỔI TÊN FILE (RENAME TAB) ======================= */}
        {activeTab === 'rename' && (
          <>
            {/* Selected Summary Badge / Back to Select */}
            <div className="p-3 bg-teal-50 border border-teal-200/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span className="text-xs font-semibold text-teal-900">
                  Đã chọn {selectedCount} / {totalDocs} trang
                </span>
              </div>
              <button 
                onClick={() => setActiveTab('preview')}
                className="text-[11px] font-bold text-teal-600 hover:text-teal-800 underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Thay đổi
              </button>
            </div>

            {/* Naming Studio Card */}
            <section className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-extrabold">1</span>
                  Đặt tên / Đổi tên tài liệu
                </span>
                {!outputFileName.trim() ? (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    ⚠️ Chưa có tên
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    ✓ Sẵn sàng
                  </span>
                )}
              </div>

              {/* AI Auto-Name Button */}
              {onAiSuggestFileName && (
                <button
                  onClick={onAiSuggestFileName}
                  disabled={isAiNaming || totalDocs === 0}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
                  title="Nhờ AI xem nội dung file và tự động gợi ý tên file chuẩn gọn gàng"
                >
                  <Sparkles className={clsx("w-4 h-4", isAiNaming ? "animate-spin" : "group-hover:scale-110 transition-transform")} />
                  <span>{isAiNaming ? "AI đang đọc tài liệu & đặt tên..." : "✨ Nhờ AI đặt tên theo nội dung file"}</span>
                </button>
              )}

              {/* Manual Filename Input */}
              <div className={clsx(
                "flex items-center bg-white border-2 rounded-xl px-3 py-2.5 transition-all shadow-2xs",
                !outputFileName.trim()
                  ? "border-amber-400 ring-2 ring-amber-100"
                  : "border-slate-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15"
              )}>
                <FileText className="w-4 h-4 text-teal-600 mr-2 shrink-0" />
                <input 
                  type="text" 
                  value={outputFileName}
                  onChange={(e) => setOutputFileName(e.target.value)}
                  className="w-full text-xs outline-none text-slate-800 bg-transparent placeholder-slate-400 font-semibold"
                  placeholder="Nhập tên file (VD: Hop_dong_2026)..."
                />
                {outputFileName && (
                  <button
                    onClick={() => setOutputFileName('')}
                    className="text-slate-400 hover:text-red-600 text-[11px] ml-1 px-1.5 py-0.5 rounded hover:bg-red-50 font-bold transition-colors"
                    title="Xoá tên hiện tại để đặt lại từ đầu"
                  >
                    Xoá
                  </button>
                )}
              </div>
              
              {/* Quick Date Addition Pills */}
              <div className="flex items-center flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 mr-0.5 flex items-center gap-1 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" /> Thêm ngày:
                </span>
                {[
                  { label: 'Năm', prefix: () => `${new Date().getFullYear()}_` },
                  { label: 'Tháng', prefix: () => `${String(new Date().getMonth() + 1).padStart(2, '0')}_` },
                  { label: 'Ngày', prefix: () => `${String(new Date().getDate()).padStart(2, '0')}_` },
                  { label: 'Y-M-D', prefix: () => `${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')}_${String(new Date().getDate()).padStart(2, '0')}_` }
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => {
                      const currentVal = outputFileName.trim();
                      setOutputFileName(`${item.prefix()}${currentVal}`);
                    }}
                    className="text-[11px] bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 hover:border-teal-300 px-2.5 py-1 rounded-md border border-slate-200 transition-all font-semibold active:scale-95 shadow-2xs"
                  >
                    +{item.label}
                  </button>
                ))}
              </div>

              {/* Complete Filename Preview Card */}
              <div className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between shadow-2xs mt-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold block">Tên file hoàn chỉnh khi xuất:</span>
                  <span className="text-xs font-bold text-teal-900 truncate block mt-0.5">
                    {outputFileName ? `${outputFileName}.pdf` : '⚠️ Chưa đặt tên file'}
                  </span>
                </div>
              </div>
            </section>

            {/* Direct Download Button (No need to go to Split / Merge) */}
            <section className="space-y-3 pt-1">
              <div className="p-3.5 bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-slate-50 border-2 border-teal-500/40 rounded-2xl shadow-sm">
                <div className="mb-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full block w-fit mb-1">
                    ⚡ Tải nhanh trực tiếp
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-teal-600" />
                    Tải về luôn (Không qua tách/gộp)
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Tải ngay toàn bộ {selectedCount} trang đang chọn thành 1 file PDF mới với tên đã đặt ở trên.
                  </p>
                </div>
                <button
                  onClick={onSplit}
                  disabled={selectedCount === 0 || !outputFileName.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span className="truncate">📥 Tải về ngay ({outputFileName ? `${outputFileName}.pdf` : 'Chưa đặt tên'})</span>
                </button>
                {!outputFileName.trim() && (
                  <p className="text-[11px] text-center text-amber-600 font-semibold mt-1.5">
                    ⚠️ Vui lòng nhập hoặc nhờ AI đặt tên trước khi tải
                  </p>
                )}
              </div>

              {/* Advanced Next Steps: Choice of Split or Merge */}
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 block mb-2">
                  Hoặc chuyển qua các tính năng nâng cao khác:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('split')}
                    disabled={selectedCount === 0}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <FileStack className="w-4 h-4" />
                    <span>Tách file ➔</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('merge')}
                    disabled={selectedCount === 0}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Merge className="w-4 h-4" />
                    <span>Gộp file ➔</span>
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ======================= TAB 3: TÁCH FILE (SPLIT TAB) ======================= */}
        {activeTab === 'split' && (
          <>
            {/* Header info bar */}
            <div className="p-3 bg-blue-50 border border-blue-200/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-semibold text-blue-900 truncate">
                  📄 {outputFileName || 'Chưa đặt tên'} ({selectedCount} trang)
                </span>
              </div>
              <button 
                onClick={() => setActiveTab('rename')}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline shrink-0 ml-2"
              >
                Đổi tên
              </button>
            </div>

            {/* Split Options */}
            <section className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-extrabold">2</span>
                  Chọn cách xuất file lẻ
                </span>
              </div>

              {/* Option 1: Tách thành các file PDF rời */}
              <div className="p-4 bg-gradient-to-br from-blue-50/90 to-sky-50/50 border border-blue-200/80 rounded-2xl hover:border-blue-300 transition-all shadow-2xs space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <FileStack className="w-4 h-4 text-blue-600" />
                    Tách thành các file PDF rời
                  </h4>
                  <p className="text-[11px] text-blue-700/80 mt-1 leading-relaxed font-medium">
                    Mỗi trang trong số {selectedCount} trang đã chọn sẽ được xuất thành 1 file PDF độc lập. Bạn có thể tải từng trang hoặc tất cả.
                  </p>
                </div>
                <button 
                  onClick={onExtractSeparate}
                  disabled={selectedCount === 0}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <FileStack className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Tách & Tải các file lẻ ({selectedCount} file)</span>
                </button>
              </div>

              {/* Option 2: Tải trọn bộ gói nén .ZIP */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/90 to-purple-50/50 border border-indigo-200/80 rounded-2xl hover:border-indigo-300 transition-all shadow-2xs space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-indigo-600" />
                    Tải xuống trọn bộ gói .ZIP
                  </h4>
                  <p className="text-[11px] text-indigo-700/80 mt-1 leading-relaxed font-medium">
                    Đóng gói toàn bộ {selectedCount} file đã tách vào 1 tệp .ZIP gọn gàng, thuận tiện cho lưu trữ và chia sẻ.
                  </p>
                </div>
                <button 
                  onClick={onExtractZip}
                  disabled={selectedCount === 0}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <Archive className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Tải xuống gói file .ZIP ({selectedCount} trang)</span>
                </button>
              </div>
            </section>
          </>
        )}

        {/* ======================= TAB 4: GỘP FILE (MERGE TAB) ======================= */}
        {activeTab === 'merge' && (
          <>
            {/* Header info bar */}
            <div className="p-3 bg-emerald-50 border border-emerald-200/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold text-emerald-900 truncate">
                  📄 {outputFileName || 'Chưa đặt tên'} ({selectedCount} trang)
                </span>
              </div>
              <button 
                onClick={() => setActiveTab('rename')}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0 ml-2"
              >
                Đổi tên
              </button>
            </div>

            {/* Merge Options */}
            <section className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-extrabold">2</span>
                  Gộp trang thành 1 file
                </span>
              </div>

              <div className="p-4 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/80 rounded-2xl hover:border-emerald-300 transition-all shadow-2xs space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-emerald-600" />
                    Gộp thành 1 tài liệu PDF duy nhất
                  </h4>
                  <p className="text-[11px] text-emerald-700/80 mt-1 leading-relaxed font-medium">
                    Gộp toàn bộ {selectedCount} trang đã được chọn (theo đúng thứ tự bạn sắp xếp) thành một tài liệu PDF hoàn chỉnh.
                  </p>
                </div>

                {/* Output Filename indicator box */}
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">Tên file xuất ra:</span>
                  <span className="text-xs font-bold text-emerald-800 truncate max-w-[170px]">
                    {outputFileName ? `${outputFileName}.pdf` : '⚠️ Chưa đặt tên'}
                  </span>
                </div>

                <button 
                  onClick={onSplit}
                  disabled={selectedCount === 0 || !outputFileName.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <Merge className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>Gộp & Tải xuống 1 file PDF</span>
                </button>

                {!outputFileName.trim() && (
                  <p className="text-[11px] text-center text-amber-600 font-semibold mt-1">
                    ⚠️ Vui lòng qua tab "Đổi tên" để đặt tên file trước khi gộp
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Common Footer Actions */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 space-y-2 shrink-0">
        {activeTab !== 'preview' && (
          <button 
            onClick={() => {
              if (activeTab === 'rename') setActiveTab('preview');
              else setActiveTab('rename');
            }}
            className="w-full flex items-center justify-center text-xs text-slate-600 hover:text-teal-700 py-1.5 transition-colors font-semibold gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {activeTab === 'rename' ? 'Quay lại chế độ Xem trước' : 'Quay lại Đổi tên file'}
          </button>
        )}
        <button 
          onClick={onReset}
          className="w-full flex items-center justify-center text-xs text-slate-400 hover:text-red-600 py-1.5 transition-colors group font-medium"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:scale-110" /> 
          <span>Hủy & Tải file mới</span>
        </button>
      </div>
    </aside>
  );
};
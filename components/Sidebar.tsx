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
  ArrowLeft
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
  setOutputFileName
}) => {
  // Step 1: 'preview' (Xem trước & chọn trang) | Step 2: 'action' (Tách, Gộp, Đổi tên)
  const [activeTab, setActiveTab] = useState<'preview' | 'action'>('preview');

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

      {/* 2-Step Navigation Switcher (Xem trước ➔ Tách/Gộp/Đổi tên) */}
      <div className="p-2.5 bg-slate-100/90 border-b border-slate-200/80">
        <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={clsx(
              "flex items-center justify-center py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200",
              activeTab === 'preview'
                ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            <span className="truncate">1. Xem trước</span>
          </button>
          <button
            onClick={() => setActiveTab('action')}
            className={clsx(
              "flex items-center justify-center py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200",
              activeTab === 'action'
                ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Wand2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            <span className="truncate">2. Tách / Gộp / Đổi tên</span>
          </button>
        </div>
      </div>

      {/* Scrollable Main Area - Changes based on Active Step */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
        {/* ======================= TAB 1: XEM TRƯỚC & CHỌN TRANG ======================= */}
        {activeTab === 'preview' && (
          <>
            {/* Selection Mode (Segmented Control) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chế độ chọn trang</span>
                {selectionMode === SelectionMode.AI_AUTO && !isAiProcessing && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    AI Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl gap-1">
                <button
                  onClick={() => setSelectionMode(SelectionMode.MANUAL)}
                  className={clsx(
                    "flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200",
                    selectionMode === SelectionMode.MANUAL
                      ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/60"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  )}
                >
                  <MousePointer2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Thủ công
                </button>
                
                <button
                  onClick={onAiAutoSelect}
                  disabled={isAiProcessing || totalDocs === 0}
                  className={clsx(
                    "flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 relative overflow-hidden",
                    selectionMode === SelectionMode.AI_AUTO
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/20"
                      : "text-slate-600 hover:text-emerald-700 hover:bg-white/50 disabled:opacity-50"
                  )}
                >
                  <Sparkles className={clsx("w-3.5 h-3.5 mr-1.5", selectionMode === SelectionMode.AI_AUTO ? "text-white" : "text-emerald-600")} />
                  AI Phân tích
                </button>
              </div>

              {/* AI Progress Card */}
              {isAiProcessing && (
                <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex justify-between items-center text-xs font-medium text-emerald-700 mb-1.5">
                    <span className="flex items-center gap-1.5 animate-pulse truncate mr-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      {processingState.message || "AI đang phân tích..."}
                    </span>
                    <span className="font-mono text-emerald-600">{Math.round(processingState.progress)}%</span>
                  </div>
                  <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${processingState.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Quick Toolbar: Select All, Deselect All, Add Blank Page */}
            <section>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Thao tác nhanh
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={onSelectAll}
                  disabled={totalDocs === 0}
                  className="flex flex-col items-center justify-center py-2 px-1.5 bg-slate-50 hover:bg-teal-50/70 border border-slate-200/80 hover:border-teal-200 rounded-xl text-slate-700 hover:text-teal-700 transition-all text-xs font-medium group disabled:opacity-50"
                  title="Chọn tất cả trang"
                >
                  <CheckCheck className="w-4 h-4 mb-1 text-slate-500 group-hover:text-teal-600 transition-colors" />
                  <span>Chọn hết</span>
                </button>
                
                <button
                  onClick={onDeselectAll}
                  disabled={totalDocs === 0}
                  className="flex flex-col items-center justify-center py-2 px-1.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-200 rounded-xl text-slate-700 hover:text-amber-700 transition-all text-xs font-medium group disabled:opacity-50"
                  title="Bỏ chọn tất cả trang"
                >
                  <RotateCcw className="w-4 h-4 mb-1 text-slate-500 group-hover:text-amber-600 transition-colors" />
                  <span>Bỏ chọn</span>
                </button>

                <button
                  onClick={onAddBlankPage}
                  disabled={totalDocs === 0}
                  className="flex flex-col items-center justify-center py-2 px-1.5 bg-teal-50/50 hover:bg-teal-100/70 border border-teal-200/80 hover:border-teal-300 rounded-xl text-teal-700 transition-all text-xs font-semibold group disabled:opacity-50"
                  title="Thêm một trang trắng vào cuối file"
                >
                  <FilePlus className="w-4 h-4 mb-1 text-teal-600 group-hover:scale-110 transition-transform" />
                  <span>+ Trang trắng</span>
                </button>
              </div>
            </section>

            {/* Selected Summary Card */}
            <div className="p-3.5 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-slate-50/80 border border-teal-200/60 rounded-xl shadow-2xs">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                  Đã chọn:
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-extrabold text-teal-600">{selectedCount}</span>
                  <span className="text-xs font-medium text-slate-500">/ {totalDocs} trang</span>
                  {totalDocs > 0 && (
                    <span className="ml-1 text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                      {Math.round((selectedCount / totalDocs) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${totalDocs > 0 ? (selectedCount / totalDocs) * 100 : 0}%`}}
                />
              </div>
            </div>

            {/* CTA Button to proceed to Step 2 */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab('action')}
                disabled={selectedCount === 0}
                className="w-full h-11 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>Tiếp theo: Tách / Gộp / Đổi tên</span>
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

        {/* ======================= TAB 2: TÁCH, GỘP & ĐỔI TÊN ======================= */}
        {activeTab === 'action' && (
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

            {/* Step 1: Output File Name (Rename) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-extrabold">1</span>
                  Đổi tên file xuất ra
                </span>
              </div>
              <div className="flex items-center bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 transition-all shadow-2xs">
                <FileText className="w-4 h-4 text-teal-600 mr-2 shrink-0" />
                <input 
                  type="text" 
                  value={outputFileName}
                  onChange={(e) => setOutputFileName(e.target.value)}
                  className="w-full text-xs outline-none text-slate-800 bg-transparent placeholder-slate-400 font-medium"
                  placeholder="Nhập tên file (VD: tailieu_moi.pdf)"
                />
              </div>
              
              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400 mr-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Thêm nhanh:
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
                    className="text-[11px] bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 hover:border-teal-200 px-2 py-0.5 rounded-md border border-slate-200/80 transition-all font-medium active:scale-95"
                  >
                    +{item.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Step 2: Choose Function (Split / Merge / ZIP) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-extrabold">2</span>
                  Chọn chức năng xử lý
                </span>
              </div>

              {/* Action 1: Gộp thành 1 file PDF */}
              <div className="p-3.5 bg-gradient-to-br from-teal-50/90 to-emerald-50/50 border border-teal-200/80 rounded-xl hover:border-teal-300 transition-all shadow-2xs">
                <div className="mb-2.5">
                  <h4 className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-teal-600" />
                    Gộp thành 1 file PDF
                  </h4>
                  <p className="text-[11px] text-teal-700/80 mt-0.5 leading-relaxed">
                    Gộp {selectedCount} trang đã chọn thành 1 tài liệu PDF duy nhất
                  </p>
                </div>
                <button 
                  onClick={onSplit}
                  disabled={selectedCount === 0}
                  className="w-full h-9 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-lg font-semibold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <Merge className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Gộp & Tải xuống ngay</span>
                </button>
              </div>

              {/* Action 2: Tách file lẻ */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl hover:border-blue-300 transition-all shadow-2xs">
                <div className="mb-2.5">
                  <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <FileStack className="w-4 h-4 text-blue-600" />
                    Tách thành các file rời
                  </h4>
                  <p className="text-[11px] text-blue-700/80 mt-0.5 leading-relaxed">
                    Mỗi trang đã chọn sẽ được xuất thành 1 file PDF độc lập
                  </p>
                </div>
                <button 
                  onClick={onExtractSeparate}
                  disabled={selectedCount === 0}
                  className="w-full h-9 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <FileStack className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Tách & Tải file lẻ</span>
                </button>
              </div>

              {/* Action 3: Tải file ZIP */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl hover:border-indigo-300 transition-all shadow-2xs">
                <div className="mb-2.5">
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-indigo-600" />
                    Tải gói nén .ZIP
                  </h4>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5 leading-relaxed">
                    Đóng gói toàn bộ file đã tách vào 1 tệp .ZIP tiện lợi
                  </p>
                </div>
                <button 
                  onClick={onExtractZip}
                  disabled={selectedCount === 0}
                  className="w-full h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <Archive className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Tải xuống file .ZIP</span>
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Common Footer Actions */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 space-y-2 shrink-0">
        {activeTab === 'action' && (
          <button 
            onClick={() => setActiveTab('preview')}
            className="w-full flex items-center justify-center text-xs text-slate-600 hover:text-teal-700 py-1.5 transition-colors font-semibold gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại chế độ Xem trước
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
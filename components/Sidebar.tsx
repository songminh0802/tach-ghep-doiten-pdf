import React, { useState } from 'react';
import { Button } from './Button';
import { SelectionMode, ProcessingState } from '../types';
import { 
  Sparkles, 
  MousePointer2, 
  Trash2,
  Split,
  Archive,
  Merge,
  FileStack,
  Plus
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
  return (
    <aside className="w-full lg:w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-20">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Split className="w-6 h-6 text-teal-600" />
          SmartSplit PDF
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {totalDocs > 0 ? `${totalDocs} trang được tải lên` : 'Chờ tải file...'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Selection Tools */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Chế độ chọn
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => setSelectionMode(SelectionMode.MANUAL)}
              className={clsx(
                "w-full flex items-center p-3 rounded-lg text-sm font-medium transition-all border",
                selectionMode === SelectionMode.MANUAL
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-slate-50"
              )}
            >
              <MousePointer2 className="w-4 h-4 mr-3" />
              Thủ công (Click từng trang)
            </button>
            
            <button
              onClick={onAiAutoSelect}
              disabled={isAiProcessing || totalDocs === 0}
              className={clsx(
                "w-full flex items-center p-3 rounded-lg text-sm font-medium transition-all border relative overflow-hidden min-h-[60px]",
                selectionMode === SelectionMode.AI_AUTO
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-slate-50"
              )}
            >
              {isAiProcessing ? (
                <div className="absolute inset-0 bg-white/95 z-10 flex flex-col justify-center px-4 py-2">
                    <div className="flex justify-between items-center mb-1.5 w-full">
                         <span className="text-xs font-bold text-emerald-600 animate-pulse truncate mr-2">
                            {processingState.message || "Đang xử lý..."}
                         </span>
                         <span className="text-xs font-mono text-emerald-500">{Math.round(processingState.progress)}%</span>
                    </div>
                    <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${processingState.progress}%` }}
                        />
                    </div>
                </div>
              ) : (
                 <>
                  <Sparkles className={clsx("w-4 h-4 mr-3 shrink-0", "text-emerald-600")} />
                  <div className="text-left">
                    <span className="block">AI Phân Tích Thông Minh</span>
                    <span className="text-xs font-normal opacity-70">Tự động phát hiện chương/bài</span>
                  </div>
                 </>
              )}
            </button>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
           <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Thao tác nhanh
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSelectAll} className="flex-1">
                Tất cả
            </Button>
            <Button variant="outline" size="sm" onClick={onDeselectAll} className="flex-1">
                Bỏ chọn
            </Button>
          </div>
        </section>

        {/* Edit Options */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Chỉnh sửa trang
          </h3>
          <Button
            variant="outline"
            className="w-full justify-center text-teal-700 bg-white hover:bg-teal-50 border-teal-200 flex items-center gap-2 font-medium"
            onClick={onAddBlankPage}
            icon={<Plus className="w-4 h-4 text-teal-600" />}
          >
            Thêm trang trắng
          </Button>
        </section>

        {/* Summary */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Đã chọn:</span>
                <span className="text-lg font-bold text-teal-600">{selectedCount} <span className="text-sm font-normal text-slate-500">trang</span></span>
            </div>
            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${totalDocs > 0 ? (selectedCount / totalDocs) * 100 : 0}%`}}
                />
            </div>
        </div>
        
        {/* Output Name */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Tên file xuất ra
          </h3>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-2 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
            <input 
               type="text" 
               value={outputFileName}
               onChange={(e) => setOutputFileName(e.target.value)}
               className="w-full text-sm outline-none text-slate-700 bg-transparent placeholder-slate-400"
               placeholder="Nhập tên file (VD: tailieu.pdf)"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-slate-500 w-full mb-1">Chèn nhanh thời gian:</span>
            {[
                { label: 'Năm', prefix: () => `${new Date().getFullYear()}_` },
                { label: 'Tháng', prefix: () => `${String(new Date().getMonth() + 1).padStart(2, '0')}_` },
                { label: 'Ngày', prefix: () => `${String(new Date().getDate()).padStart(2, '0')}_` },
                { label: 'Năm-Tháng-Ngày', prefix: () => `${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')}_${String(new Date().getDate()).padStart(2, '0')}_` }
            ].map(item => (
                <button
                   key={item.label}
                   onClick={() => {
                       const currentVal = outputFileName.trim();
                       setOutputFileName(`${item.prefix()}${currentVal}`);
                   }}
                   className="text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-600 px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors font-medium"
                >
                   + {item.label}
                </button>
            ))}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Xuất file
        </h3>
        
        {/* Option 1: Merge selected into one file */}
        <Button 
            className="w-full justify-start" 
            size="lg" 
            onClick={onSplit}
            disabled={selectedCount === 0}
            icon={<Merge className="w-5 h-5"/>}
        >
          Gộp thành 1 file
        </Button>
        
        {/* Option 2: Extract each page as separate file */}
        <Button 
            className="w-full justify-start" 
            variant="blue"
            size="lg" 
            onClick={onExtractSeparate}
            disabled={selectedCount === 0}
            icon={<FileStack className="w-5 h-5"/>}
        >
            Tách thành các file riêng lẻ
        </Button>

        {/* Option 3: Download ZIP */}
        <Button 
            variant="indigo"
            className="w-full justify-start" 
            size="lg" 
            onClick={onExtractZip}
            disabled={selectedCount === 0}
            icon={<Archive className="w-5 h-5"/>}
        >
            Tải xuống file ZIP
        </Button>

        <div className="pt-2">
            <button 
                onClick={onReset}
                className="w-full flex items-center justify-center text-xs text-slate-400 hover:text-red-600 py-2 transition-colors"
            >
                <Trash2 className="w-3 h-3 mr-1" /> Hủy & Tải file mới
            </button>
        </div>
      </div>
    </aside>
  );
};
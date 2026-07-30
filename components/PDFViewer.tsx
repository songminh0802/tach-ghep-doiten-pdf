import React, { useMemo, useState } from 'react';
import { PDFPage } from '../types';
import { Check, Trash2, Plus, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
  defaultAnimateLayoutChanges
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PDFViewerProps {
  pages: PDFPage[];
  onTogglePage: (originalIndex: number) => void;
  onReorder: (newPages: PDFPage[]) => void;
  onDeletePage: (originalIndex: number) => void;
  onAddBlankPageAfter: (originalIndex: number) => void;
  onRotatePage: (originalIndex: number) => void;
  onSelectRange?: (indices: number[]) => void;
  onSelectEven?: () => void;
  onSelectOdd?: () => void;
  onInvertSelection?: () => void;
  onSelectBlank?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

interface PageItemProps {
    page: PDFPage;
    isOverlay?: boolean;
    onClick?: () => void;
    isDragging?: boolean;
    onDeletePage?: (originalIndex: number) => void;
    onAddBlankPageAfter?: (originalIndex: number) => void;
    onRotatePage?: (originalIndex: number) => void;
}

// Reusable Page Card Component
const PageCard: React.FC<PageItemProps> = ({ page, isOverlay, onClick, isDragging, onDeletePage, onAddBlankPageAfter, onRotatePage }) => {
    return (
        <div
          onClick={onClick}
          className={clsx(
            "group relative rounded-xl border-2 overflow-hidden bg-white select-none w-full h-full transition-colors",
            page.selected
              ? "border-teal-500 ring-2 ring-teal-200 ring-offset-2"
              : "border-transparent hover:border-slate-300",
            isOverlay ? "shadow-2xl scale-105 cursor-grabbing z-50" : "shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing",
            isDragging ? "opacity-30" : "opacity-100"
          )}
        >
          <div className="aspect-[1/1.4] relative bg-slate-100 w-full">
             {/* Thumbnail Image - IMPORTANT: draggable=false prevents browser native drag */}
            <img
              src={page.thumbnailUrl}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-contain p-2 pointer-events-none transition-transform duration-200"
              style={{ transform: `rotate(${page.rotation || 0}deg)` }}
              loading="lazy"
              draggable={false} 
            />
            
            {/* Overlay Gradient on Hover */}
            <div className={clsx("absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity", isOverlay ? "opacity-0" : "opacity-0 group-hover:opacity-100")} />
    
            {/* Trash / Delete Button */}
            {!isOverlay && onDeletePage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePage(page.originalIndex);
                }}
                className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-sm opacity-70 md:opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                title="Xóa trang này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Checkmark Indicator */}
            <div className={clsx(
              "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm",
              page.selected ? "bg-teal-500 text-white scale-100" : "bg-white/80 text-slate-400 scale-90 group-hover:scale-100"
            )}>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>

            {/* Rotate Button */}
            {!isOverlay && onRotatePage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRotatePage(page.originalIndex);
                }}
                className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-all shadow-sm opacity-70 md:opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                title="Xoay trang 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Insert Blank Page After Button */}
            {!isOverlay && onAddBlankPageAfter && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBlankPageAfter(page.originalIndex);
                }}
                className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-sm opacity-70 md:opacity-0 group-hover:opacity-100 z-10 cursor-pointer animate-fade-in"
                title="Chèn trang trắng sau trang này"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
    
            {/* Page Number Badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium">
              {page.isBlank ? 'Trang trắng' : `Trang ${page.pageNumber}`}
            </div>
            
            {/* Hover Action hint */}
            {!isOverlay && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <span className="bg-white/90 text-slate-800 text-xs px-2 py-1 rounded shadow-sm font-medium">
                        {page.selected ? 'Bỏ chọn' : 'Chọn'}
                    </span>
                </div>
            )}
          </div>
        </div>
      );
}

// Sortable Item Wrapper
const SortablePageItem: React.FC<{ 
  page: PDFPage; 
  onTogglePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onAddBlankPageAfter: (index: number) => void;
  onRotatePage: (index: number) => void;
}> = ({ page, onTogglePage, onDeletePage, onAddBlankPageAfter, onRotatePage }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: String(page.originalIndex),
    animateLayoutChanges: (args) => defaultAnimateLayoutChanges({...args, wasDragging: true}),
  });

  // Use CSS.Translate.toString(transform) instead of CSS.Transform for better grid behavior
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 99 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="h-full focus:outline-none"
      {...attributes}
      {...listeners}
    >
      <PageCard 
        page={page} 
        isDragging={isDragging}
        onDeletePage={onDeletePage}
        onAddBlankPageAfter={onAddBlankPageAfter}
        onRotatePage={onRotatePage}
        onClick={() => {
            // Only toggle if not dragging
            if (!isDragging) onTogglePage(page.originalIndex);
        }} 
      />
    </div>
  );
};

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pages,
  onTogglePage,
  onReorder,
  onDeletePage,
  onAddBlankPageAfter,
  onRotatePage,
  onSelectRange,
  onSelectEven,
  onSelectOdd,
  onInvertSelection,
  onSelectBlank,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoomSize, setZoomSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [rangeInput, setRangeInput] = useState('');

  const handleApplyRange = () => {
    if (!rangeInput.trim() || !onSelectRange) return;
    const parts = rangeInput.split(',');
    const selectedNums = new Set<number>();

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(pages.length, Math.max(start, end));
          for (let i = min; i <= max; i++) {
            selectedNums.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= pages.length) {
          selectedNums.add(num);
        }
      }
    }

    if (selectedNums.size > 0) {
      onSelectRange(Array.from(selectedNums));
    }
  };

  const gridColsClass = useMemo(() => {
    switch (zoomSize) {
      case 'small':
        return "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7";
      case 'large':
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
      case 'medium':
      default:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
    }
  }, [zoomSize]);

  // Configure sensors for better UX:
  // Mouse: Drag after 10px movement (prevents accidental drags on click)
  // Touch: Drag after 250ms delay (allows scrolling, prevents accidental drags)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.id !== over?.id) {
      const oldIndex = pages.findIndex((p) => String(p.originalIndex) === String(active.id));
      const newIndex = pages.findIndex((p) => String(p.originalIndex) === String(over?.id));
      
      if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(arrayMove(pages, oldIndex, newIndex));
      }
    }
  };

  const activePage = useMemo(() => 
    activeId ? pages.find(p => String(p.originalIndex) === activeId) : null,
  [activeId, pages]);

  const itemIds = useMemo(() => 
    pages.map(p => String(p.originalIndex)), 
  [pages]);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.3',
        },
      },
    }),
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* ⚡ Thanh Công Cụ Năng Suất (UX Productivity & Quick Select Bar) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Quick Select Range Input & Smart Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Range syntax selector */}
          {onSelectRange && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyRange();
              }}
              className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/80 rounded-xl px-2.5 py-1"
            >
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Chọn nhanh:</span>
              <input
                type="text"
                placeholder="VD: 1-5, 8, 12"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                className="w-28 sm:w-36 bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
              >
                Chọn
              </button>
            </form>
          )}

          {/* Smart select buttons */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80">
            {onSelectOdd && (
              <button
                type="button"
                onClick={onSelectOdd}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white hover:text-teal-700 rounded-lg transition-all"
                title="Chọn tất cả trang lẻ (1, 3, 5...)"
              >
                Lẻ
              </button>
            )}
            {onSelectEven && (
              <button
                type="button"
                onClick={onSelectEven}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white hover:text-teal-700 rounded-lg transition-all"
                title="Chọn tất cả trang chẵn (2, 4, 6...)"
              >
                Chẵn
              </button>
            )}
            {onInvertSelection && (
              <button
                type="button"
                onClick={onInvertSelection}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white hover:text-teal-700 rounded-lg transition-all"
                title="Đảo ngược lựa chọn"
              >
                Đảo ngược
              </button>
            )}
            {onSelectBlank && pages.some(p => p.isBlank) && (
              <button
                type="button"
                onClick={onSelectBlank}
                className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-white rounded-lg transition-all"
                title="Chỉ chọn các trang trắng"
              >
                Trang trắng
              </button>
            )}
          </div>
        </div>

        {/* Right: Undo / Redo & Zoom Thumbnail Size Control */}
        <div className="flex items-center gap-3">
          {/* Undo / Redo buttons */}
          {(onUndo || onRedo) && (
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white hover:text-teal-700 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all flex items-center gap-1"
                title="Hoàn tác (Ctrl + Z)"
              >
                ↩️ <span className="hidden sm:inline">Hoàn tác</span>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white hover:text-teal-700 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all flex items-center gap-1"
                title="Làm lại (Ctrl + Y)"
              >
                ↪️ <span className="hidden sm:inline">Làm lại</span>
              </button>
            </div>
          )}

          {/* Zoom switcher */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setZoomSize('small')}
              className={clsx(
                "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                zoomSize === 'small' ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              )}
              title="Nhỏ (Nhiều trang trên 1 hàng)"
            >
              S
            </button>
            <button
              type="button"
              onClick={() => setZoomSize('medium')}
              className={clsx(
                "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                zoomSize === 'medium' ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              )}
              title="Vừa (Mặc định)"
            >
              M
            </button>
            <button
              type="button"
              onClick={() => setZoomSize('large')}
              className={clsx(
                "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                zoomSize === 'large' ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              )}
              title="Lớn (Xem chi tiết rõ nét)"
            >
              L
            </button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
              strategy: MeasuringStrategy.Always,
          }
        }}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className={`grid ${gridColsClass} gap-4 p-4 pb-24`}>
            {pages.map((page) => (
              <SortablePageItem
                key={page.originalIndex}
                page={page}
                onTogglePage={onTogglePage}
                onDeletePage={onDeletePage}
                onAddBlankPageAfter={onAddBlankPageAfter}
                onRotatePage={onRotatePage}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activePage ? (
            <div className="w-full h-full cursor-grabbing">
               <PageCard page={activePage} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
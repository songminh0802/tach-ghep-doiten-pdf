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

export const PDFViewer: React.FC<PDFViewerProps> = ({ pages, onTogglePage, onReorder, onDeletePage, onAddBlankPageAfter, onRotatePage }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 pb-24">
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
  );
};
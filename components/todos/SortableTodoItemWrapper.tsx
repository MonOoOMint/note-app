import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableTodoItemWrapperProps {
  id: string;
  children: React.ReactNode;
}

export function SortableTodoItemWrapper({ id, children }: SortableTodoItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative group ${isDragging ? "ring-2 ring-blue-500 rounded-xl shadow-xl" : ""}`}
    >
      <div 
        {...attributes}
        {...listeners}
        className="absolute left-[-16px] md:left-[-24px] top-1/2 -translate-y-1/2 cursor-grab hover:text-zinc-900 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity touch-none p-2 rounded hover:bg-black/5 z-10"
      >
        <GripVertical size={16} />
      </div>
      {children}
    </div>
  );
}

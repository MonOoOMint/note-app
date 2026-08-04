import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, GripVertical } from "lucide-react";
import { Group } from "./TodoGroupSidebar";

interface SortableGroupItemProps {
  group: Group;
  isActive: boolean;
  mode: 'todo' | 'checklist';
  onSelect: (id: string) => void;
}

export function SortableGroupItem({ group, isActive, mode, onSelect }: SortableGroupItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        onClick={() => onSelect(group.id)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
          isActive
            ? mode === 'todo'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold"
              : "bg-emerald-600 text-white shadow-md shadow-emerald-500/20 font-semibold"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 bg-transparent"
        } ${isDragging ? "ring-2 ring-blue-500 shadow-xl" : ""}`}
      >
        <div className="flex items-center space-x-3 truncate">
          <div 
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-zinc-900 -ml-2 text-zinc-400 touch-none flex items-center justify-center p-1 rounded hover:bg-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </div>
          <Folder size={18} className="shrink-0" />
          <span className="truncate">{group.name}</span>
        </div>
      </button>
    </div>
  );
}

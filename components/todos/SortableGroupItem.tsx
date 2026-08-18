import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, GripVertical, Edit2, Trash2 } from "lucide-react";
import { Group } from "./TodoGroupSidebar";

interface SortableGroupItemProps {
  group: Group;
  isActive: boolean;
  mode: 'todo' | 'checklist';
  count?: number;
  onSelect: (id: string) => void;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
}

export function SortableGroupItem({ 
  group, 
  isActive, 
  mode, 
  count,
  onSelect,
  onEdit,
  onDelete
}: SortableGroupItemProps) {
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
      <div
        onClick={() => onSelect(group.id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
          isActive
            ? mode === 'todo'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold"
              : "bg-emerald-600 text-white shadow-md shadow-emerald-500/20 font-semibold"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 bg-transparent"
        } ${isDragging ? "ring-2 ring-blue-500 shadow-xl" : ""}`}
      >
        <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0 pr-1">
          <div 
            {...attributes}
            {...listeners}
            className={`cursor-grab shrink-0 transition-opacity p-1 -ml-1 rounded touch-none ${
              isActive ? "text-white/70 hover:text-white" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
            onClick={(e) => e.stopPropagation()}
            title="Kéo để sắp xếp vị trí"
          >
            <GripVertical size={15} />
          </div>
          <Folder size={16} className={`shrink-0 ${isActive ? 'text-white' : mode === 'todo' ? 'text-blue-500' : 'text-emerald-500'}`} />
          <span className="truncate">{group.name}</span>
        </div>

        {/* Action icons & Count */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Action buttons (always visible on hover or when active) */}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(group);
              }}
              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive 
                  ? "hover:bg-white/20 text-white" 
                  : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-blue-400"
              }`}
              title="Chỉnh sửa danh mục"
            >
              <Edit2 size={13} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(group);
              }}
              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive 
                  ? "hover:bg-white/20 text-white" 
                  : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-400"
              }`}
              title="Xoá danh mục"
            >
              <Trash2 size={13} />
            </button>
          )}

          {count !== undefined && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
              isActive 
                ? "bg-white/20 text-white" 
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
            }`}>
              {count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

import { Plus, List, CheckSquare, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SortableGroupItem } from "./SortableGroupItem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface Group {
  id: string;
  name: string;
  description?: string;
  type?: 'todo' | 'checklist' | string;
  order?: number;
}

export function TodoGroupSidebar({
  groups = [],
  activeGroupId,
  mode,
  groupCounts = {},
  onSelectGroup,
  onAddNew,
  onEditGroup,
  onDeleteGroup,
  onModeChange,
  onUpdateGroupOrder,
}: {
  groups?: Group[];
  activeGroupId?: string;
  mode: 'todo' | 'checklist';
  groupCounts?: Record<string, number>;
  onSelectGroup: (id?: string) => void;
  onAddNew: () => void;
  onEditGroup?: (group: Group) => void;
  onDeleteGroup?: (group: Group) => void;
  onModeChange: (mode: 'todo' | 'checklist') => void;
  onUpdateGroupOrder?: (draggedId: string, targetId: string) => void;
}) {
  // Lọc nhóm theo chế độ hiện tại
  const filteredGroups = groups.filter((g) => {
    if (mode === 'checklist') {
      return g.type === 'checklist';
    }
    return !g.type || g.type === 'todo';
  });

  const sortedGroups = [...filteredGroups].sort((a, b) => (a.order || 0) - (b.order || 0));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onUpdateGroupOrder) {
      onUpdateGroupOrder(active.id.toString(), over.id.toString());
    }
  };

  return (
    <div className="w-full bg-transparent flex flex-col h-full overflow-hidden">
      {/* Segmented Mode Switcher */}
      <div className="p-3 pb-2 shrink-0">
        <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-inner">
          <button
            type="button"
            onClick={() => onModeChange('todo')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 ${
              mode === 'todo'
                ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <CheckSquare size={16} />
            <span>Công việc</span>
          </button>
          
          <button
            type="button"
            onClick={() => onModeChange('checklist')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 ${
              mode === 'checklist'
                ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <CheckCheck size={16} />
            <span>Checklist</span>
          </button>
        </div>
      </div>

      {/* Header title with Quick Add Button */}
      <div className="pt-2 pb-2 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-sm md:text-base tracking-tight text-zinc-900 dark:text-zinc-100">
            {mode === 'todo' ? "Danh sách việc" : "Danh mục Checklist"}
          </h2>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold">
            {filteredGroups.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors border ${
            mode === 'todo'
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          }`}
          title={mode === 'todo' ? "Tạo danh sách việc mới" : "Tạo danh mục checklist mới"}
        >
          <Plus size={14} />
          <span>Thêm</span>
        </button>
      </div>
      
      {/* List items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
        <button
          onClick={() => onSelectGroup(undefined)}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            !activeGroupId
              ? mode === 'todo'
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {mode === 'todo' ? <List size={18} /> : <CheckCheck size={18} />}
          <span>{mode === 'todo' ? "Tất cả công việc" : "Tất cả Checklist"}</span>
        </button>

        <div className="py-0.5"></div>

        <DndContext 
          id="todos-sidebar-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={sortedGroups.map(g => g.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedGroups.map((group) => (
              <SortableGroupItem
                key={group.id}
                group={group}
                isActive={activeGroupId === group.id}
                mode={mode}
                count={groupCounts[group.id] || 0}
                onSelect={onSelectGroup}
                onEdit={onEditGroup}
                onDelete={onDeleteGroup}
              />
            ))}
          </SortableContext>
        </DndContext>

        {filteredGroups.length === 0 && (
          <div className="text-center py-6 px-4 text-xs text-zinc-400">
            Chưa có danh mục nào. Bấm nút + Thêm ở trên để tạo mới.
          </div>
        )}
      </div>

      {/* Add new button at bottom */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/60 shrink-0 bg-white/40 dark:bg-zinc-950/40">
        <button 
          type="button"
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 font-semibold text-xs md:text-sm rounded-xl transition-all border shadow-sm ${
            mode === 'todo' 
              ? "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/40" 
              : "text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          }`}
          onClick={onAddNew}
        >
          <Plus size={16} />
          <span>{mode === 'todo' ? "Tạo danh sách mới" : "Tạo Checklist mới"}</span>
        </button>
      </div>
    </div>
  );
}

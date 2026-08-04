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
  onSelectGroup,
  onAddNew,
  onModeChange,
}: {
  groups?: Group[];
  activeGroupId?: string;
  mode: 'todo' | 'checklist';
  onSelectGroup: (id?: string) => void;
  onAddNew: () => void;
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
    <div className="w-full bg-transparent flex flex-col h-full">
      {/* Segmented Mode Switcher */}
      <div className="p-4 pb-2">
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

      {/* Header title */}
      <div className="pt-3 pb-3 px-6 flex items-center justify-between">
        <h2 className="font-bold text-lg md:text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
          {mode === 'todo' ? "Danh sách việc" : "Danh mục Checklist"}
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold">
          {filteredGroups.length}
        </span>
      </div>
      
      {/* List items */}
      <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-4">
        <button
          onClick={() => onSelectGroup(undefined)}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
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

        <div className="py-1"></div>

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
                onSelect={onSelectGroup}
              />
            ))}
          </SortableContext>
        </DndContext>

        {filteredGroups.length === 0 && (
          <div className="text-center py-6 px-4 text-xs text-zinc-400">
            Chưa có danh mục nào. Bấm tạo mới bên dưới.
          </div>
        )}
      </div>

      {/* Add new button */}
      <div className="p-4 pb-8 lg:pb-4 mt-auto border-t border-zinc-100 dark:border-zinc-800/50">
        <Button 
          variant="ghost" 
          className={`w-full justify-start font-semibold rounded-xl transition-all ${
            mode === 'todo' 
              ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" 
              : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          }`}
          onClick={onAddNew}
        >
          <Plus size={18} className="mr-2" />
          {mode === 'todo' ? "Tạo danh sách mới" : "Tạo Checklist mới"}
        </Button>
      </div>
    </div>
  );
}

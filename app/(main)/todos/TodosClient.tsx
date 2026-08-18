"use client";

import { useState } from "react";
import { 
  Menu, 
  X, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  RotateCcw, 
  CheckCheck, 
  Trash,
  CheckSquare,
  Sparkles
} from "lucide-react";
import { TodoGroupSidebar, Group } from "@/components/todos/TodoGroupSidebar";
import { TodoInput } from "@/components/todos/TodoInput";
import { TodoItem, Todo } from "@/components/todos/TodoItem";
import { ChecklistInput } from "@/components/todos/ChecklistInput";
import { ChecklistItem } from "@/components/todos/ChecklistItem";
import { EditTodoModal } from "@/components/todos/EditTodoModal";
import { SortableTodoItemWrapper } from "@/components/todos/SortableTodoItemWrapper";
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
import { PushNotificationButton } from "@/components/ui/PushNotificationButton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useRef, useEffect } from "react";

// Polyfill removed due to touch device freezing issues

export type TodoType = {
  id: string;
  user_id: string;
  content: string;
  is_done: boolean;
  group_id: string | null;
  due_date?: string | null;
  recurrence?: "none" | "daily" | "weekly" | null;
  weekly_days?: number[] | null;
  last_completed_at?: string | null;
  type?: "todo" | "checklist" | string | null;
  order?: number;
};

export default function TodosClient({ 
  initialGroups, 
  initialTodos,
  userId
}: { 
  initialGroups: Group[], 
  initialTodos: TodoType[],
  userId: string
}) {
  const [mode, setMode] = useState<"todo" | "checklist">("todo");
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [todos, setTodos] = useState<TodoType[]>(initialTodos);
  
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Drag & Drop State cho Todos
  const dragTodoRef = useRef<string | null>(null);
  const [draggedTodo, setDraggedTodo] = useState<string | null>(null);
  const [dragOverTodo, setDragOverTodo] = useState<string | null>(null);

  // Global fallback để chống kẹt trạng thái kéo thả (đặc biệt trên giả lập mobile)
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (dragTodoRef.current) {
        dragTodoRef.current = null;
        setDraggedTodo(null);
        setDragOverTodo(null);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalDragEnd);
    window.addEventListener('touchend', handleGlobalDragEnd);
    window.addEventListener('dragend', handleGlobalDragEnd);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalDragEnd);
      window.removeEventListener('touchend', handleGlobalDragEnd);
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);
  
  // Modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{id?: string, name: string, description: string} | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Custom Confirm & Alert Modal States
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "info" | "success" | "error" | "warning";
  }>({
    isOpen: false,
    message: "",
  });

  const supabase = createClient();

  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Lọc theo chế độ: Todo vs Checklist
  const currentModeTodos = todos.filter((t) => {
    if (mode === "checklist") {
      return t.type === "checklist";
    }
    // Mặc định hoặc type === 'todo'
    return !t.type || t.type === "todo";
  });

  // Sắp xếp các danh sách theo order
  const displayItems = activeGroupId 
    ? currentModeTodos.filter(t => t.group_id === activeGroupId) 
    : currentModeTodos;
  
  const sortedDisplayItems = [...displayItems].sort((a, b) => (a.order || 0) - (b.order || 0));

  const incompleteItems = sortedDisplayItems.filter(t => !t.is_done);
  const completedItems = sortedDisplayItems.filter(t => t.is_done);

  // Tính % hoàn thành cho Checklist
  const totalCount = displayItems.length;
  const completedCount = completedItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // --- ACTIONS CHO TODO (CÔNG VIỆC) ---
  const handleAddTodo = async (content: string, dueDate?: string, recurrence?: "none" | "daily" | "weekly", weeklyDays?: number[]) => {
    const newOrder = displayItems.length;
    const { data, error } = await supabase.from('todos').insert({
      user_id: userId,
      group_id: activeGroupId || null, 
      content,
      is_done: false,
      type: 'todo',
      due_date: dueDate || null,
      recurrence: recurrence || 'none',
      weekly_days: weeklyDays || [],
      order: newOrder
    }).select().single();

    if (data && !error) {
      setTodos(prev => [...prev, data]);
    } else if (error) {
      console.error("Error adding todo:", error);
      setAlertConfig({
        isOpen: true,
        title: "Lỗi thêm công việc",
        message: error.message || "Không thể thêm công việc",
        type: "error"
      });
    }
  };

  // --- ACTIONS CHO CHECKLIST (DANH SÁCH KIỂM TRA) ---
  const handleAddChecklist = async (content: string) => {
    const newOrder = displayItems.length;
    const { data, error } = await supabase.from('todos').insert({
      user_id: userId,
      group_id: activeGroupId || null,
      content,
      is_done: false,
      type: 'checklist',
      due_date: null,
      recurrence: 'none',
      weekly_days: [],
      order: newOrder
    }).select().single();

    if (data && !error) {
      setTodos(prev => [...prev, data]);
    } else if (error) {
      console.error("Error adding checklist item:", error);
      setAlertConfig({
        isOpen: true,
        title: "Lỗi thêm mục kiểm tra",
        message: error.message || "Không thể thêm mục kiểm tra",
        type: "error"
      });
    }
  };

  const handleEditChecklistContent = async (id: string, newContent: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, content: newContent } : t));
    const { error } = await supabase.from('todos').update({ content: newContent }).eq('id', id);
    if (error) console.error(error);
  };

  // Reset Checklist (Bỏ tick tất cả để tái sử dụng)
  const handleResetChecklist = async () => {
    const idsToReset = displayItems.filter(t => t.is_done).map(t => t.id);
    if (idsToReset.length === 0) return;

    setTodos(todos.map(t => idsToReset.includes(t.id) ? { ...t, is_done: false, last_completed_at: null } : t));

    const { error } = await supabase.from('todos')
      .update({ is_done: false, last_completed_at: null })
      .in('id', idsToReset);
    if (error) console.error(error);
  };

  // Xoá tất cả các mục checklist đã hoàn thành
  const handleClearCompletedChecklist = () => {
    const idsToDelete = completedItems.map(t => t.id);
    if (idsToDelete.length === 0) return;

    setConfirmConfig({
      isOpen: true,
      title: "Xoá mục đã hoàn thành",
      message: `Bạn có chắc chắn muốn xoá ${idsToDelete.length} mục đã hoàn thành khỏi danh sách?`,
      confirmText: "Xoá các mục",
      variant: "danger",
      onConfirm: async () => {
        setTodos(todos.filter(t => !idsToDelete.includes(t.id)));
        const { error } = await supabase.from('todos').delete().in('id', idsToDelete);
        if (error) console.error(error);
      },
    });
  };

  // --- ACTIONS CHUNG ---
  const getGroupName = (groupId?: string | null) => {
    if (!groupId) return undefined;
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : undefined;
  };

  const handleToggleItem = async (id: string, currentStatus: boolean) => {
    const isDone = !currentStatus;
    const lastCompletedAt = isDone ? new Date().toISOString() : null;

    // Optimistic update
    setTodos(todos.map(t => t.id === id ? { ...t, is_done: isDone, last_completed_at: lastCompletedAt } : t));

    const { error } = await supabase.from('todos').update({
      is_done: isDone,
      last_completed_at: lastCompletedAt
    }).eq('id', id);

    if (error) console.error(error);
  };

  const handleDeleteItem = async (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
    await supabase.from('todos').delete().eq('id', id);
  };

  const handleEditTodo = async (id: string, updates: Partial<Todo>) => {
    setTodos(todos.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from('todos').update(updates).eq('id', id);
    if (error) console.error(error);
    setEditingTodo(null);
  };

  const handleToggleAll = async (status: boolean) => {
    const idsToUpdate = displayItems.filter(t => t.is_done !== status).map(t => t.id);
    if (idsToUpdate.length === 0) return;
    
    const completedAt = status ? new Date().toISOString() : null;
    setTodos(todos.map(t => idsToUpdate.includes(t.id) ? { ...t, is_done: status, last_completed_at: completedAt } : t));

    const { error } = await supabase.from('todos')
      .update({ is_done: status, last_completed_at: completedAt })
      .in('id', idsToUpdate);
        
    if (error) console.error(error);
  };

  // Đếm số lượng task/checklist theo từng nhóm
  const groupCounts = todos.reduce((acc, t) => {
    if (t.group_id) {
      const isChecklist = t.type === 'checklist';
      if ((mode === 'checklist' && isChecklist) || (mode === 'todo' && !isChecklist)) {
        acc[t.group_id] = (acc[t.group_id] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<string, number>);

  // --- GROUP ACTIONS ---
  const handleSelectGroup = (id?: string) => {
    setActiveGroupId(id);
    setIsMobileMenuOpen(false);
  };

  const handleModeChange = (newMode: "todo" | "checklist") => {
    setMode(newMode);
    setActiveGroupId(undefined); // Reset active group when switching modes
  };

  const openNewGroupModal = () => {
    setEditingGroup({ name: "", description: "" });
    setIsGroupModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const openEditGroupModal = (groupToEdit?: Group) => {
    const g = groupToEdit || activeGroup;
    if (!g) return;
    setEditingGroup({ id: g.id, name: g.name, description: g.description || "" });
    setIsGroupModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editingGroup.name.trim()) return;

    if (editingGroup.id) {
      // Edit
      const { data, error } = await supabase.from('groups').update({
        name: editingGroup.name.trim(),
        description: editingGroup.description.trim()
      }).eq('id', editingGroup.id).select().single();

      if (data && !error) {
        setGroups(groups.map(g => g.id === editingGroup.id ? data : g));
      } else if (error) {
        console.error("Error updating group:", error);
        setAlertConfig({
          isOpen: true,
          title: "Lỗi cập nhật",
          message: error.message || "Không thể cập nhật danh mục",
          type: "error"
        });
      }
    } else {
      // Create with active mode type
      const currentModeGroups = groups.filter(g => (mode === 'checklist' ? g.type === 'checklist' : (!g.type || g.type === 'todo')));
      const { data, error } = await supabase.from('groups').insert({
        user_id: userId,
        name: editingGroup.name.trim(),
        description: editingGroup.description.trim(),
        type: mode,
        order: currentModeGroups.length
      }).select().single();

      if (data && !error) {
        setGroups([...groups, data]);
        setActiveGroupId(data.id);
      } else if (error) {
        console.error("Error creating group:", error);
        setAlertConfig({
          isOpen: true,
          title: "Lỗi tạo danh mục",
          message: error.message || "Không thể tạo danh mục mới",
          type: "error"
        });
      }
    }
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = (groupToDelete?: Group) => {
    const target = groupToDelete || activeGroup;
    if (!target) return;
    const groupName = target.name || "danh mục này";
    
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận xoá danh mục",
      message: `Bạn có chắc chắn muốn xoá danh mục "${groupName}"? Các công việc bên trong sẽ không bị mất mà được chuyển về mục chung.`,
      confirmText: "Xoá danh mục",
      variant: "danger",
      onConfirm: async () => {
        const idToDelete = target.id;
        if (activeGroupId === idToDelete) {
          setActiveGroupId(undefined);
        }
        setGroups(prev => prev.filter(g => g.id !== idToDelete));
        const { error } = await supabase.from('groups').delete().eq('id', idToDelete);
        if (error) {
          console.error("Error deleting group:", error);
          setAlertConfig({
            isOpen: true,
            title: "Lỗi xoá danh mục",
            message: error.message || "Không thể xoá danh mục",
            type: "error"
          });
        }
      },
    });
  };

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

  const handleTodoDragEndDndKit = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = active.id.toString();
    const targetId = over.id.toString();

    const draggedItem = todos.find(t => t.id === draggedId);
    const targetItem = todos.find(t => t.id === targetId);

    if (!draggedItem || !targetItem || draggedItem.is_done !== targetItem.is_done) return;

    const currentList = draggedItem.is_done 
      ? [...completedItems].sort((a,b) => (a.order || 0) - (b.order || 0)) 
      : [...incompleteItems].sort((a,b) => (a.order || 0) - (b.order || 0));

    const draggedIdx = currentList.findIndex(t => t.id === draggedId);
    const targetIdx = currentList.findIndex(t => t.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const [removed] = currentList.splice(draggedIdx, 1);
    currentList.splice(targetIdx, 0, removed);

    const updatedList = currentList.map((t, index) => ({ ...t, order: index }));
    const newTodos = todos.map(t => {
      const updatedItem = updatedList.find(u => u.id === t.id);
      return updatedItem ? { ...t, order: updatedItem.order } : t;
    });

    setTodos(newTodos);

    for (const item of updatedList) {
      await supabase.from('todos').update({ order: item.order }).eq('id', item.id);
    }
  };

  const handleUpdateGroupOrder = async (draggedId: string, targetId: string) => {
    const currentGroups = [...groups].sort((a,b) => (a.order || 0) - (b.order || 0));
    const draggedIdx = currentGroups.findIndex(g => g.id === draggedId);
    const targetIdx = currentGroups.findIndex(g => g.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    const [removed] = currentGroups.splice(draggedIdx, 1);
    currentGroups.splice(targetIdx, 0, removed);

    const updatedGroups = currentGroups.map((g, index) => ({ ...g, order: index }));
    setGroups(updatedGroups);

    for (const group of updatedGroups) {
      await supabase.from('groups').update({ order: group.order }).eq('id', group.id);
    }
  };

  // --- CLIENT-SIDE RECURRING TASKS RESET ---
  useEffect(() => {
    let hasChanges = false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayDayOfWeek = now.getDay();

    const updatedTodos = todos.map(t => {
      if (!t.is_done || !t.recurrence || t.recurrence === "none" || !t.last_completed_at) {
        return t;
      }
      
      const lastCompletedDate = new Date(t.last_completed_at);
      const lastCompletedStr = `${lastCompletedDate.getFullYear()}-${lastCompletedDate.getMonth()}-${lastCompletedDate.getDate()}`;

      // If it was completed today, do not reset
      if (lastCompletedStr === todayStr) {
        return t;
      }

      // It was completed on a previous day. Check if we should reset it today.
      let shouldReset = false;

      if (t.recurrence === "daily") {
        shouldReset = true;
      } else if (t.recurrence === "weekly" && t.weekly_days) {
        if (t.weekly_days.includes(todayDayOfWeek)) {
          shouldReset = true;
        }
      }

      if (shouldReset) {
        hasChanges = true;
        // Optimistic update locally, and update supabase
        supabase.from('todos').update({
          is_done: false,
          last_completed_at: null
        }).eq('id', t.id).then(({error}) => {
          if(error) console.error("Error resetting recurring task", error);
        });
        return { ...t, is_done: false, last_completed_at: null };
      }

      return t;
    });

    if (hasChanges) {
      setTodos(updatedTodos);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full w-full relative">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full w-72 border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md">
        <TodoGroupSidebar
          groups={groups}
          activeGroupId={activeGroupId}
          mode={mode}
          groupCounts={groupCounts}
          onSelectGroup={setActiveGroupId}
          onAddNew={openNewGroupModal}
          onEditGroup={openEditGroupModal}
          onDeleteGroup={handleDeleteGroup}
          onModeChange={handleModeChange}
          onUpdateGroupOrder={handleUpdateGroupOrder}
        />
      </div>
      
      {/* Mobile Drawer Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-[85%] max-w-sm h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col pt-14 animate-in slide-in-from-left duration-200">
             <div className="absolute top-6 right-4 z-10">
               <button 
                 onClick={() => setIsMobileMenuOpen(false)}
                 className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
               >
                 <X size={20} />
               </button>
             </div>
             <TodoGroupSidebar
               groups={groups}
               activeGroupId={activeGroupId}
               mode={mode}
               groupCounts={groupCounts}
               onSelectGroup={(id) => {
                 setActiveGroupId(id);
                 setIsMobileMenuOpen(false);
               }}
               onAddNew={openNewGroupModal}
               onEditGroup={openEditGroupModal}
               onDeleteGroup={handleDeleteGroup}
               onModeChange={handleModeChange}
               onUpdateGroupOrder={handleUpdateGroupOrder}
             />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 min-w-0 overflow-hidden">
        <header className="px-4 lg:px-6 py-6 lg:py-8 max-w-3xl w-full mx-auto flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="flex items-center gap-2 lg:gap-3">
                  <button 
                    className="lg:hidden p-1.5 -ml-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
                    onClick={() => setIsMobileMenuOpen(true)}
                  >
                    <Menu size={22} />
                  </button>
                  <h1 
                    onClick={activeGroup ? () => openEditGroupModal(activeGroup) : undefined}
                    className={`text-2xl lg:text-3xl font-bold tracking-tight truncate ${
                      activeGroup ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                    } ${
                      mode === 'checklist' 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-blue-600 dark:text-blue-500"
                    }`}
                    title={activeGroup ? "Bấm để đổi tên hoặc sửa mô tả danh mục" : undefined}
                  >
                    {activeGroup 
                      ? activeGroup.name 
                      : mode === 'checklist' ? "Tất cả Checklist" : "Tất cả công việc"
                    }
                  </h1>
                </div>
                {activeGroup && activeGroup.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {activeGroup.description}
                  </p>
                )}
              </div>
            </div>
            
            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Create Group Button when on All View */}
              {!activeGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openNewGroupModal()}
                  className={`text-xs h-8 px-2.5 rounded-lg flex items-center gap-1 border transition-colors ${
                    mode === 'todo'
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/40 hover:bg-blue-100"
                      : "text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/40 hover:bg-emerald-100"
                  }`}
                  title={mode === 'todo' ? "Tạo danh sách việc mới" : "Tạo danh mục checklist mới"}
                >
                  <Plus size={14} />
                  <span className="hidden sm:inline">{mode === 'todo' ? "Tạo danh sách" : "Tạo danh mục"}</span>
                </Button>
              )}

              {mode === 'checklist' ? (
                /* Checklist Action Buttons */
                <>
                  {completedCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleResetChecklist}
                      className="text-xs h-8 px-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1"
                      title="Bỏ chọn tất cả (Đặt lại để tái sử dụng checklist)"
                    >
                      <RotateCcw size={14} />
                      <span className="hidden sm:inline">Đặt lại</span>
                    </Button>
                  )}
                  {completedCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearCompletedChecklist}
                      className="text-xs h-8 px-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                      title="Xoá các mục đã đánh dấu hoàn thành"
                    >
                      <Trash size={14} />
                      <span className="hidden sm:inline">Xoá xong</span>
                    </Button>
                  )}
                </>
              ) : (
                /* Todo Action Buttons */
                <>
                  {displayItems.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleToggleAll(incompleteItems.length > 0)} 
                      className="text-zinc-500 hover:text-blue-600 w-8 h-8 rounded-lg"
                      title={incompleteItems.length > 0 ? "Đánh dấu tất cả hoàn thành" : "Bỏ hoàn thành tất cả"}
                    >
                      {incompleteItems.length > 0 ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </Button>
                  )}
                  <PushNotificationButton userId={userId} />
                </>
              )}

              {/* Group Edit / Delete */}
              {activeGroup && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => openEditGroupModal(activeGroup)} 
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 w-8 h-8 rounded-lg" 
                    title="Sửa danh mục"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteGroup(activeGroup)} 
                    className="text-zinc-500 hover:text-red-500 w-8 h-8 rounded-lg" 
                    title="Xoá danh mục"
                  >
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Checklist Progress Bar */}
          {mode === 'checklist' && totalCount > 0 && (
            <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span>Tiến độ: {completedCount}/{totalCount} mục</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Input Section */}
          {mode === 'checklist' ? (
            <ChecklistInput onAdd={handleAddChecklist} />
          ) : (
            <TodoInput onAdd={handleAddTodo} />
          )}
        </header>

        {/* Items List Area */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-24 lg:pb-10 w-full overflow-x-hidden">
          <div className="max-w-3xl mx-auto space-y-6">
            <DndContext id="todos-list-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTodoDragEndDndKit}>
              {/* Incomplete Items */}
              <div className="space-y-2">
                {incompleteItems.length === 0 && (
                  <div className="text-center py-12 text-zinc-400 text-sm">
                    {mode === 'checklist' 
                      ? "Danh sách kiểm tra trống. Nhập mục mới ở trên!" 
                      : "Không có công việc nào. Thêm việc mới ở trên!"
                    }
                  </div>
                )}

                <SortableContext items={incompleteItems.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {incompleteItems.map(todo => (
                    <SortableTodoItemWrapper key={todo.id} id={todo.id}>
                      {mode === "todo" ? (
                        <TodoItem 
                          todo={todo}
                          groupName={!activeGroupId ? getGroupName(todo.group_id) : undefined}
                          onToggle={handleToggleItem}
                          onDelete={handleDeleteItem}
                          onEdit={setEditingTodo}
                        />
                      ) : (
                        <ChecklistItem
                          item={todo}
                          groupName={!activeGroupId ? getGroupName(todo.group_id) : undefined}
                          onToggle={handleToggleItem}
                          onDelete={handleDeleteItem}
                          onEdit={handleEditChecklistContent}
                        />
                      )}
                    </SortableTodoItemWrapper>
                  ))}
                </SortableContext>
              </div>

              {/* Completed Items */}
              {completedItems.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Đã hoàn thành ({completedItems.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <SortableContext items={completedItems.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {completedItems.map(todo => (
                        <SortableTodoItemWrapper key={todo.id} id={todo.id}>
                          {mode === "todo" ? (
                            <TodoItem 
                              todo={todo}
                              groupName={!activeGroupId ? getGroupName(todo.group_id) : undefined}
                              onToggle={handleToggleItem}
                              onDelete={handleDeleteItem}
                              onEdit={setEditingTodo}
                            />
                          ) : (
                            <ChecklistItem
                              item={todo}
                              groupName={!activeGroupId ? getGroupName(todo.group_id) : undefined}
                              onToggle={handleToggleItem}
                              onDelete={handleDeleteItem}
                              onEdit={handleEditChecklistContent}
                            />
                          )}
                        </SortableTodoItemWrapper>
                      ))}
                    </SortableContext>
                  </div>
                </div>
              )}
            </DndContext>
          </div>
        </div>
      </div>

      {/* Edit Todo Modal (for standard tasks) */}
      {editingTodo && (
        <EditTodoModal 
          todo={editingTodo} 
          onClose={() => setEditingTodo(null)} 
          onSave={handleEditTodo} 
        />
      )}

      {/* Add/Edit Group Modal */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsGroupModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl p-6 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingGroup.id 
                  ? (mode === 'checklist' ? "Sửa danh mục Checklist" : "Sửa danh sách việc") 
                  : (mode === 'checklist' ? "Tạo danh mục Checklist mới" : "Tạo danh sách việc mới")
                }
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên danh mục
                </label>
                <Input
                  autoFocus
                  required
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                  placeholder={mode === 'checklist' ? "Ví dụ: Đi chợ, Đồ du lịch, Quy trình..." : "Ví dụ: Công việc, Cá nhân..."}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mô tả (tuỳ chọn)
                </label>
                <textarea
                  value={editingGroup.description}
                  onChange={(e) => setEditingGroup({...editingGroup, description: e.target.value})}
                  placeholder="Mô tả mục đích danh mục này..."
                  className="w-full flex min-h-[80px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setIsGroupModalOpen(false)}>
                  Huỷ
                </Button>
                <Button 
                  type="submit" 
                  className={mode === 'checklist' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
                >
                  {editingGroup.id ? "Lưu thay đổi" : "Tạo danh mục"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Todo } from "@/components/todos/TodoItem";

const DAYS = [
  { label: 'T2', value: 1 },
  { label: 'T3', value: 2 },
  { label: 'T4', value: 3 },
  { label: 'T5', value: 4 },
  { label: 'T6', value: 5 },
  { label: 'T7', value: 6 },
  { label: 'CN', value: 0 },
];

export function EditTodoModal({
  todo,
  onClose,
  onSave
}: {
  todo: Todo;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Todo>) => void;
}) {
  const [content, setContent] = useState(todo.content);
  const [dueDate, setDueDate] = useState(todo.due_date || "");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly">(todo.recurrence || "none");
  const [weeklyDays, setWeeklyDays] = useState<number[]>(todo.weekly_days || []);

  const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    onSave(todo.id, {
      content: content.trim(),
      due_date: dueDate || null,
      recurrence,
      weekly_days: recurrence === 'weekly' ? weeklyDays : null,
    } as any);
  };

  const toggleDay = (day: number) => {
    if (weeklyDays.includes(day)) {
      setWeeklyDays(weeklyDays.filter(d => d !== day));
    } else {
      setWeeklyDays([...weeklyDays, day]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <form 
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 rounded-t-2xl bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Sửa công việc</h2>
          <Button variant="ghost" size="icon" type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <X size={20} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tên công việc</label>
            <Input 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập tên công việc..."
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2 relative z-30">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Thiết lập thời gian</label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Due Date */}
              <label className="relative flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer overflow-hidden">
                <Calendar size={16} className="shrink-0 z-10 pointer-events-none text-zinc-500" />
                {dueDate ? (
                  <div className="flex items-center gap-1.5 z-10">
                    <input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-transparent text-sm outline-none cursor-pointer text-zinc-900 dark:text-zinc-100 font-medium"
                      onClick={(e) => 'showPicker' in HTMLInputElement.prototype && (e.currentTarget as any).showPicker()}
                    />
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDueDate(""); }}
                      className="hover:text-red-500 rounded-full p-0.5 transition-colors text-zinc-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium z-10 pointer-events-none">Không thời hạn</span>
                    <input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      onClick={(e) => 'showPicker' in HTMLInputElement.prototype && (e.currentTarget as any).showPicker()}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                      style={{ WebkitAppearance: 'none' }}
                    />
                  </>
                )}
              </label>

              {/* Recurrence */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRecurrenceMenu(!showRecurrenceMenu)}
                  className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Repeat size={16} className="shrink-0 text-zinc-500" />
                  <span className="text-sm font-medium">
                    {recurrence === 'none' ? 'Không lặp lại' : recurrence === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}
                  </span>
                </button>

                {showRecurrenceMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRecurrenceMenu(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                      <div 
                        className="px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                        onClick={() => { setRecurrence('none'); setShowRecurrenceMenu(false); }}
                      >Không lặp lại</div>
                      <div 
                        className="px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                        onClick={() => { setRecurrence('daily'); setShowRecurrenceMenu(false); }}
                      >Hàng ngày</div>
                      <div 
                        className="px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                        onClick={() => { setRecurrence('weekly'); setShowRecurrenceMenu(false); }}
                      >Hàng tuần</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Weekly Days */}
            {recurrence === 'weekly' && (
              <div className="flex items-center gap-2 animate-in slide-in-from-top-1 fade-in mt-2 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                <span className="text-xs font-semibold text-zinc-500 mr-1 uppercase tracking-wider">Ngày:</span>
                {DAYS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                      weeklyDays.includes(day.value) 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                        : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl relative z-10">
          <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-600 hover:text-zinc-900">
            Huỷ
          </Button>
          <Button type="submit" disabled={!content.trim()} className="bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 px-6 font-semibold">
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </div>
  );
}

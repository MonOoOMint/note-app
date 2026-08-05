"use client";

import { useState } from "react";
import { Calendar, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const DAYS = [
  { label: 'T2', value: 1 },
  { label: 'T3', value: 2 },
  { label: 'T4', value: 3 },
  { label: 'T5', value: 4 },
  { label: 'T6', value: 5 },
  { label: 'T7', value: 6 },
  { label: 'CN', value: 0 },
];

export function TodoInput({ 
  onAdd 
}: { 
  onAdd: (content: string, dueDate?: string, recurrence?: "none" | "daily" | "weekly", weeklyDays?: number[]) => void 
}) {
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly">("none");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim(), dueDate || undefined, recurrence, recurrence === 'weekly' ? weeklyDays : undefined);
    
    // Reset
    setValue("");
    setDueDate("");
    setRecurrence("none");
    setWeeklyDays([]);
    setIsExpanded(false);
    setShowRecurrenceMenu(false);
  };

  const toggleDay = (day: number) => {
    if (weeklyDays.includes(day)) {
      setWeeklyDays(weeklyDays.filter(d => d !== day));
    } else {
      setWeeklyDays([...weeklyDays, day]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col bg-zinc-100 dark:bg-zinc-900/60 border border-transparent dark:border-zinc-800 rounded-2xl overflow-visible transition-all focus-within:ring-1 focus-within:ring-zinc-300 dark:focus-within:ring-zinc-700">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsExpanded(true)}
        placeholder="Add a new task..."
        className="w-full bg-transparent px-4 py-3 md:py-4 focus:outline-none text-sm md:text-base placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
      />
      
      {isExpanded && (
        <div className="flex flex-col gap-3 px-4 pb-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Due Date Picker */}
            <label className="relative flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer overflow-hidden">
              <Calendar size={14} className="shrink-0 z-10 pointer-events-none" />
              {dueDate ? (
                <div className="flex items-center gap-1.5 z-10 relative">
                  <span className="text-xs font-medium z-10 pointer-events-none text-zinc-900 dark:text-zinc-100">
                    {dueDate.split('-').reverse().join('/')}
                  </span>
                  <input 
                    type="date" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                    style={{ WebkitAppearance: 'none' }}
                    onClick={(e) => 'showPicker' in HTMLInputElement.prototype && (e.currentTarget as any).showPicker()}
                  />
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDueDate(""); }}
                    className="hover:text-red-500 rounded-full p-0.5 transition-colors relative z-30"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-medium z-10 pointer-events-none">Không thời hạn</span>
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

            {/* Custom Recurrence Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRecurrenceMenu(!showRecurrenceMenu)}
                className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <Repeat size={14} className="shrink-0" />
                <span className="text-xs font-medium">
                  {recurrence === 'none' ? 'Không lặp lại' : recurrence === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}
                </span>
              </button>

              {showRecurrenceMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRecurrenceMenu(false)}></div>
                  <div className="absolute top-full left-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                    <div 
                      className="px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => { setRecurrence('none'); setShowRecurrenceMenu(false); }}
                    >Không lặp lại</div>
                    <div 
                      className="px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => { setRecurrence('daily'); setShowRecurrenceMenu(false); }}
                    >Hàng ngày</div>
                    <div 
                      className="px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => { setRecurrence('weekly'); setShowRecurrenceMenu(false); }}
                    >Hàng tuần</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Weekly Days Selector */}
          {recurrence === 'weekly' && (
             <div className="flex items-center gap-1.5 animate-in slide-in-from-top-1 fade-in mt-1">
               <span className="text-[11px] font-medium text-zinc-500 mr-1 uppercase tracking-wider">Ngày:</span>
               {DAYS.map(day => (
                 <button
                   key={day.value}
                   type="button"
                   onClick={() => toggleDay(day.value)}
                   className={`w-7 h-7 rounded-full text-[10px] font-bold transition-colors flex items-center justify-center ${
                     weeklyDays.includes(day.value) 
                       ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm" 
                       : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                   }`}
                 >
                   {day.label}
                 </button>
               ))}
             </div>
          )}
          
          <div className="flex items-center gap-2 ml-auto mt-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsExpanded(false);
                setShowRecurrenceMenu(false);
              }}
              className="text-xs h-8 text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
            >
              Huỷ
            </Button>
            <Button type="submit" size="sm" disabled={!value.trim()} className="h-8 rounded-lg px-5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 border-none transition-all duration-300">
              Thêm
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

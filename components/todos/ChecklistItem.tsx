"use client";

import { useState } from "react";
import { Check, Trash2, Edit2, Folder, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ChecklistItemType {
  id: string;
  content: string;
  is_done: boolean;
  group_id?: string | null;
  type?: string | null;
}

export function ChecklistItem({
  item,
  groupName,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: ChecklistItemType;
  groupName?: string;
  onToggle: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newContent: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.content);

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editValue.trim() && editValue.trim() !== item.content) {
      onEdit(item.id, editValue.trim());
    } else {
      setEditValue(item.content);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditValue(item.content);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className={`group flex items-center gap-3 p-3 md:p-3.5 bg-white dark:bg-zinc-900/70 rounded-xl border transition-all duration-200 ${
        item.is_done 
          ? "border-zinc-200/50 dark:border-zinc-800/40 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-70" 
          : "border-zinc-200/80 dark:border-zinc-800/70 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-sm"
      }`}
    >
      {/* Checkbox button */}
      <button
        type="button"
        onClick={() => onToggle(item.id, item.is_done)}
        className={`w-5 h-5 md:w-5.5 md:h-5.5 rounded-lg flex items-center justify-center border-2 transition-all duration-200 shrink-0 ${
          item.is_done
            ? "bg-emerald-600 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-500 shadow-sm shadow-emerald-500/30"
            : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-500 dark:hover:border-emerald-400 bg-white dark:bg-zinc-950"
        }`}
      >
        {item.is_done && <Check size={13} className="text-white font-bold stroke-[3]" />}
      </button>

      {/* Content text or inline editor */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="w-full flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm md:text-base outline-none text-zinc-900 dark:text-zinc-100"
            />
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span 
              onClick={() => onToggle(item.id, item.is_done)}
              onDoubleClick={() => setIsEditing(true)}
              className={`text-sm md:text-base cursor-pointer select-none transition-all ${
                item.is_done 
                  ? "line-through text-zinc-400 dark:text-zinc-500" 
                  : "text-zinc-800 dark:text-zinc-200 font-medium"
              }`}
            >
              {item.content}
            </span>
            {groupName && (
              <span className="text-[10px] md:text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md font-medium border border-emerald-200/60 dark:border-emerald-500/20">
                <Folder size={10} className="mr-1" />
                {groupName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 w-7 h-7 md:w-8 md:h-8 rounded-lg"
          onClick={() => setIsEditing(true)}
          title="Chỉnh sửa"
        >
          <Edit2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-red-500 w-7 h-7 md:w-8 md:h-8 rounded-lg"
          onClick={() => onDelete(item.id)}
          title="Xoá mục"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

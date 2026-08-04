"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ChecklistInput({ 
  onAdd 
}: { 
  onAdd: (content: string) => void 
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-1.5 pl-4 transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 shadow-sm">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Thêm mục kiểm tra mới (nhấn Enter để lưu)..."
        className="flex-1 bg-transparent py-2.5 md:py-3 focus:outline-none text-sm md:text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-zinc-100"
      />
      <Button 
        type="submit" 
        size="sm" 
        disabled={!value.trim()} 
        className="h-9 md:h-10 rounded-xl px-4 text-xs md:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <Plus size={16} />
        <span>Thêm</span>
      </Button>
    </form>
  );
}
